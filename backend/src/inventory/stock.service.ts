import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, StockDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

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
        // IN/OUT quantities are always positive magnitudes (direction carries the sign).
        // ADJUST keeps its signed value so an undo can exactly reverse it later.
        quantity: p.direction === StockDirection.ADJUST ? p.quantity : Math.abs(p.quantity),
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
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        defaultRate: true,
        purchaseRate: true,
        purchaseRateTon: true,
      },
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
  async adjust(materialId: string, quantity: number, notes: string | undefined, userId: string) {
    if (quantity === 0) throw new BadRequestException('Enter a non-zero quantity.');
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Material not found');

    return this.prisma.$transaction(async (tx) => {
      const balance = await this.apply(tx, {
        materialId,
        direction: StockDirection.ADJUST,
        quantity,
        refType: 'ADJUSTMENT',
        notes,
      });
      const movement = await tx.stockMovement.findFirst({
        where: { materialId, refType: 'ADJUSTMENT', direction: StockDirection.ADJUST },
        orderBy: { createdAt: 'desc' },
      });
      await this.audit.log(
        {
          entityType: 'STOCK_ADJUSTMENT',
          entityId: movement!.id,
          action: AuditAction.CREATE,
          summary: `Stock adjusted: ${material.name} ${quantity > 0 ? '+' : ''}${quantity} ${material.unit.toLowerCase()} (${notes ?? 'manual'})`,
          after: movement,
          userId,
        },
        tx,
      );
      return { balance, movementId: movement!.id };
    });
  }

  /** Reverse a previous manual adjustment with an equal-and-opposite one. Only ADJUSTMENT-type movements can be undone. */
  async undoAdjustment(movementId: string, userId: string) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: { material: true },
    });
    if (!movement) throw new NotFoundException('Adjustment not found');
    if (movement.direction !== StockDirection.ADJUST || movement.refType !== 'ADJUSTMENT') {
      throw new BadRequestException('Only manual stock adjustments can be undone here.');
    }
    const alreadyUndone = await this.prisma.stockMovement.findFirst({
      where: { refType: 'ADJUSTMENT_UNDO', refId: movement.id },
    });
    if (alreadyUndone) throw new BadRequestException('This adjustment was already undone.');

    return this.prisma.$transaction(async (tx) => {
      const balance = await this.apply(tx, {
        materialId: movement.materialId,
        direction: StockDirection.ADJUST,
        quantity: -Number(movement.quantity),
        refType: 'ADJUSTMENT_UNDO',
        refId: movement.id,
        notes: `Undo of adjustment ${movement.id}`,
      });
      await this.audit.log(
        {
          entityType: 'STOCK_ADJUSTMENT',
          entityId: movement.id,
          action: AuditAction.DELETE,
          summary: `Stock adjustment undone: ${movement.material.name} (was ${Number(movement.quantity) > 0 ? '+' : ''}${movement.quantity} ${movement.material.unit.toLowerCase()})`,
          before: movement,
          userId,
        },
        tx,
      );
      return { balance };
    });
  }
}
