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
      {
        materialId: string;
        name: string;
        unit: string;
        soldQty: number;
        soldAmt: number;
        boughtQty: number;
        boughtAmt: number;
      }
    >();
    const row = (id: string, name: string, unit: string) => {
      if (!map.has(id))
        map.set(id, { materialId: id, name, unit, soldQty: 0, soldAmt: 0, boughtQty: 0, boughtAmt: 0 });
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

  /** Stock value at an instant, valuing each material's balance at its current purchase
   *  rate (no batch/FIFO cost history is tracked, so this is a snapshot approximation). */
  private async stockValueAt(at: Date, unitCost: Map<string, number>): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ materialId: string; balance: string }[]>(Prisma.sql`
      SELECT DISTINCT ON ("materialId") "materialId", "balance"
      FROM "StockMovement"
      WHERE "date" < ${at}
      ORDER BY "materialId", "date" DESC, "createdAt" DESC
    `);
    return rows.reduce((sum, r) => sum + Number(r.balance) * (unitCost.get(r.materialId) ?? 0), 0);
  }

  private async periodFinancials(rangeStart: Date, rangeEnd: Date, unitCost: Map<string, number>) {
    const dateFilter = { date: { gte: rangeStart, lt: rangeEnd } };
    const [sales, purchases, expenses, openingStockValue, closingStockValue] = await Promise.all([
      this.prisma.sale.aggregate({ _sum: { total: true }, where: { ...dateFilter, status: TxnStatus.CONFIRMED } }),
      this.prisma.purchase.aggregate({ _sum: { total: true }, where: { ...dateFilter, status: TxnStatus.CONFIRMED } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { ...dateFilter, deletedAt: null } }),
      this.stockValueAt(rangeStart, unitCost),
      this.stockValueAt(rangeEnd, unitCost),
    ]);

    const revenue = round2(Number(sales._sum.total ?? 0));
    const purchaseCost = round2(Number(purchases._sum.total ?? 0));
    const operatingExpenses = round2(Number(expenses._sum.amount ?? 0));
    const opening = round2(openingStockValue);
    const closing = round2(closingStockValue);
    const cogs = round2(opening + purchaseCost - closing);
    const grossProfit = round2(revenue - cogs);
    const netProfit = round2(grossProfit - operatingExpenses);

    return {
      revenue,
      purchaseCost,
      operatingExpenses,
      openingStockValue: opening,
      closingStockValue: closing,
      cogs,
      grossProfit,
      netProfit,
    };
  }

  /** Equivalent immediately-preceding period of the same length, for a trend comparison. */
  private shiftPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T00:00:00Z`);
    const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    const prevToDate = new Date(fromDate.getTime() - 86400000);
    const prevFromDate = new Date(prevToDate.getTime() - (spanDays - 1) * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { prevFrom: fmt(prevFromDate), prevTo: fmt(prevToDate) };
  }

  /**
   * Accrual profit & loss for a range: gross profit (revenue minus cost of goods sold,
   * where COGS = opening stock value + purchases - closing stock value) minus operating
   * expenses. Stock is valued at each material's *current* purchase rate — there's no
   * batch/FIFO cost history, so this is an approximation, not a true historical costing.
   * Includes per-material margin and a comparison against the immediately preceding period
   * of equal length.
   */
  async profitAndLoss(from: string, to: string) {
    const { start, end } = this.range(from, to);

    const materials = await this.prisma.material.findMany({
      where: { isActive: true },
      select: { id: true, purchaseRate: true, defaultRate: true },
    });
    const unitCost = new Map(materials.map((m) => [m.id, Number(m.purchaseRate ?? m.defaultRate ?? 0)]));

    const { prevFrom, prevTo } = this.shiftPeriod(from, to);
    const { start: prevStart, end: prevEnd } = this.range(prevFrom, prevTo);

    const [current, previous, expenseRows, materialRows] = await Promise.all([
      this.periodFinancials(start, end, unitCost),
      this.periodFinancials(prevStart, prevEnd, unitCost),
      this.expenseBreakdown(from, to),
      this.materialBreakdown(from, to),
    ]);

    const materialMargins = materialRows
      .filter((m) => m.soldQty > 0)
      .map((m) => {
        const cost = unitCost.get(m.materialId) ?? 0;
        const estCogs = round2(m.soldQty * cost);
        const margin = round2(m.soldAmt - estCogs);
        return {
          name: m.name,
          unit: m.unit,
          soldQty: m.soldQty,
          revenue: m.soldAmt,
          estCogs,
          margin,
          marginPct: m.soldAmt > 0 ? round2((margin / m.soldAmt) * 100) : 0,
        };
      })
      .sort((a, b) => b.margin - a.margin);

    const grossMarginPct = current.revenue > 0 ? round2((current.grossProfit / current.revenue) * 100) : 0;
    const netMarginPct = current.revenue > 0 ? round2((current.netProfit / current.revenue) * 100) : 0;

    return {
      from,
      to,
      ...current,
      grossMarginPct,
      netMarginPct,
      expenseBreakdown: expenseRows,
      materialMargins,
      previousPeriod: { from: prevFrom, to: prevTo, ...previous },
    };
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
