import { Injectable } from '@nestjs/common';
import { StockDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { istDayRange, businessDateValue } from '../common/date';
import { round3 } from '../common/money';
import { TXN_OPTIONS } from '../common/db';

export interface DayCloseRow {
  materialId: string;
  name: string;
  unit: string;
  opening: number;
  totalIn: number;
  totalOut: number;
  adjustment: number;
  closing: number;
}

@Injectable()
export class DayCloseService {
  constructor(private prisma: PrismaService) {}

  /**
   * Compute per-material opening/in/out/closing for a business date (no write).
   *
   * Opening and closing are summed from movement quantities by date rather than read
   * from each movement's stored `balance`. That stored value is the running stock at
   * the moment the movement was ENTERED, so a purchase entered after that day's sales
   * (the yard's normal workflow) leaves the earlier rows' balances stale and never
   * corrected. Summing by date gives the same answer regardless of entry order.
   */
  async compute(dateStr: string): Promise<DayCloseRow[]> {
    const { start, end } = istDayRange(dateStr);
    const [materials, beforeDay, duringDay] = await Promise.all([
      this.prisma.material.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.stockMovement.groupBy({
        by: ['materialId', 'direction'],
        where: { date: { lt: start } },
        _sum: { quantity: true },
      }),
      this.prisma.stockMovement.groupBy({
        by: ['materialId', 'direction'],
        where: { date: { gte: start, lt: end } },
        _sum: { quantity: true },
      }),
    ]);

    // materialId -> direction -> summed quantity
    const index = (groups: typeof beforeDay) => {
      const map = new Map<string, Partial<Record<StockDirection, number>>>();
      for (const g of groups) {
        const byDir = map.get(g.materialId) ?? {};
        byDir[g.direction] = Number(g._sum.quantity ?? 0);
        map.set(g.materialId, byDir);
      }
      return map;
    };
    const before = index(beforeDay);
    const during = index(duringDay);

    return materials.map((m) => {
      // IN/OUT quantities are stored as positive magnitudes; ADJUST is already signed.
      const b = before.get(m.id) ?? {};
      const opening = round3((b.IN ?? 0) - (b.OUT ?? 0) + (b.ADJUST ?? 0));

      const d = during.get(m.id) ?? {};
      const totalIn = round3(d.IN ?? 0);
      const totalOut = round3(d.OUT ?? 0);
      // Manual corrections (StockService.adjust/undoAdjustment) — kept separate from
      // totalIn/totalOut since they aren't a real purchase/sale/production movement.
      const adjustment = round3(d.ADJUST ?? 0);
      const closing = round3(opening + totalIn - totalOut + adjustment);

      return {
        materialId: m.id,
        name: m.name,
        unit: m.unit,
        opening,
        totalIn,
        totalOut,
        adjustment,
        closing,
      };
    });
  }

  /** Compute and lock the snapshot for a business date. Idempotent (upsert). */
  async close(dateStr: string, userId: string) {
    const rows = await this.compute(dateStr);
    const businessDate = businessDateValue(dateStr);

    await this.prisma.$transaction(
      (tx) =>
        Promise.all(
          rows.map((r) =>
            tx.dayClose.upsert({
              where: {
                businessDate_materialId: {
                  businessDate,
                  materialId: r.materialId,
                },
              },
              create: {
                businessDate,
                materialId: r.materialId,
                opening: r.opening,
                totalIn: r.totalIn,
                totalOut: r.totalOut,
                adjustment: r.adjustment,
                closing: r.closing,
                closedById: userId,
              },
              update: {
                opening: r.opening,
                totalIn: r.totalIn,
                totalOut: r.totalOut,
                adjustment: r.adjustment,
                closing: r.closing,
                closedById: userId,
                closedAt: new Date(),
              },
            }),
          ),
        ),
      TXN_OPTIONS,
    );

    return { businessDate: dateStr, rows };
  }

  /** Fetch a locked snapshot for a business date. */
  async getByDate(dateStr: string) {
    const businessDate = businessDateValue(dateStr);
    return this.prisma.dayClose.findMany({
      where: { businessDate },
      include: { material: { select: { name: true, unit: true } } },
      orderBy: { material: { name: 'asc' } },
    });
  }
}
