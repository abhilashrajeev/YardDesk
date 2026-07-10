import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  PartyType,
  PaymentDirection,
  Prisma,
  StockDirection,
  TxnStatus,
  Unit,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../inventory/stock.service';
import { LedgerService } from '../accounts/ledger.service';
import { AuditService } from '../audit/audit.service';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';
import { round2 } from '../common/money';
import { TXN_OPTIONS } from '../common/db';
import { convertQty } from '../common/units';
import { istDayRange } from '../common/date';

type PurchaseStatus = 'PAID' | 'PART_PAID' | 'PENDING' | 'OVERDUE';
const OVERDUE_AFTER_DAYS = 21;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

/**
 * Attach computed paidAmount/balance/paymentStatus from a purchase's payments.
 * Named `paymentStatus` (not `status`) to avoid colliding with the Purchase
 * model's own `status: TxnStatus` (confirmed/cancelled).
 */
function withPurchaseStatus<
  T extends { total: unknown; date: Date; payments: { amount: unknown; direction: PaymentDirection }[] },
>(purchase: T): T & { paidAmount: number; balance: number; paymentStatus: PurchaseStatus } {
  const total = Number(purchase.total);
  const paid = purchase.payments
    .filter((p) => p.direction === PaymentDirection.OUT)
    .reduce((s, p) => s + Number(p.amount), 0);
  const balance = round2(total - paid);

  let paymentStatus: PurchaseStatus;
  if (paid <= 0) paymentStatus = daysSince(purchase.date) > OVERDUE_AFTER_DAYS ? 'OVERDUE' : 'PENDING';
  else if (paid < total - 0.01) paymentStatus = 'PART_PAID';
  else paymentStatus = 'PAID';

  return { ...purchase, paidAmount: round2(paid), balance, paymentStatus };
}

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private stock: StockService,
    private ledger: LedgerService,
    private audit: AuditService,
  ) {}

  async create(dto: CreatePurchaseDto, userId: string) {
    if (dto.clientUuid) {
      const existing = await this.prisma.purchase.findUnique({
        where: { clientUuid: dto.clientUuid },
        include: { items: true },
      });
      if (existing) return existing; // offline replay — idempotent
    }

    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }

    const materials = await this.prisma.material.findMany({
      where: { id: { in: dto.items.map((i) => i.materialId) } },
    });
    const materialById = new Map(materials.map((m) => [m.id, m]));

    const items = dto.items.map((i) => {
      const material = materialById.get(i.materialId);
      if (!material) throw new NotFoundException(`Material ${i.materialId} not found`);
      return {
        materialId: i.materialId,
        // Unit actually transacted in (e.g. TON); defaults to the material's own unit.
        unit: i.unit ?? material.unit,
        quantity: i.quantity,
        rate: i.rate,
        amount: round2(i.quantity * i.rate),
      };
    });
    const subTotal = round2(items.reduce((s, i) => s + i.amount, 0));
    const freight = round2(dto.freight ?? 0);
    const total = round2(subTotal + freight);
    const date = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          clientUuid: dto.clientUuid,
          invoiceNo: dto.invoiceNo,
          date,
          vendorId: dto.vendorId,
          vehicleId: dto.vehicleId,
          freight,
          subTotal,
          total,
          status: TxnStatus.CONFIRMED,
          notes: dto.notes,
          createdById: userId,
          items: { create: items },
        },
        include: { items: true },
      });

      // Stock IN for every line, converted from the transacted unit into the
      // material's stock unit (e.g. 50 TON purchased -> +1050 CFT in stock).
      for (const it of items) {
        const material = materialById.get(it.materialId)!;
        const stockQty = convertQty(it.quantity, it.unit, material.unit);
        await this.stock.apply(tx, {
          materialId: it.materialId,
          direction: StockDirection.IN,
          quantity: stockQty,
          refType: 'PURCHASE',
          refId: purchase.id,
          date,
        });
      }

      // We now owe the vendor the full total.
      await this.ledger.post(tx, {
        partyType: PartyType.VENDOR,
        vendorId: dto.vendorId,
        description: `Purchase ${purchase.invoiceNo ?? purchase.id}`,
        credit: total,
        refType: 'PURCHASE',
        refId: purchase.id,
        date,
      });

      // Optional immediate payment.
      const paid = round2(dto.paidAmount ?? 0);
      if (paid > 0 && dto.paymentMode) {
        const payment = await tx.payment.create({
          data: {
            date,
            direction: PaymentDirection.OUT,
            mode: dto.paymentMode,
            amount: paid,
            partyType: PartyType.VENDOR,
            vendorId: dto.vendorId,
            purchaseId: purchase.id,
            createdById: userId,
          },
        });
        await this.ledger.post(tx, {
          partyType: PartyType.VENDOR,
          vendorId: dto.vendorId,
          description: `Payment for purchase ${purchase.invoiceNo ?? purchase.id}`,
          debit: paid,
          refType: 'PAYMENT',
          refId: payment.id,
          date,
        });
      }

      return purchase;
    }, TXN_OPTIONS);
  }

  async list(params: { vendorId?: string; from?: string; to?: string; limit?: number }) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
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
        vendor: { select: { name: true } },
        vehicle: { select: { number: true } },
        items: true,
        payments: { select: { amount: true, direction: true } },
      },
    });
    return purchases.map(withPurchaseStatus);
  }

  /** Purchases that still have an outstanding balance owed to the vendor. */
  async findOutstanding() {
    const purchases = await this.prisma.purchase.findMany({
      where: { status: { not: TxnStatus.CANCELLED } },
      orderBy: { date: 'desc' },
      include: {
        vendor: { select: { name: true } },
        payments: { select: { amount: true, direction: true } },
      },
    });
    return purchases.map(withPurchaseStatus).filter((p) => p.paymentStatus !== 'PAID');
  }

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        vendor: true,
        vehicle: true,
        items: { include: { material: { select: { name: true, unit: true } } } },
        payments: true,
      },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return withPurchaseStatus(purchase);
  }

  /**
   * Reverse a confirmed purchase's stock and ledger effects: stock goes back
   * OUT (converted from each line's transacted unit), and a compensating
   * ledger debit cancels out the original vendor credit. Existing payments
   * against the purchase are left untouched.
   */
  private async reverseEffects(
    tx: Prisma.TransactionClient,
    purchase: { id: string; invoiceNo: string | null; vendorId: string; total: Prisma.Decimal | number },
    items: { materialId: string; quantity: Prisma.Decimal | number; unit: Unit | null }[],
    date: Date,
  ) {
    const materials = await tx.material.findMany({
      where: { id: { in: items.map((i) => i.materialId) } },
    });
    const materialById = new Map(materials.map((m) => [m.id, m]));

    for (const it of items) {
      const material = materialById.get(it.materialId)!;
      const stockQty = convertQty(Number(it.quantity), it.unit ?? material.unit, material.unit);
      await this.stock.apply(tx, {
        materialId: it.materialId,
        direction: StockDirection.OUT,
        quantity: stockQty,
        refType: 'PURCHASE_REVERSAL',
        refId: purchase.id,
        date,
      });
    }
    await this.ledger.post(tx, {
      partyType: PartyType.VENDOR,
      vendorId: purchase.vendorId,
      description: `Reversal of purchase ${purchase.invoiceNo ?? purchase.id}`,
      debit: Number(purchase.total),
      refType: 'PURCHASE_REVERSAL',
      refId: purchase.id,
      date,
    });
  }

  /** Edit a purchase: reverses its old stock/ledger effect, then reapplies with the new values. */
  async update(id: string, dto: UpdatePurchaseDto, userId: string) {
    const existing = await this.prisma.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Purchase not found');
    if (existing.status === TxnStatus.CANCELLED) {
      throw new BadRequestException('This purchase was deleted and cannot be edited.');
    }

    const vendorId = dto.vendorId ?? existing.vendorId;
    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
      if (!vendor) throw new NotFoundException('Vendor not found');
    }
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }
    const rawItems = dto.items ?? existing.items;
    const materials = await this.prisma.material.findMany({
      where: { id: { in: rawItems.map((i) => i.materialId) } },
    });
    const materialById = new Map(materials.map((m) => [m.id, m]));
    const items = rawItems.map((i) => {
      const material = materialById.get(i.materialId);
      if (!material) throw new NotFoundException(`Material ${i.materialId} not found`);
      return {
        materialId: i.materialId,
        unit: i.unit ?? material.unit,
        quantity: Number(i.quantity),
        rate: Number(i.rate),
        amount: round2(Number(i.quantity) * Number(i.rate)),
      };
    });
    const subTotal = round2(items.reduce((s, i) => s + i.amount, 0));
    const freight = dto.freight !== undefined ? round2(dto.freight) : Number(existing.freight);
    const total = round2(subTotal + freight);
    const date = dto.date ? new Date(dto.date) : existing.date;

    return this.prisma.$transaction(async (tx) => {
      await this.reverseEffects(tx, existing, existing.items, existing.date);

      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      const purchase = await tx.purchase.update({
        where: { id },
        data: {
          vendorId,
          vehicleId: dto.vehicleId !== undefined ? dto.vehicleId : existing.vehicleId,
          invoiceNo: dto.invoiceNo !== undefined ? dto.invoiceNo : existing.invoiceNo,
          freight,
          subTotal,
          total,
          date,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          items: { create: items },
        },
        include: { items: true },
      });

      for (const it of items) {
        const material = materialById.get(it.materialId)!;
        const stockQty = convertQty(it.quantity, it.unit, material.unit);
        await this.stock.apply(tx, {
          materialId: it.materialId,
          direction: StockDirection.IN,
          quantity: stockQty,
          refType: 'PURCHASE',
          refId: purchase.id,
          date,
        });
      }
      await this.ledger.post(tx, {
        partyType: PartyType.VENDOR,
        vendorId,
        description: `Purchase ${purchase.invoiceNo ?? purchase.id} (edited)`,
        credit: total,
        refType: 'PURCHASE',
        refId: purchase.id,
        date,
      });

      await this.audit.log(
        {
          entityType: 'PURCHASE',
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Purchase ${purchase.invoiceNo ?? purchase.id} edited — total ₹${Number(existing.total)} → ₹${total}`,
          before: existing,
          after: purchase,
          userId,
        },
        tx,
      );

      return withPurchaseStatus({ ...purchase, payments: [] as { amount: unknown; direction: PaymentDirection }[] });
    }, TXN_OPTIONS);
  }

  /** Delete a purchase: reverses its stock/ledger effect and marks it cancelled (kept for the audit trail). */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Purchase not found');
    if (existing.status === TxnStatus.CANCELLED) return existing;

    return this.prisma.$transaction(async (tx) => {
      await this.reverseEffects(tx, existing, existing.items, existing.date);
      const purchase = await tx.purchase.update({ where: { id }, data: { status: TxnStatus.CANCELLED } });
      await this.audit.log(
        {
          entityType: 'PURCHASE',
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Purchase ${existing.invoiceNo ?? existing.id} deleted — was ₹${Number(existing.total)}`,
          before: existing,
          userId,
        },
        tx,
      );
      return purchase;
    }, TXN_OPTIONS);
  }
}
