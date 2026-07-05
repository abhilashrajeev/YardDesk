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

  /** Parties with outstanding balance (> 0). */
  async outstanding(partyType: PartyType) {
    if (partyType === PartyType.CUSTOMER) {
      const customers = await this.prisma.customer.findMany({
        where: { isActive: true },
      });
      const rows = await Promise.all(
        customers.map(async (c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          balance: await this.currentBalance(this.prisma, PartyType.CUSTOMER, c.id),
        })),
      );
      return rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
    }
    const vendors = await this.prisma.vendor.findMany({
      where: { isActive: true },
    });
    const rows = await Promise.all(
      vendors.map(async (v) => ({
        id: v.id,
        name: v.name,
        phone: v.phone,
        balance: await this.currentBalance(this.prisma, PartyType.VENDOR, undefined, v.id),
      })),
    );
    return rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  }
}
