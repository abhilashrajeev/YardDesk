import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, StockDirection, TxnStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../inventory/stock.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductionDto, UpdateProductionDto } from './dto';
import { round2 } from '../common/money';
import { TXN_OPTIONS } from '../common/db';
import { istDayRange } from '../common/date';

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private stock: StockService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateProductionDto, userId: string) {
    const output = await this.prisma.material.findUnique({ where: { id: dto.materialId } });
    if (!output) throw new NotFoundException('Output material not found');

    const inputMaterials = await this.prisma.material.findMany({
      where: { id: { in: dto.inputs.map((i) => i.materialId) } },
    });
    const materialById = new Map(inputMaterials.map((m) => [m.id, m]));

    let inputCost = 0;
    const inputRows = dto.inputs.map((i) => {
      const material = materialById.get(i.materialId);
      if (!material) throw new NotFoundException(`Input material ${i.materialId} not found`);
      if (material.id === output.id) {
        throw new BadRequestException('The output material can\'t also be an input.');
      }
      // Negative stock is allowed — yards sometimes mix ahead of recording the raw materials.
      const rate = Number(material.purchaseRate ?? material.defaultRate ?? 0);
      inputCost += i.quantity * rate;
      return { materialId: i.materialId, quantity: i.quantity, rate };
    });

    // Weighted average: blend this batch's input cost with whatever value of the
    // output material is already in stock, so leftover stock at a different cost
    // doesn't get silently overwritten.
    const existingValue = Number(output.currentStock) * Number(output.purchaseRate ?? 0);
    const newTotalQty = Number(output.currentStock) + dto.quantity;
    const weightedRate = newTotalQty > 0 ? (existingValue + inputCost) / newTotalQty : 0;
    const costPerUnit = round2(dto.costPerUnit ?? weightedRate);

    const date = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const production = await tx.production.create({
        data: {
          date,
          materialId: dto.materialId,
          quantity: dto.quantity,
          costPerUnit,
          notes: dto.notes,
          createdById: userId,
          inputs: { create: inputRows },
        },
        include: { inputs: { include: { material: { select: { name: true, unit: true } } } } },
      });

      for (const row of inputRows) {
        await this.stock.apply(tx, {
          materialId: row.materialId,
          direction: StockDirection.OUT,
          quantity: row.quantity,
          refType: 'PRODUCTION',
          refId: production.id,
          date,
        });
      }
      await this.stock.apply(tx, {
        materialId: dto.materialId,
        direction: StockDirection.IN,
        quantity: dto.quantity,
        refType: 'PRODUCTION',
        refId: production.id,
        date,
      });
      await tx.material.update({ where: { id: dto.materialId }, data: { purchaseRate: costPerUnit } });

      await this.audit.log(
        {
          entityType: 'PRODUCTION',
          entityId: production.id,
          action: AuditAction.CREATE,
          summary: `Mixed ${dto.quantity} ${output.unit.toLowerCase()} of ${output.name} from ${inputRows
            .map((r) => `${r.quantity} ${materialById.get(r.materialId)!.unit.toLowerCase()} ${materialById.get(r.materialId)!.name}`)
            .join(' + ')}`,
          after: production,
          userId,
        },
        tx,
      );

      return production;
    }, TXN_OPTIONS);
  }

  list(params: { from?: string; to?: string; limit?: number }) {
    return this.prisma.production.findMany({
      where: {
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
        material: { select: { name: true, unit: true } },
        inputs: { include: { material: { select: { name: true, unit: true } } } },
        createdBy: { select: { name: true } },
      },
    });
  }

  async findOne(id: string) {
    const production = await this.prisma.production.findUnique({
      where: { id },
      include: {
        material: { select: { name: true, unit: true } },
        inputs: { include: { material: { select: { name: true, unit: true } } } },
        createdBy: { select: { name: true } },
      },
    });
    if (!production) throw new NotFoundException('Production batch not found');
    return production;
  }

  /** Reverses a batch's stock effects: inputs go back IN, the output goes back OUT. */
  private async reverseEffects(
    tx: Prisma.TransactionClient,
    existing: { id: string; materialId: string; quantity: Prisma.Decimal | number },
    inputs: { materialId: string; quantity: Prisma.Decimal | number }[],
    refType: string,
  ) {
    for (const row of inputs) {
      await this.stock.apply(tx, {
        materialId: row.materialId,
        direction: StockDirection.IN,
        quantity: Number(row.quantity),
        refType,
        refId: existing.id,
        date: new Date(),
      });
    }
    await this.stock.apply(tx, {
      materialId: existing.materialId,
      direction: StockDirection.OUT,
      quantity: Number(existing.quantity),
      refType,
      refId: existing.id,
      date: new Date(),
    });
  }

  /** Cancels a batch and reverses its stock movements. The output material's rate
   *  is left as-is — a weighted-average blend can't be cleanly un-blended. */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.production.findUnique({ where: { id }, include: { inputs: true } });
    if (!existing) throw new NotFoundException('Production batch not found');
    if (existing.status === TxnStatus.CANCELLED) return existing;

    return this.prisma.$transaction(async (tx) => {
      await this.reverseEffects(tx, existing, existing.inputs, 'PRODUCTION_UNDO');

      const production = await tx.production.update({ where: { id }, data: { status: TxnStatus.CANCELLED } });
      await this.audit.log(
        {
          entityType: 'PRODUCTION',
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Production batch deleted — reversed ${existing.quantity} produced and its inputs`,
          before: existing,
          userId,
        },
        tx,
      );
      return production;
    }, TXN_OPTIONS);
  }

  /** Edit a batch: reverses its old stock effect, then recomputes and reapplies with the new values. */
  async update(id: string, dto: UpdateProductionDto, userId: string) {
    const existing = await this.prisma.production.findUnique({ where: { id }, include: { inputs: true } });
    if (!existing) throw new NotFoundException('Production batch not found');
    if (existing.status === TxnStatus.CANCELLED) {
      throw new BadRequestException('This batch was deleted and cannot be edited.');
    }

    const materialId = dto.materialId ?? existing.materialId;
    const output = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!output) throw new NotFoundException('Output material not found');

    const rawInputs = dto.inputs ?? existing.inputs.map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity) }));
    const inputMaterials = await this.prisma.material.findMany({
      where: { id: { in: rawInputs.map((i) => i.materialId) } },
    });
    const materialById = new Map(inputMaterials.map((m) => [m.id, m]));

    const quantity = dto.quantity ?? Number(existing.quantity);
    const date = dto.date ? new Date(dto.date) : existing.date;

    return this.prisma.$transaction(async (tx) => {
      // Reverse the old effect first so the weighted-average recompute below sees
      // the output material's stock/value as if this batch never happened.
      await this.reverseEffects(tx, existing, existing.inputs, 'PRODUCTION_EDIT_UNDO');

      const outputAfterReversal = await tx.material.findUnique({ where: { id: materialId } });

      let inputCost = 0;
      const inputRows = rawInputs.map((i) => {
        const material = materialById.get(i.materialId);
        if (!material) throw new NotFoundException(`Input material ${i.materialId} not found`);
        if (material.id === materialId) {
          throw new BadRequestException('The output material can\'t also be an input.');
        }
        const rate = Number(material.purchaseRate ?? material.defaultRate ?? 0);
        inputCost += i.quantity * rate;
        return { materialId: i.materialId, quantity: i.quantity, rate };
      });

      const existingValue = Number(outputAfterReversal!.currentStock) * Number(outputAfterReversal!.purchaseRate ?? 0);
      const newTotalQty = Number(outputAfterReversal!.currentStock) + quantity;
      const weightedRate = newTotalQty > 0 ? (existingValue + inputCost) / newTotalQty : 0;
      const costPerUnit = round2(dto.costPerUnit ?? weightedRate);

      await tx.productionInput.deleteMany({ where: { productionId: id } });
      const production = await tx.production.update({
        where: { id },
        data: {
          materialId,
          quantity,
          costPerUnit,
          date,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          inputs: { create: inputRows },
        },
        include: { inputs: { include: { material: { select: { name: true, unit: true } } } } },
      });

      for (const row of inputRows) {
        await this.stock.apply(tx, {
          materialId: row.materialId,
          direction: StockDirection.OUT,
          quantity: row.quantity,
          refType: 'PRODUCTION',
          refId: production.id,
          date,
        });
      }
      await this.stock.apply(tx, {
        materialId,
        direction: StockDirection.IN,
        quantity,
        refType: 'PRODUCTION',
        refId: production.id,
        date,
      });
      await tx.material.update({ where: { id: materialId }, data: { purchaseRate: costPerUnit } });

      await this.audit.log(
        {
          entityType: 'PRODUCTION',
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Production batch edited — ${output.name} ${Number(existing.quantity)} → ${quantity} ${output.unit.toLowerCase()}`,
          before: existing,
          after: production,
          userId,
        },
        tx,
      );

      return production;
    }, TXN_OPTIONS);
  }
}
