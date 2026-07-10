import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface LogParams {
  entityType: string;
  entityId: string;
  action: AuditAction;
  summary: string;
  before?: unknown;
  after?: unknown;
  userId: string;
}

/** Strip Decimal/Date instances down to plain JSON before storing in a Json column. */
function toPlain(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Record an audit entry. Pass `tx` to log inside the same DB transaction as the mutation. */
  async log(p: LogParams, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        entityType: p.entityType,
        entityId: p.entityId,
        action: p.action,
        summary: p.summary,
        before: toPlain(p.before),
        after: toPlain(p.after),
        userId: p.userId,
      },
    });
  }

  list(params: { entityType?: string; limit?: number }) {
    return this.prisma.auditLog.findMany({
      where: params.entityType ? { entityType: params.entityType } : {},
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 300,
      include: { user: { select: { name: true, role: true } } },
    });
  }
}
