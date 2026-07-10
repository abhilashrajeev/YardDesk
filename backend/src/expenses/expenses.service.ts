import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';
import { round2 } from '../common/money';
import { istDayRange } from '../common/date';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateExpenseDto, userId: string) {
    const expense = await this.prisma.expense.create({
      data: {
        category: dto.category,
        description: dto.description,
        amount: round2(dto.amount),
        mode: dto.mode ?? 'CASH',
        date: dto.date ? new Date(dto.date) : new Date(),
        createdById: userId,
      },
    });
    await this.audit.log({
      entityType: 'EXPENSE',
      entityId: expense.id,
      action: AuditAction.CREATE,
      summary: `Expense recorded: ${expense.category} — ₹${expense.amount}`,
      after: expense,
      userId,
    });
    return expense;
  }

  list(params: { from?: string; to?: string; limit?: number }) {
    return this.prisma.expense.findMany({
      where: {
        deletedAt: null,
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
      take: params.limit ?? 200,
      include: { createdBy: { select: { name: true } } },
    });
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || expense.deletedAt) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto, userId: string) {
    const before = await this.findOne(id);
    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        amount: dto.amount !== undefined ? round2(dto.amount) : undefined,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
    await this.audit.log({
      entityType: 'EXPENSE',
      entityId: id,
      action: AuditAction.UPDATE,
      summary: `Expense edited: ${expense.category} — ₹${expense.amount}`,
      before,
      after: expense,
      userId,
    });
    return expense;
  }

  async remove(id: string, userId: string) {
    const before = await this.findOne(id);
    const expense = await this.prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      entityType: 'EXPENSE',
      entityId: id,
      action: AuditAction.DELETE,
      summary: `Expense deleted: ${before.category} — ₹${before.amount}`,
      before,
      userId,
    });
    return expense;
  }

  /** Categories aren't a separate table — renaming means relabeling every expense that used the old name. */
  async renameCategory(from: string, to: string, userId: string) {
    const { count } = await this.prisma.expense.updateMany({
      where: { category: from },
      data: { category: to },
    });
    await this.audit.log({
      entityType: 'EXPENSE',
      entityId: 'category',
      action: AuditAction.UPDATE,
      summary: `Expense category renamed: "${from}" → "${to}" (${count} expense${count === 1 ? '' : 's'})`,
      userId,
    });
    return { count };
  }

  /** Only lets go of a category once nothing references it — deleting isn't the same as bulk-deleting expenses. */
  async removeCategory(name: string, userId: string) {
    const count = await this.prisma.expense.count({ where: { category: name, deletedAt: null } });
    if (count > 0) {
      throw new BadRequestException(
        `${count} expense${count === 1 ? '' : 's'} still use${count === 1 ? 's' : ''} "${name}" — rename it instead, or delete those expenses first.`,
      );
    }
    await this.audit.log({
      entityType: 'EXPENSE',
      entityId: 'category',
      action: AuditAction.DELETE,
      summary: `Expense category removed: "${name}"`,
      userId,
    });
    return { success: true };
  }
}
