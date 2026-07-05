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
  closing: number;
}

@Injectable()
export class DayCloseService {
  constructor(private prisma: PrismaService) {}

  /** Compute per-material opening/in/out/closing for a business date (no write). */
  async compute(dateStr: string): Promise<DayCloseRow[]> {
    const { start, end } = istDayRange(dateStr);
    const materials = await this.prisma.material.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      materials.map(async (m) => {
        // Opening = balance carried in from before the day.
        const before = await this.prisma.stockMovement.findFirst({
          where: { materialId: m.id, date: { lt: start } },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        });
        const opening = before ? Number(before.balance) : 0;

        // Movements within the day.
        const [inAgg, outAgg, lastOfDay] = await Promise.all([
          this.prisma.stockMovement.aggregate({
            _sum: { quantity: true },
            where: {
              materialId: m.id,
              date: { gte: start, lt: end },
              direction: StockDirection.IN,
            },
          }),
          this.prisma.stockMovement.aggregate({
            _sum: { quantity: true },
            where: {
              materialId: m.id,
              date: { gte: start, lt: end },
              direction: StockDirection.OUT,
            },
          }),
          this.prisma.stockMovement.findFirst({
            where: { materialId: m.id, date: { gte: start, lt: end } },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          }),
        ]);

        const totalIn = round3(Number(inAgg._sum.quantity ?? 0));
        const totalOut = round3(Number(outAgg._sum.quantity ?? 0));
        // Closing reflects the true end-of-day balance (includes any adjustments).
        const closing = lastOfDay ? Number(lastOfDay.balance) : opening;

        return {
          materialId: m.id,
          name: m.name,
          unit: m.unit,
          opening,
          totalIn,
          totalOut,
          closing,
        };
      }),
    );
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
                closing: r.closing,
                closedById: userId,
              },
              update: {
                opening: r.opening,
                totalIn: r.totalIn,
                totalOut: r.totalOut,
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
