import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PartyType,
  PaymentDirection,
  PaymentMode,
  StockDirection,
  TxnStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../inventory/stock.service';
import { LedgerService } from '../accounts/ledger.service';
import { CreateSaleDto, CreatePassDto } from './dto';
import { round2 } from '../common/money';
import { TXN_OPTIONS } from '../common/db';

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
    payments: { amount: unknown; direction: PaymentDirection }[];
  },
>(sale: T): T & { paidAmount: number; balance: number; paymentStatus: SaleStatus } {
  const total = Number(sale.total);
  const paid = sale.payments
    .filter((p) => p.direction === PaymentDirection.IN)
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
  ) {}

  async create(dto: CreateSaleDto, userId: string) {
    if (dto.clientUuid) {
      const existing = await this.prisma.sale.findUnique({
        where: { clientUuid: dto.clientUuid },
        include: { items: true },
      });
      if (existing) return existing; // offline replay — idempotent
    }

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

  /** Zero-padded sequential bill number. */
  private async nextBillNo(tx: {
    sale: { count: () => Promise<number> };
  }): Promise<string> {
    const n = await tx.sale.count();
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
                ...(params.from ? { gte: new Date(params.from) } : {}),
                ...(params.to ? { lte: new Date(params.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: params.limit ?? 100,
      include: {
        customer: { select: { name: true } },
        items: true,
        payments: { select: { amount: true, direction: true } },
      },
    });
    return sales.map(withSaleStatus);
  }

  /** Credit bills that aren't fully paid — pending, part-paid, or overdue. */
  async findOutstanding() {
    const sales = await this.prisma.sale.findMany({
      where: { paymentMode: PaymentMode.CREDIT },
      orderBy: { date: 'desc' },
      include: {
        customer: { select: { name: true } },
        payments: { select: { amount: true, direction: true } },
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
}
