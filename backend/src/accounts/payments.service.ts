import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, PartyType, PaymentDirection, PaymentMode, Prisma, TxnStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentDto, UpdatePaymentDto, AllocatePaymentDto } from './payments.dto';
import { round2 } from '../common/money';
import { TXN_OPTIONS, isUniqueViolation } from '../common/db';
import { istDayRange } from '../common/date';

/** The fields of a Payment the ledger helpers below need. */
type PaymentRef = {
  id: string;
  partyType: PartyType;
  customerId: string | null;
  vendorId: string | null;
  amount: unknown;
  mode: PaymentMode;
  date: Date;
};

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private audit: AuditService,
  ) {}

  /**
   * Outstanding invoices for a party, oldest first, each with its remaining
   * balance — used to auto-apply a new payment FIFO-style. Only invoices with
   * a real balance are returned (cash/UPI/bank sales are already settled at
   * creation, so they never appear here).
   */
  private async getOutstandingInvoices(
    tx: Prisma.TransactionClient,
    dto: CreatePaymentDto,
  ): Promise<{ id: string; balance: number }[]> {
    if (dto.partyType === PartyType.CUSTOMER) {
      const sales = await tx.sale.findMany({
        where: { customerId: dto.customerId, status: TxnStatus.CONFIRMED, paymentMode: 'CREDIT' },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: { payments: { where: { voided: false }, select: { amount: true } } },
      });
      return sales
        .map((s) => ({
          id: s.id,
          balance: round2(Number(s.total) - s.payments.reduce((sum, p) => sum + Number(p.amount), 0)),
        }))
        .filter((s) => s.balance > 0.01);
    } else {
      const purchases = await tx.purchase.findMany({
        where: { vendorId: dto.vendorId, status: TxnStatus.CONFIRMED },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: { payments: { where: { voided: false }, select: { amount: true } } },
      });
      return purchases
        .map((p) => ({
          id: p.id,
          balance: round2(Number(p.total) - p.payments.reduce((sum, x) => sum + Number(x.amount), 0)),
        }))
        .filter((p) => p.balance > 0.01);
    }
  }

  /**
   * Records a payment, auto-applying it FIFO across the party's oldest
   * unpaid bills first — splitting into multiple linked Payment rows if it's
   * bigger than any single bill's balance. Any amount left over once every
   * outstanding bill is covered becomes its own unlinked payment (an advance/
   * credit — it'll show as a negative ledger balance until used or refunded).
   */
  async create(dto: CreatePaymentDto, userId: string) {
    if (dto.clientUuid) {
      const existing = await this.prisma.payment.findUnique({
        where: { clientUuid: dto.clientUuid },
      });
      if (existing) return [existing]; // offline replay — idempotent
    }

    let remaining = round2(dto.amount);
    const date = dto.date ? new Date(dto.date) : new Date();

    if (dto.partyType === PartyType.CUSTOMER) {
      if (dto.direction !== PaymentDirection.IN)
        throw new BadRequestException('Customer payments must be direction IN');
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    } else {
      if (dto.direction !== PaymentDirection.OUT)
        throw new BadRequestException('Vendor payments must be direction OUT');
      const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
      if (!vendor) throw new NotFoundException('Vendor not found');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // autoApply: false records one lump payment against the party's overall balance —
        // not split across bills — e.g. for a customer/vendor who just wants "I paid X
        // today" reflected without picking which specific invoices it covers.
        const outstanding = dto.autoApply === false ? [] : await this.getOutstandingInvoices(tx, dto);

        // Each entry is one resulting Payment row: `undefined` invoiceId means
        // it's the unlinked leftover (an advance) rather than applied to a bill.
        const allocations: { amount: number; invoiceId?: string }[] = [];
        for (const invoice of outstanding) {
          if (remaining <= 0) break;
          const alloc = round2(Math.min(remaining, invoice.balance));
          allocations.push({ amount: alloc, invoiceId: invoice.id });
          remaining = round2(remaining - alloc);
        }
        if (remaining > 0) allocations.push({ amount: remaining });

        const created: Prisma.PaymentGetPayload<Record<string, never>>[] = [];
        // When a payment splits across several bills, every split shares the first
        // split's id as its ledger refId. That makes them one logical event: the
        // ledger displays them merged into a single line for the full amount the
        // user entered, while each split still exists as its own Payment row
        // linked to its own bill so per-bill paid/balance tracking stays correct.
        let batchRefId: string | undefined;
        for (const [i, alloc] of allocations.entries()) {
          const payment = await tx.payment.create({
            data: {
              clientUuid: i === 0 ? dto.clientUuid : undefined,
              date,
              direction: dto.direction,
              mode: dto.mode,
              amount: alloc.amount,
              reference: dto.reference,
              notes: dto.notes,
              partyType: dto.partyType,
              customerId: dto.customerId,
              vendorId: dto.vendorId,
              saleId: dto.partyType === PartyType.CUSTOMER ? alloc.invoiceId : undefined,
              purchaseId: dto.partyType === PartyType.VENDOR ? alloc.invoiceId : undefined,
              createdById: userId,
            },
          });
          if (i === 0) batchRefId = payment.id;

          if (dto.partyType === PartyType.CUSTOMER) {
            await this.ledger.post(tx, {
              partyType: PartyType.CUSTOMER,
              customerId: dto.customerId,
              description: `Payment received (${dto.mode})`,
              credit: alloc.amount,
              refType: 'PAYMENT',
              refId: batchRefId,
              date,
            });
          } else {
            await this.ledger.post(tx, {
              partyType: PartyType.VENDOR,
              vendorId: dto.vendorId,
              description: `Payment made (${dto.mode})`,
              debit: alloc.amount,
              refType: 'PAYMENT',
              refId: batchRefId,
              date,
            });
          }

          await this.audit.log(
            {
              entityType: 'PAYMENT',
              entityId: payment.id,
              action: AuditAction.CREATE,
              summary: alloc.invoiceId
                ? `Payment ${dto.partyType === PartyType.CUSTOMER ? 'received' : 'made'} — ₹${alloc.amount} (${dto.mode}), auto-applied to oldest bill`
                : `Payment ${dto.partyType === PartyType.CUSTOMER ? 'received' : 'made'} — ₹${alloc.amount} (${dto.mode})${outstanding.length ? ' (advance — no bill left to apply it to)' : ''}`,
              after: payment,
              userId,
            },
            tx,
          );

          created.push(payment);
        }

        return created;
      }, TXN_OPTIONS);
    } catch (e) {
      // Same clientUuid raced an identical earlier request (e.g. a slow request that
      // got retried) — return the payment that request saved instead of failing/duplicating.
      if (dto.clientUuid && isUniqueViolation(e)) {
        const existing = await this.prisma.payment.findUnique({
          where: { clientUuid: dto.clientUuid },
        });
        if (existing) return [existing];
      }
      throw e;
    }
  }

  list(params: {
    customerId?: string;
    vendorId?: string;
    from?: string;
    to?: string;
    limit?: number;
    // Only payments not yet linked to a specific sale/purchase invoice — used to
    // populate the "link an existing payment" picker on a sale/purchase's detail view.
    unallocated?: boolean;
  }) {
    return this.prisma.payment.findMany({
      where: {
        ...(params.customerId ? { customerId: params.customerId } : {}),
        ...(params.vendorId ? { vendorId: params.vendorId } : {}),
        ...(params.unallocated ? { saleId: null, purchaseId: null, voided: false } : {}),
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
      // Only cap the unscoped view (no date range) — capping a date-scoped query too
      // would silently under-report that period, same issue fixed on Sales/Purchases.
      take: params.from || params.to ? undefined : (params.limit ?? 100),
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
      },
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  /**
   * Post a payment's effect on its party's ledger: 'apply' / 'restore' record the money
   * moving (customer credited, vendor debited); 'reverse' cancels that out. Always dated
   * the payment's own date — a correction made today to a payment from last week belongs
   * to last week, or every date-based view (ledger periods, day close) reads it wrong.
   */
  private async postLedger(
    tx: Prisma.TransactionClient,
    payment: PaymentRef,
    kind: 'apply' | 'reverse' | 'restore',
    description: string,
  ) {
    const reverse = kind === 'reverse';
    const refType = kind === 'apply' ? 'PAYMENT' : kind === 'reverse' ? 'PAYMENT_REVERSAL' : 'PAYMENT_RESTORE';
    const amount = Number(payment.amount);
    if (payment.partyType === PartyType.CUSTOMER) {
      await this.ledger.post(tx, {
        partyType: PartyType.CUSTOMER,
        customerId: payment.customerId!,
        description,
        ...(reverse ? { debit: amount } : { credit: amount }),
        refType,
        refId: payment.id,
        date: payment.date,
      });
    } else {
      await this.ledger.post(tx, {
        partyType: PartyType.VENDOR,
        vendorId: payment.vendorId!,
        description,
        ...(reverse ? { credit: amount } : { debit: amount }),
        refType,
        refId: payment.id,
        date: payment.date,
      });
    }
  }

  private reverseLedger(tx: Prisma.TransactionClient, payment: PaymentRef) {
    return this.postLedger(tx, payment, 'reverse', `Reversal of payment (${payment.mode})`);
  }

  private editedDescription(partyType: PartyType, mode: string) {
    return `Payment ${partyType === PartyType.CUSTOMER ? 'received' : 'made'} (${mode}) (edited)`;
  }

  /** Edit a payment: reverses its old ledger effect, then reapplies with the new amount/mode. */
  async update(id: string, dto: UpdatePaymentDto, userId: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.voided) throw new BadRequestException('This payment was deleted and cannot be edited.');

    const amount = dto.amount !== undefined ? round2(dto.amount) : Number(existing.amount);
    const mode = dto.mode ?? existing.mode;

    return this.prisma.$transaction(async (tx) => {
      // The reversal lands on the payment's OLD date and the re-post on its new one, so a
      // date change moves the money between days instead of leaving it on the old one.
      await this.reverseLedger(tx, existing);

      const payment = await tx.payment.update({
        where: { id },
        data: {
          amount,
          mode,
          reference: dto.reference !== undefined ? dto.reference : existing.reference,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          date: dto.date ? new Date(dto.date) : existing.date,
        },
      });

      await this.postLedger(tx, payment, 'apply', this.editedDescription(payment.partyType, mode));

      await this.audit.log(
        {
          entityType: 'PAYMENT',
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Payment edited — ₹${Number(existing.amount)} → ₹${amount}`,
          before: existing,
          after: payment,
          userId,
        },
        tx,
      );

      return payment;
    }, TXN_OPTIONS);
  }

  /**
   * Change a payment's amount and/or date inside an existing transaction — used to keep
   * a bill's own payment in step when the bill is edited. A new amount of zero voids it.
   */
  async reviseWithinTx(
    tx: Prisma.TransactionClient,
    payment: PaymentRef,
    changes: { amount?: number; date?: Date },
    userId: string,
    reason: string,
  ) {
    const amount = round2(changes.amount ?? Number(payment.amount));
    if (amount <= 0.005) return this.voidWithinTx(tx, payment, userId, reason);

    await this.reverseLedger(tx, payment);
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { amount, date: changes.date ?? payment.date },
    });
    await this.postLedger(tx, updated, 'apply', this.editedDescription(updated.partyType, updated.mode));
    await this.audit.log(
      {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: AuditAction.UPDATE,
        summary: `Payment adjusted — ₹${Number(payment.amount)} → ₹${amount} (${reason})`,
        before: payment,
        after: updated,
        userId,
      },
      tx,
    );
    return updated;
  }

  /**
   * Move a payment to a different customer/vendor inside an existing transaction — used
   * when a bill is reassigned, so the money follows the bill instead of staying on the
   * old party as a payment they never made.
   */
  async moveToPartyWithinTx(
    tx: Prisma.TransactionClient,
    payment: PaymentRef,
    partyId: string,
    userId: string,
    reason: string,
  ) {
    await this.reverseLedger(tx, payment);
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: payment.partyType === PartyType.CUSTOMER ? { customerId: partyId } : { vendorId: partyId },
    });
    await this.postLedger(
      tx,
      updated,
      'apply',
      `Payment ${updated.partyType === PartyType.CUSTOMER ? 'received' : 'made'} (${updated.mode})`,
    );
    await this.audit.log(
      {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: AuditAction.UPDATE,
        summary: `Payment ₹${Number(payment.amount)} moved to another ${payment.partyType === PartyType.CUSTOMER ? 'customer' : 'vendor'} (${reason})`,
        before: payment,
        after: updated,
        userId,
      },
      tx,
    );
    return updated;
  }

  /** Record a payment linked to a specific bill, inside an existing transaction. */
  async createForBillWithinTx(
    tx: Prisma.TransactionClient,
    p: {
      partyType: PartyType;
      partyId: string;
      billId: string;
      amount: number;
      mode: PaymentMode;
      date: Date;
      description: string;
    },
    userId: string,
  ) {
    const customer = p.partyType === PartyType.CUSTOMER;
    const payment = await tx.payment.create({
      data: {
        date: p.date,
        direction: customer ? PaymentDirection.IN : PaymentDirection.OUT,
        mode: p.mode,
        amount: round2(p.amount),
        partyType: p.partyType,
        customerId: customer ? p.partyId : undefined,
        vendorId: customer ? undefined : p.partyId,
        saleId: customer ? p.billId : undefined,
        purchaseId: customer ? undefined : p.billId,
        createdById: userId,
      },
    });
    await this.postLedger(tx, payment, 'apply', p.description);
    await this.audit.log(
      {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: AuditAction.CREATE,
        summary: `${p.description} — ₹${round2(p.amount)} (${p.mode})`,
        after: payment,
        userId,
      },
      tx,
    );
    return payment;
  }

  /**
   * Link (or unlink, when txnId is null) a payment to a specific sale/purchase
   * invoice. Which relation gets set is inferred from the payment's partyType —
   * customer payments link to a sale, vendor payments link to a purchase. Doesn't
   * touch the ledger: the money already moved and was already posted; this only
   * changes which invoice's paid/balance figure it counts against.
   */
  async allocate(id: string, dto: AllocatePaymentDto, userId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.voided) throw new BadRequestException('This payment was deleted and cannot be linked.');

    let summary: string;
    let updated;
    if (payment.partyType === PartyType.CUSTOMER) {
      if (dto.txnId) {
        const sale = await this.prisma.sale.findUnique({ where: { id: dto.txnId } });
        if (!sale) throw new NotFoundException('Sale not found');
        if (sale.customerId !== payment.customerId) {
          throw new BadRequestException('That bill belongs to a different customer.');
        }
        if (sale.status === TxnStatus.CANCELLED) throw new BadRequestException('That bill was deleted.');
        summary = `Payment ₹${Number(payment.amount)} linked to bill ${sale.billNo ?? sale.id}`;
      } else {
        summary = `Payment ₹${Number(payment.amount)} unlinked from its bill`;
      }
      updated = await this.prisma.payment.update({ where: { id }, data: { saleId: dto.txnId } });
    } else {
      if (dto.txnId) {
        const purchase = await this.prisma.purchase.findUnique({ where: { id: dto.txnId } });
        if (!purchase) throw new NotFoundException('Purchase not found');
        if (purchase.vendorId !== payment.vendorId) {
          throw new BadRequestException('That purchase belongs to a different vendor.');
        }
        if (purchase.status === TxnStatus.CANCELLED) throw new BadRequestException('That purchase was deleted.');
        summary = `Payment ₹${Number(payment.amount)} linked to purchase ${purchase.invoiceNo ?? purchase.id}`;
      } else {
        summary = `Payment ₹${Number(payment.amount)} unlinked from its purchase`;
      }
      updated = await this.prisma.payment.update({ where: { id }, data: { purchaseId: dto.txnId } });
    }

    await this.audit.log({
      entityType: 'PAYMENT',
      entityId: id,
      action: AuditAction.UPDATE,
      summary,
      before: payment,
      after: updated,
      userId,
    });

    return updated;
  }

  /**
   * Void a payment inside an existing transaction: reverses its ledger effect
   * and marks it voided. Shared by the standalone "delete this payment" flow
   * and by Sales/Purchases cancellation (which auto-refunds any payment still
   * linked to the sale/purchase being cancelled — matching how it works in
   * real life: cancelling something already paid means giving the money back).
   */
  async voidWithinTx(
    tx: Prisma.TransactionClient,
    payment: PaymentRef,
    userId: string,
    reason?: string,
  ) {
    await this.reverseLedger(tx, payment);
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { voided: true } });
    await this.audit.log(
      {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: AuditAction.DELETE,
        summary: `Payment voided — was ₹${Number(payment.amount)} (${payment.mode})${reason ? ` (${reason})` : ''}`,
        before: payment,
        userId,
      },
      tx,
    );
    return updated;
  }

  /**
   * Reverses `voidWithinTx`: reapplies the payment's original ledger effect and
   * marks it active again. Used when restoring a cancelled sale/purchase whose
   * linked payment was auto-voided when it was cancelled.
   */
  async unvoidWithinTx(
    tx: Prisma.TransactionClient,
    payment: PaymentRef,
    userId: string,
    reason?: string,
  ) {
    await this.postLedger(tx, payment, 'restore', `Restoration of payment (${payment.mode})`);
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { voided: false } });
    await this.audit.log(
      {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: AuditAction.UPDATE,
        summary: `Payment restored — ₹${Number(payment.amount)} (${payment.mode})${reason ? ` (${reason})` : ''}`,
        after: updated,
        userId,
      },
      tx,
    );
    return updated;
  }

  /** Void (soft-delete) a payment: reverses its ledger effect and marks it voided. */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.voided) return existing;

    return this.prisma.$transaction(async (tx) => this.voidWithinTx(tx, existing, userId), TXN_OPTIONS);
  }
}
