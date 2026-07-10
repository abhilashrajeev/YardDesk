import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, PartyType, PaymentDirection, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentDto, UpdatePaymentDto } from './payments.dto';
import { round2 } from '../common/money';
import { TXN_OPTIONS } from '../common/db';
import { istDayRange } from '../common/date';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private audit: AuditService,
  ) {}

  async create(dto: CreatePaymentDto, userId: string) {
    if (dto.clientUuid) {
      const existing = await this.prisma.payment.findUnique({
        where: { clientUuid: dto.clientUuid },
      });
      if (existing) return existing; // offline replay — idempotent
    }

    const amount = round2(dto.amount);
    const date = dto.date ? new Date(dto.date) : new Date();

    if (dto.partyType === PartyType.CUSTOMER) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    } else {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
      if (!vendor) throw new NotFoundException('Vendor not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          clientUuid: dto.clientUuid,
          date,
          direction: dto.direction,
          mode: dto.mode,
          amount,
          reference: dto.reference,
          notes: dto.notes,
          partyType: dto.partyType,
          customerId: dto.customerId,
          vendorId: dto.vendorId,
          createdById: userId,
        },
      });

      if (dto.partyType === PartyType.CUSTOMER) {
        if (dto.direction !== PaymentDirection.IN)
          throw new BadRequestException('Customer payments must be direction IN');
        await this.ledger.post(tx, {
          partyType: PartyType.CUSTOMER,
          customerId: dto.customerId,
          description: `Payment received (${dto.mode})`,
          credit: amount,
          refType: 'PAYMENT',
          refId: payment.id,
          date,
        });
      } else {
        if (dto.direction !== PaymentDirection.OUT)
          throw new BadRequestException('Vendor payments must be direction OUT');
        await this.ledger.post(tx, {
          partyType: PartyType.VENDOR,
          vendorId: dto.vendorId,
          description: `Payment made (${dto.mode})`,
          debit: amount,
          refType: 'PAYMENT',
          refId: payment.id,
          date,
        });
      }

      await this.audit.log(
        {
          entityType: 'PAYMENT',
          entityId: payment.id,
          action: AuditAction.CREATE,
          summary: `Payment ${dto.partyType === PartyType.CUSTOMER ? 'received' : 'made'} — ₹${amount} (${dto.mode})`,
          after: payment,
          userId,
        },
        tx,
      );

      return payment;
    }, TXN_OPTIONS);
  }

  list(params: { customerId?: string; vendorId?: string; from?: string; to?: string; limit?: number }) {
    return this.prisma.payment.findMany({
      where: {
        ...(params.customerId ? { customerId: params.customerId } : {}),
        ...(params.vendorId ? { vendorId: params.vendorId } : {}),
        ...(params.from || params.to
          ? {
              date: {
                ...(params.from ? { gte: istDayRange(params.from).start } : {}),
                ...(params.to ? { lt: istDayRange(params.to).end } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: params.limit ?? 100,
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
      },
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private async reverseLedger(tx: Prisma.TransactionClient, payment: {
    id: string; partyType: PartyType; customerId: string | null; vendorId: string | null;
    amount: unknown; mode: string;
  }) {
    // A customer payment credited their ledger; reversing it debits back the same amount (and vice-versa for vendors).
    if (payment.partyType === PartyType.CUSTOMER) {
      await this.ledger.post(tx, {
        partyType: PartyType.CUSTOMER,
        customerId: payment.customerId!,
        description: `Reversal of payment (${payment.mode})`,
        debit: Number(payment.amount),
        refType: 'PAYMENT_REVERSAL',
        refId: payment.id,
      });
    } else {
      await this.ledger.post(tx, {
        partyType: PartyType.VENDOR,
        vendorId: payment.vendorId!,
        description: `Reversal of payment (${payment.mode})`,
        credit: Number(payment.amount),
        refType: 'PAYMENT_REVERSAL',
        refId: payment.id,
      });
    }
  }

  /** Edit a payment: reverses its old ledger effect, then reapplies with the new amount/mode. */
  async update(id: string, dto: UpdatePaymentDto, userId: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.voided) throw new BadRequestException('This payment was deleted and cannot be edited.');

    const amount = dto.amount !== undefined ? round2(dto.amount) : Number(existing.amount);
    const mode = dto.mode ?? existing.mode;

    return this.prisma.$transaction(async (tx) => {
      await this.reverseLedger(tx, existing);

      const payment = await tx.payment.update({
        where: { id },
        data: {
          amount,
          mode,
          reference: dto.reference !== undefined ? dto.reference : existing.reference,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          date: dto.date ? new Date(dto.date) : existing.date,
        },
      });

      if (existing.partyType === PartyType.CUSTOMER) {
        await this.ledger.post(tx, {
          partyType: PartyType.CUSTOMER,
          customerId: existing.customerId!,
          description: `Payment received (${mode}) (edited)`,
          credit: amount,
          refType: 'PAYMENT',
          refId: payment.id,
        });
      } else {
        await this.ledger.post(tx, {
          partyType: PartyType.VENDOR,
          vendorId: existing.vendorId!,
          description: `Payment made (${mode}) (edited)`,
          debit: amount,
          refType: 'PAYMENT',
          refId: payment.id,
        });
      }

      await this.audit.log(
        {
          entityType: 'PAYMENT',
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Payment edited — ₹${Number(existing.amount)} → ₹${amount}`,
          before: existing,
          after: payment,
          userId,
        },
        tx,
      );

      return payment;
    }, TXN_OPTIONS);
  }

  /** Void (soft-delete) a payment: reverses its ledger effect and marks it voided. */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.voided) return existing;

    return this.prisma.$transaction(async (tx) => {
      await this.reverseLedger(tx, existing);
      const payment = await tx.payment.update({ where: { id }, data: { voided: true } });
      await this.audit.log(
        {
          entityType: 'PAYMENT',
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Payment voided — was ₹${Number(existing.amount)} (${existing.mode})`,
          before: existing,
          userId,
        },
        tx,
      );
      return payment;
    }, TXN_OPTIONS);
  }
}
