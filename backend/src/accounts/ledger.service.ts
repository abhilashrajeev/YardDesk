import { Injectable } from '@nestjs/common';
import { Prisma, PartyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/money';

interface PostParams {
  partyType: PartyType;
  customerId?: string;
  vendorId?: string;
  description: string;
  debit?: number;
  credit?: number;
  refType?: string;
  refId?: string;
  date?: Date;
}

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Post a ledger entry inside a transaction and return the new running balance.
   * Balance convention (positive = outstanding):
   *   CUSTOMER — amount they owe us:  balance = prev + debit - credit
   *   VENDOR   — amount we owe them:  balance = prev + credit - debit
   * So a sale debits the customer; a purchase credits the vendor;
   * payments received credit the customer; payments made debit the vendor.
   */
  async post(tx: Prisma.TransactionClient, p: PostParams): Promise<number> {
    const debit = round2(p.debit ?? 0);
    const credit = round2(p.credit ?? 0);
    const prev = await this.currentBalance(tx, p.partyType, p.customerId, p.vendorId);
    const newBalance =
      p.partyType === PartyType.CUSTOMER
        ? round2(prev + debit - credit)
        : round2(prev + credit - debit);

    await tx.ledgerEntry.create({
      data: {
        partyType: p.partyType,
        customerId: p.customerId,
        vendorId: p.vendorId,
        description: p.description,
        debit,
        credit,
        balance: newBalance,
        refType: p.refType,
        refId: p.refId,
        ...(p.date ? { date: p.date } : {}),
      },
    });
    return newBalance;
  }

  private async currentBalance(
    tx: Prisma.TransactionClient | PrismaService,
    partyType: PartyType,
    customerId?: string,
    vendorId?: string,
  ): Promise<number> {
    const where =
      partyType === PartyType.CUSTOMER ? { customerId } : { vendorId };
    const last = await tx.ledgerEntry.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
    if (last) return Number(last.balance);
    // No entries yet — start from the party's opening balance.
    if (partyType === PartyType.CUSTOMER) {
      const c = await tx.customer.findUnique({ where: { id: customerId } });
      return c ? Number(c.openingBalance) : 0;
    }
    const v = await tx.vendor.findUnique({ where: { id: vendorId } });
    return v ? Number(v.openingBalance) : 0;
  }

  async getLedger(partyType: PartyType, id: string) {
    const where =
      partyType === PartyType.CUSTOMER ? { customerId: id } : { vendorId: id };
    const [entries, balance] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where, orderBy: { createdAt: 'asc' } }),
      this.currentBalance(
        this.prisma,
        partyType,
        partyType === PartyType.CUSTOMER ? id : undefined,
        partyType === PartyType.VENDOR ? id : undefined,
      ),
    ]);
    return { balance, entries };
  }

  /** Parties with outstanding balance (> 0). Single query per side instead of one-per-party. */
  async outstanding(partyType: PartyType) {
    if (partyType === PartyType.CUSTOMER) {
      const [customers, latest] = await Promise.all([
        this.prisma.customer.findMany({ where: { isActive: true } }),
        this.prisma.$queryRaw<{ customerId: string; balance: Prisma.Decimal }[]>`
          SELECT DISTINCT ON ("customerId") "customerId", balance
          FROM "LedgerEntry"
          WHERE "customerId" IS NOT NULL
          ORDER BY "customerId", "createdAt" DESC
        `,
      ]);
      const byId = new Map(latest.map((l) => [l.customerId, Number(l.balance)]));
      const rows = customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: byId.has(c.id) ? byId.get(c.id)! : Number(c.openingBalance),
      }));
      return rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
    }
    const [vendors, latest] = await Promise.all([
      this.prisma.vendor.findMany({ where: { isActive: true } }),
      this.prisma.$queryRaw<{ vendorId: string; balance: Prisma.Decimal }[]>`
        SELECT DISTINCT ON ("vendorId") "vendorId", balance
        FROM "LedgerEntry"
        WHERE "vendorId" IS NOT NULL
        ORDER BY "vendorId", "createdAt" DESC
      `,
    ]);
    const byId = new Map(latest.map((l) => [l.vendorId, Number(l.balance)]));
    const rows = vendors.map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      balance: byId.has(v.id) ? byId.get(v.id)! : Number(v.openingBalance),
    }));
    return rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  }
}
