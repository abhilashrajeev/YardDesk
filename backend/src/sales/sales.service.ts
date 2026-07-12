import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  PartyType,
  PaymentDirection,
  PaymentMode,
  Prisma,
  StockDirection,
  TxnStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../inventory/stock.service';
import { LedgerService } from '../accounts/ledger.service';
import { PaymentsService } from '../accounts/payments.service';
import { AuditService } from '../audit/audit.service';
import { CreateSaleDto, UpdateSaleDto, CreatePassDto } from './dto';
import { round2 } from '../common/money';
import { TXN_OPTIONS } from '../common/db';
import { istDayRange } from '../common/date';

type SaleStatus = 'PAID' | 'PART_PAID' | 'PENDING' | 'OVERDUE';
const OVERDUE_AFTER_DAYS = 21;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

/**
 * Attach computed paidAmount/balance/paymentStatus from a sale's payments.
 * Cash/UPI/Bank sales always settle at creation. Named `paymentStatus` (not
 * `status`) to avoid colliding with the Sale model's own `status: TxnStatus`.
 */
function withSaleStatus<
  T extends {
    total: unknown;
    paymentMode: PaymentMode;
    date: Date;
    payments: { amount: unknown; direction: PaymentDirection; voided?: boolean }[];
  },
>(sale: T): T & { paidAmount: number; balance: number; paymentStatus: SaleStatus } {
  const total = Number(sale.total);
  const paid = sale.payments
    .filter((p) => p.direction === PaymentDirection.IN && !p.voided)
    .reduce((s, p) => s + Number(p.amount), 0);
  const balance = round2(total - paid);

  let paymentStatus: SaleStatus;
  if (sale.paymentMode !== PaymentMode.CREDIT) paymentStatus = 'PAID';
  else if (paid <= 0) paymentStatus = daysSince(sale.date) > OVERDUE_AFTER_DAYS ? 'OVERDUE' : 'PENDING';
  else if (paid < total - 0.01) paymentStatus = 'PART_PAID';
  else paymentStatus = 'PAID';

  return { ...sale, paidAmount: round2(paid), balance, paymentStatus };
}

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private stock: StockService,
    private ledger: LedgerService,
    private payments: PaymentsService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateSaleDto, userId: string) {
    if (dto.clientUuid) {
      const existing = await this.prisma.sale.findUnique({
        where: { clientUuid: dto.clientUuid },
        include: { items: true },
      });
      if (existing) return existing; // offline replay — idempotent
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }
    const materialIds = [...new Set(dto.items.map((i) => i.materialId))];
    const materialCount = await this.prisma.material.count({ where: { id: { in: materialIds } } });
    if (materialCount !== materialIds.length) throw new NotFoundException('One or more materials not found');

    const items = dto.items.map((i) => ({
      materialId: i.materialId,
      quantity: i.quantity,
      rate: i.rate,
      amount: round2(i.quantity * i.rate),
    }));
    const subTotal = round2(items.reduce((s, i) => s + i.amount, 0));
    const freight = round2(dto.freight ?? 0);
    const discount = round2(dto.discount ?? 0);
    const total = round2(subTotal + freight - discount);
    const date = dto.date ? new Date(dto.date) : new Date();

    // Cash/UPI/Bank sales are paid in full; credit sales may carry a part-payment.
    const paid =
      dto.paymentMode === PaymentMode.CREDIT
        ? round2(dto.paidAmount ?? 0)
        : total;

    return this.prisma.$transaction(async (tx) => {
      const billNo = await this.nextBillNo(tx);

      const sale = await tx.sale.create({
        data: {
          clientUuid: dto.clientUuid,
          billNo,
          date,
          customerId: dto.customerId,
          vehicleId: dto.vehicleId,
          freight,
          discount,
          subTotal,
          total,
          paymentMode: dto.paymentMode,
          status: TxnStatus.CONFIRMED,
          notes: dto.notes,
          createdById: userId,
          items: { create: items },
        },
        include: { items: true },
      });

      // Stock OUT for every line.
      for (const it of items) {
        await this.stock.apply(tx, {
          materialId: it.materialId,
          direction: StockDirection.OUT,
          quantity: it.quantity,
          refType: 'SALE',
          refId: sale.id,
          date,
        });
      }

      // Customer now owes us the full bill.
      await this.ledger.post(tx, {
        partyType: PartyType.CUSTOMER,
        customerId: dto.customerId,
        description: `Sale bill ${billNo}`,
        debit: total,
        refType: 'SALE',
        refId: sale.id,
        date,
      });

      // Record collected amount (full for cash sales, part for credit).
      if (paid > 0) {
        const payment = await tx.payment.create({
          data: {
            date,
            direction: PaymentDirection.IN,
            mode:
              dto.paymentMode === PaymentMode.CREDIT
                ? PaymentMode.CASH
                : dto.paymentMode,
            amount: paid,
            partyType: PartyType.CUSTOMER,
            customerId: dto.customerId,
            saleId: sale.id,
            createdById: userId,
          },
        });
        await this.ledger.post(tx, {
          partyType: PartyType.CUSTOMER,
          customerId: dto.customerId,
          description: `Payment for bill ${billNo}`,
          credit: paid,
          refType: 'PAYMENT',
          refId: payment.id,
          date,
        });
      }

      return sale;
    }, TXN_OPTIONS);
  }

  /**
   * Zero-padded sequential bill number. Derived from the highest existing
   * billNo (not a row count) so it stays collision-free even after a bill has
   * been permanently deleted — a row count would shrink and reissue a number
   * that's still in use by another bill.
   */
  private async nextBillNo(tx: Prisma.TransactionClient): Promise<string> {
    const last = await tx.sale.findFirst({
      where: { billNo: { not: null } },
      orderBy: { billNo: 'desc' },
      select: { billNo: true },
    });
    const n = last?.billNo ? parseInt(last.billNo, 10) : 0;
    return String(n + 1).padStart(6, '0');
  }

  async createGatePass(saleId: string, userId: string, dto: CreatePassDto) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');
    const existing = await this.prisma.gatePass.findUnique({ where: { saleId } });
    if (existing) return existing;

    const passNo = String((await this.prisma.gatePass.count()) + 1).padStart(6, '0');
    return this.prisma.gatePass.create({
      data: {
        clientUuid: dto.clientUuid,
        passNo,
        saleId,
        issuedById: userId,
        notes: dto.notes,
      },
    });
  }

  async createLoadingPass(saleId: string, userId: string, dto: CreatePassDto) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');
    const existing = await this.prisma.loadingPass.findUnique({ where: { saleId } });
    if (existing) return existing;

    const passNo = String((await this.prisma.loadingPass.count()) + 1).padStart(6, '0');
    return this.prisma.loadingPass.create({
      data: {
        clientUuid: dto.clientUuid,
        passNo,
        saleId,
        loadedById: userId,
        notes: dto.notes,
      },
    });
  }

  async list(params: { customerId?: string; from?: string; to?: string; limit?: number }) {
    const sales = await this.prisma.sale.findMany({
      where: {
        ...(params.customerId ? { customerId: params.customerId } : {}),
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
        vehicle: { select: { number: true } },
        items: true,
        payments: { select: { amount: true, direction: true, voided: true } },
      },
    });
    return sales.map(withSaleStatus);
  }

  /** Credit bills that aren't fully paid — pending, part-paid, or overdue. */
  async findOutstanding() {
    const sales = await this.prisma.sale.findMany({
      where: { paymentMode: PaymentMode.CREDIT, status: { not: TxnStatus.CANCELLED } },
      orderBy: { date: 'desc' },
      include: {
        customer: { select: { name: true } },
        payments: { select: { amount: true, direction: true, voided: true } },
      },
    });
    return sales.map(withSaleStatus).filter((s) => s.paymentStatus !== 'PAID');
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        items: { include: { material: { select: { name: true, unit: true } } } },
        payments: true,
        gatePass: true,
        loadingPass: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return withSaleStatus(sale);
  }

  /**
   * Reverse a confirmed sale's stock and ledger effects: stock goes back IN,
   * and a compensating ledger credit cancels out the original debit. Used by
   * both `update` (reverse-then-reapply) and `remove` (reverse-and-cancel).
   * Existing payments against the sale are left untouched — they're a
   * separate fact (money that genuinely moved).
   */
  private async reverseEffects(
    tx: Prisma.TransactionClient,
    sale: { id: string; billNo: string | null; customerId: string; total: Prisma.Decimal | number },
    items: { materialId: string; quantity: Prisma.Decimal | number }[],
    date: Date,
  ) {
    for (const it of items) {
      await this.stock.apply(tx, {
        materialId: it.materialId,
        direction: StockDirection.IN,
        quantity: Number(it.quantity),
        refType: 'SALE_REVERSAL',
        refId: sale.id,
        date,
      });
    }
    await this.ledger.post(tx, {
      partyType: PartyType.CUSTOMER,
      customerId: sale.customerId,
      description: `Reversal of bill ${sale.billNo ?? sale.id}`,
      credit: Number(sale.total),
      refType: 'SALE_REVERSAL',
      refId: sale.id,
      date,
    });
  }

  /** Edit a sale: reverses its old stock/ledger effect, then reapplies with the new values. */
  async update(id: string, dto: UpdateSaleDto, userId: string) {
    const existing = await this.prisma.sale.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Sale not found');
    if (existing.status === TxnStatus.CANCELLED) {
      throw new BadRequestException('This sale was deleted and cannot be edited.');
    }

    const customerId = dto.customerId ?? existing.customerId;
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }
    if (dto.items) {
      const materialIds = [...new Set(dto.items.map((i) => i.materialId))];
      const materialCount = await this.prisma.material.count({ where: { id: { in: materialIds } } });
      if (materialCount !== materialIds.length) throw new NotFoundException('One or more materials not found');
    }
    const items = (dto.items ?? existing.items).map((i) => ({
      materialId: i.materialId,
      quantity: Number(i.quantity),
      rate: Number(i.rate),
      amount: round2(Number(i.quantity) * Number(i.rate)),
    }));
    const subTotal = round2(items.reduce((s, i) => s + i.amount, 0));
    const freight = dto.freight !== undefined ? round2(dto.freight) : Number(existing.freight);
    const discount = dto.discount !== undefined ? round2(dto.discount) : Number(existing.discount);
    const total = round2(subTotal + freight - discount);
    const paymentMode = dto.paymentMode ?? existing.paymentMode;
    const date = dto.date ? new Date(dto.date) : existing.date;

    return this.prisma.$transaction(async (tx) => {
      await this.reverseEffects(tx, existing, existing.items, existing.date);

      await tx.saleItem.deleteMany({ where: { saleId: id } });
      const sale = await tx.sale.update({
        where: { id },
        data: {
          customerId,
          vehicleId: dto.vehicleId !== undefined ? dto.vehicleId : existing.vehicleId,
          freight,
          discount,
          subTotal,
          total,
          paymentMode,
          date,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          items: { create: items },
        },
        include: { items: true },
      });

      for (const it of items) {
        await this.stock.apply(tx, {
          materialId: it.materialId,
          direction: StockDirection.OUT,
          quantity: it.quantity,
          refType: 'SALE',
          refId: sale.id,
          date,
        });
      }
      await this.ledger.post(tx, {
        partyType: PartyType.CUSTOMER,
        customerId,
        description: `Sale bill ${sale.billNo} (edited)`,
        debit: total,
        refType: 'SALE',
        refId: sale.id,
        date,
      });

      await this.audit.log(
        {
          entityType: 'SALE',
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Bill ${sale.billNo} edited — total ₹${Number(existing.total)} → ₹${total}`,
          before: existing,
          after: sale,
          userId,
        },
        tx,
      );

      return withSaleStatus({ ...sale, payments: [] as { amount: unknown; direction: PaymentDirection }[] });
    }, TXN_OPTIONS);
  }

  /**
   * Delete a sale: reverses its stock/ledger effect and marks it cancelled
   * (kept for the audit trail). Any payment still linked to it is auto-voided
   * too — in real life, cancelling a bill that was already paid means giving
   * that money back, so the customer's balance should net back to ₹0, not go
   * negative (which would otherwise misread as "we owe them an advance").
   */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.sale.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Sale not found');
    if (existing.status === TxnStatus.CANCELLED) return existing;

    return this.prisma.$transaction(async (tx) => {
      await this.reverseEffects(tx, existing, existing.items, existing.date);

      const linkedPayments = await tx.payment.findMany({ where: { saleId: id, voided: false } });
      for (const payment of linkedPayments) {
        await this.payments.voidWithinTx(tx, payment, userId, `bill ${existing.billNo ?? existing.id} was deleted`);
      }

      const sale = await tx.sale.update({ where: { id }, data: { status: TxnStatus.CANCELLED } });
      await this.audit.log(
        {
          entityType: 'SALE',
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Bill ${existing.billNo} deleted — was ₹${Number(existing.total)}`,
          before: existing,
          userId,
        },
        tx,
      );
      return sale;
    }, TXN_OPTIONS);
  }

  /**
   * Undo a cancellation: reapplies the original stock/ledger effects, sets it
   * back to CONFIRMED, and un-voids any payment that was auto-voided when it
   * was cancelled — restore is a full undo of delete, symmetric in both directions.
   */
  async restore(id: string, userId: string) {
    const existing = await this.prisma.sale.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Sale not found');
    if (existing.status !== TxnStatus.CANCELLED) {
      throw new BadRequestException('Only a cancelled sale can be restored.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const it of existing.items) {
        await this.stock.apply(tx, {
          materialId: it.materialId,
          direction: StockDirection.OUT,
          quantity: Number(it.quantity),
          refType: 'SALE_RESTORE',
          refId: existing.id,
          date: new Date(),
        });
      }
      await this.ledger.post(tx, {
        partyType: PartyType.CUSTOMER,
        customerId: existing.customerId,
        description: `Restoration of bill ${existing.billNo ?? existing.id}`,
        debit: Number(existing.total),
        refType: 'SALE_RESTORE',
        refId: existing.id,
        date: new Date(),
      });

      const voidedPayments = await tx.payment.findMany({ where: { saleId: id, voided: true } });
      for (const payment of voidedPayments) {
        await this.payments.unvoidWithinTx(tx, payment, userId, `bill ${existing.billNo ?? existing.id} was restored`);
      }

      const sale = await tx.sale.update({ where: { id }, data: { status: TxnStatus.CONFIRMED } });
      await this.audit.log(
        {
          entityType: 'SALE',
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Bill ${existing.billNo} restored — ₹${Number(existing.total)}`,
          before: existing,
          after: sale,
          userId,
        },
        tx,
      );
      return sale;
    }, TXN_OPTIONS);
  }

  /**
   * Permanently erases a cancelled sale — only reachable once it's already
   * cancelled (money/stock already reversed). Any payment still linked to it
   * is unlinked (kept — it's a separate real fact) rather than deleted.
   * Ledger/audit history rows referencing this sale's id are left as-is; they
   * don't have a hard foreign key to it and remain valid historical records.
   */
  async hardDelete(id: string, userId: string) {
    const existing = await this.prisma.sale.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Sale not found');
    if (existing.status !== TxnStatus.CANCELLED) {
      throw new BadRequestException('Only a cancelled sale can be permanently deleted — delete it first.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({ where: { saleId: id }, data: { saleId: null } });
      await tx.sale.delete({ where: { id } });
      await this.audit.log(
        {
          entityType: 'SALE',
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Bill ${existing.billNo} permanently deleted — was ₹${Number(existing.total)}`,
          before: existing,
          userId,
        },
        tx,
      );
      return { success: true };
    }, TXN_OPTIONS);
  }
}
