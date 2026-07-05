import { Injectable, BadRequestException } from '@nestjs/common';
import { PartyType, PaymentDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { CreatePaymentDto } from './payments.dto';
import { round2 } from '../common/money';
import { TXN_OPTIONS } from '../common/db';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
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
      return payment;
    }, TXN_OPTIONS);
  }

  list(params: { customerId?: string; vendorId?: string; limit?: number }) {
    return this.prisma.payment.findMany({
      where: {
        ...(params.customerId ? { customerId: params.customerId } : {}),
        ...(params.vendorId ? { vendorId: params.vendorId } : {}),
      },
      orderBy: { date: 'desc' },
      take: params.limit ?? 100,
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
      },
    });
  }
}
