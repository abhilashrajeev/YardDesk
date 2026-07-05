import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { round3 } from '../common/money';

interface ApplyParams {
  materialId: string;
  direction: StockDirection;
  quantity: number; // always positive for IN/OUT; signed delta for ADJUST
  refType?: string;
  refId?: string;
  notes?: string;
  date?: Date;
}

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  /**
   * Apply a stock movement inside an existing transaction and return the new balance.
   * Negative stock is allowed (yards often sell ahead of recording a purchase).
   */
  async apply(tx: Prisma.TransactionClient, p: ApplyParams): Promise<number> {
    const material = await tx.material.findUnique({ where: { id: p.materialId } });
    if (!material) throw new NotFoundException(`Material ${p.materialId} not found`);

    const current = Number(material.currentStock);
    const delta =
      p.direction === StockDirection.IN
        ? p.quantity
        : p.direction === StockDirection.OUT
          ? -p.quantity
          : p.quantity; // ADJUST: signed delta
    const newBalance = round3(current + delta);

    await tx.material.update({
      where: { id: material.id },
      data: { currentStock: newBalance },
    });
    await tx.stockMovement.create({
      data: {
        materialId: p.materialId,
        direction: p.direction,
        quantity: Math.abs(p.quantity),
        balance: newBalance,
        refType: p.refType,
        refId: p.refId,
        notes: p.notes,
        ...(p.date ? { date: p.date } : {}),
      },
    });
    return newBalance;
  }

  /** Current stock across all active materials. */
  listStock() {
    return this.prisma.material.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true, currentStock: true },
    });
  }

  listMovements(materialId?: string, limit = 100) {
    return this.prisma.stockMovement.findMany({
      where: materialId ? { materialId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { material: { select: { name: true, unit: true } } },
    });
  }

  /** Manual adjustment (admin correction). `quantity` is a signed delta. */
  async adjust(materialId: string, quantity: number, notes?: string) {
    return this.prisma.$transaction((tx) =>
      this.apply(tx, {
        materialId,
        direction: StockDirection.ADJUST,
        quantity,
        refType: 'ADJUSTMENT',
        notes,
      }),
    );
  }
}
