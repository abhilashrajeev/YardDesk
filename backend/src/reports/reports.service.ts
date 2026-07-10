import { Injectable } from '@nestjs/common';
import { PaymentDirection, Prisma, TxnStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { istDayRange } from '../common/date';
import { round2, round3 } from '../common/money';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private range(from: string, to: string) {
    return { start: istDayRange(from).start, end: istDayRange(to).end };
  }

  /** Headline totals for a date range (use same from/to for a single day). */
  async summary(from: string, to: string) {
    const { start, end } = this.range(from, to);
    const dateFilter = { date: { gte: start, lt: end } };

    const [sales, purchases, payIn, payOut, expenses] = await Promise.all([
      this.prisma.sale.aggregate({
        _sum: { total: true },
        _count: true,
        where: { ...dateFilter, status: TxnStatus.CONFIRMED },
      }),
      this.prisma.purchase.aggregate({
        _sum: { total: true },
        _count: true,
        where: { ...dateFilter, status: TxnStatus.CONFIRMED },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { ...dateFilter, direction: PaymentDirection.IN },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { ...dateFilter, direction: PaymentDirection.OUT },
      }),
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { ...dateFilter, deletedAt: null },
      }),
    ]);

    const salesTotal = round2(Number(sales._sum.total ?? 0));
    const collected = round2(Number(payIn._sum.amount ?? 0));

    return {
      from,
      to,
      sales: { count: sales._count, total: salesTotal },
      purchases: {
        count: purchases._count,
        total: round2(Number(purchases._sum.total ?? 0)),
      },
      payments: {
        collected,
        paidOut: round2(Number(payOut._sum.amount ?? 0)),
      },
      expenses: {
        count: expenses._count,
        total: round2(Number(expenses._sum.amount ?? 0)),
      },
      creditGiven: round2(salesTotal - collected),
    };
  }

  /** Expense totals grouped by category, for a date range. */
  async expenseBreakdown(from: string, to: string) {
    const { start, end } = this.range(from, to);
    const expenses = await this.prisma.expense.findMany({
      where: { date: { gte: start, lt: end }, deletedAt: null },
    });
    const map = new Map<string, { category: string; count: number; total: number }>();
    for (const e of expenses) {
      const row = map.get(e.category) ?? { category: e.category, count: 0, total: 0 };
      row.count += 1;
      row.total += Number(e.amount);
      map.set(e.category, row);
    }
    return [...map.values()]
      .map((r) => ({ ...r, total: round2(r.total) }))
      .sort((a, b) => b.total - a.total);
  }

  /** Quantity and value sold vs. purchased, per material, over a range. */
  async materialBreakdown(from: string, to: string) {
    const { start, end } = this.range(from, to);
    const [sold, bought] = await Promise.all([
      this.prisma.saleItem.findMany({
        where: { sale: { date: { gte: start, lt: end }, status: TxnStatus.CONFIRMED } },
        include: { material: { select: { name: true, unit: true } } },
      }),
      this.prisma.purchaseItem.findMany({
        where: { purchase: { date: { gte: start, lt: end }, status: TxnStatus.CONFIRMED } },
        include: { material: { select: { name: true, unit: true } } },
      }),
    ]);

    const map = new Map<
      string,
      { name: string; unit: string; soldQty: number; soldAmt: number; boughtQty: number; boughtAmt: number }
    >();
    const row = (id: string, name: string, unit: string) => {
      if (!map.has(id))
        map.set(id, { name, unit, soldQty: 0, soldAmt: 0, boughtQty: 0, boughtAmt: 0 });
      return map.get(id)!;
    };
    for (const s of sold) {
      const r = row(s.materialId, s.material.name, s.material.unit);
      r.soldQty += Number(s.quantity);
      r.soldAmt += Number(s.amount);
    }
    for (const p of bought) {
      const r = row(p.materialId, p.material.name, p.material.unit);
      r.boughtQty += Number(p.quantity);
      r.boughtAmt += Number(p.amount);
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        soldQty: round3(r.soldQty),
        soldAmt: round2(r.soldAmt),
        boughtQty: round3(r.boughtQty),
        boughtAmt: round2(r.boughtAmt),
      }))
      .sort((a, b) => b.soldAmt - a.soldAmt);
  }

  /**
   * Sales & purchase totals bucketed by IST day or month.
   * granularity: 'day' | 'month'. Powers daily/monthly/yearly charts.
   */
  async series(from: string, to: string, granularity: 'day' | 'month') {
    const { start, end } = this.range(from, to);
    const trunc = granularity === 'month' ? 'month' : 'day';
    const fmt = granularity === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    // Shift to IST (+330 min) before truncating so buckets align to business days.
    const bucketSales = await this.prisma.$queryRaw<
      { bucket: string; total: number; cnt: number }[]
    >(Prisma.sql`
      SELECT to_char(date_trunc(${trunc}, "date" + interval '330 minutes'), ${fmt}) AS bucket,
             COALESCE(SUM("total"), 0)::float8 AS total,
             COUNT(*)::int AS cnt
      FROM "Sale"
      WHERE "date" >= ${start} AND "date" < ${end} AND "status" = 'CONFIRMED'
      GROUP BY bucket ORDER BY bucket`);
    const bucketPurch = await this.prisma.$queryRaw<
      { bucket: string; total: number; cnt: number }[]
    >(Prisma.sql`
      SELECT to_char(date_trunc(${trunc}, "date" + interval '330 minutes'), ${fmt}) AS bucket,
             COALESCE(SUM("total"), 0)::float8 AS total,
             COUNT(*)::int AS cnt
      FROM "Purchase"
      WHERE "date" >= ${start} AND "date" < ${end} AND "status" = 'CONFIRMED'
      GROUP BY bucket ORDER BY bucket`);

    const buckets = new Map<string, { bucket: string; sales: number; purchases: number }>();
    for (const b of bucketSales)
      buckets.set(b.bucket, { bucket: b.bucket, sales: round2(b.total), purchases: 0 });
    for (const b of bucketPurch) {
      const r = buckets.get(b.bucket) ?? { bucket: b.bucket, sales: 0, purchases: 0 };
      r.purchases = round2(b.total);
      buckets.set(b.bucket, r);
    }
    return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
  }
}
