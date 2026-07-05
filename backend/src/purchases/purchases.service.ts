import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PartyType,
  PaymentDirection,
  StockDirection,
  TxnStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../inventory/stock.service';
import { LedgerService } from '../accounts/ledger.service';
import { CreatePurchaseDto } from './dto';
import { round2 } from '../common/money';
import { TXN_OPTIONS } from '../common/db';

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private stock: StockService,
    private ledger: LedgerService,
  ) {}

  async create(dto: CreatePurchaseDto, userId: string) {
    if (dto.clientUuid) {
      const existing = await this.prisma.purchase.findUnique({
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

      // Stock IN for every line.
      for (const it of items) {
        await this.stock.apply(tx, {
          materialId: it.materialId,
          direction: StockDirection.IN,
          quantity: it.quantity,
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

  list(params: { vendorId?: string; from?: string; to?: string; limit?: number }) {
    return this.prisma.purchase.findMany({
      where: {
        ...(params.vendorId ? { vendorId: params.vendorId } : {}),
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
      include: { vendor: { select: { name: true } }, items: true },
    });
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
    return purchase;
  }
}
