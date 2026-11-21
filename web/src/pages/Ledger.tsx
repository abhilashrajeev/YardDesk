import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate, todayIST } from '../lib/hooks';
import { downloadCsv } from '../lib/csv';
import { downloadLedgerPdf } from '../lib/ledgerPdf';
import { Icon } from '../components/Icon';
import ExportCsvButton from '../components/ExportCsvButton';
import Modal from '../components/Modal';
import PeriodFilter, { defaultPeriodState, periodRange, periodLabel } from '../components/PeriodFilter';
import CustomerPicker from '../components/CustomerPicker';
import VendorPicker from '../components/VendorPicker';
import SaleDetail from '../components/SaleDetail';
import PurchaseDetail from '../components/PurchaseDetail';
import { useAuth } from '../auth/AuthContext';
import type { Customer, Vendor, PaymentMode } from '../types';

interface LedgerEntryRow {
  id: string;
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  refType?: string | null;
  refId?: string | null;
}

interface LedgerResponse {
  balance: number;
  entries: LedgerEntryRow[];
  name: string;
  phone: string | null;
  openingBalance: number;
}

/** The IST business date ('YYYY-MM-DD') of an entry's timestamp. Business dates are
 *  stored at UTC midnight, which this leaves unchanged; a raw timestamp (e.g. an older
 *  entry stamped at the moment it was posted) lands on its correct IST day instead of
 *  the UTC one, which is a day early for anything posted between 00:00 and 05:30 IST. */
function istDateKey(iso: string) {
  return new Date(Date.parse(iso) + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 'SALE_REVERSAL' -> 'SALE', 'PAYMENT_RESTORE' -> 'PAYMENT', 'SALE' -> 'SALE'. */
function baseType(refType: string) {
  return refType.replace(/_(REVERSAL|RESTORE)$/, '');
}

/** Show every transaction once, as it stands now — never the bookkeeping behind an edit.
 *  Editing or deleting a sale, purchase or payment posts an undo of the old entry (and,
 *  for an edit, a fresh one); restoring posts a redo. All of these share the record's
 *  refId, so they're netted into a single line:
 *  - an edited bill shows once, with its current amount and date;
 *  - a deleted bill or voided payment nets to zero and disappears;
 *  - a restored bill shows once, as the bill;
 *  - a payment auto-split across several bills (its splits share one refId) reads as the
 *    single amount the user entered.
 *  Working from the net per refId keeps the figures exact even in odd cases, e.g. one
 *  split of a batch payment voided — that just shows the remaining amount. */
function collapseTransactions(entries: LedgerEntryRow[]): LedgerEntryRow[] {
  const key = (e: LedgerEntryRow) => (e.refId && e.refType ? `${baseType(e.refType)}:${e.refId}` : null);
  const net = new Map<string, number>();
  const current = new Map<string, LedgerEntryRow>(); // latest original/edited entry
  const kept: LedgerEntryRow[] = [];
  for (const e of entries) {
    const k = key(e);
    if (!k) { kept.push(e); continue; }
    if (!net.has(k)) kept.push(e); // first occurrence holds the row's position
    net.set(k, (net.get(k) ?? 0) + Number(e.credit) - Number(e.debit));
    if (e.refType === baseType(e.refType!)) current.set(k, e);
  }
  return kept.flatMap((e) => {
    const k = key(e);
    if (!k) return [e];
    const s = Math.round((net.get(k) ?? 0) * 100) / 100;
    if (Math.abs(s) < 0.005) return [];
    const base = current.get(k) ?? e;
    return [{
      ...base,
      id: e.id,
      refType: baseType(base.refType!),
      // The edit marker was there to explain the reversal rows; with those gone it's noise.
      description: base.description.replace(/\s*\(edited\)$/, ''),
      credit: String(s > 0 ? s : 0),
      debit: String(s < 0 ? -s : 0),
    }];
  });
}

/** Entries come back ordered by when they were POSTED, not by their transaction date —
 *  a backdated payment entered after a later-dated sale otherwise shows up out of order
 *  on screen. Re-sort by transaction date (same-date entries keep their relative order)
 *  and recompute the running balance to match, since the stored `balance` on each row
 *  is only meaningful in original posting-order sequence. */
function sortByDateAndRebalance(
  entries: LedgerEntryRow[],
  opening: number,
  partyType: 'CUSTOMER' | 'VENDOR',
): LedgerEntryRow[] {
  const withIndex = entries.map((e, i) => ({ e, i }));
  withIndex.sort((a, b) => istDateKey(a.e.date).localeCompare(istDateKey(b.e.date)) || a.i - b.i);

  let running = opening;
  return withIndex.map(({ e }) => {
    const debit = Number(e.debit);
    const credit = Number(e.credit);
    running = partyType === 'CUSTOMER' ? running + debit - credit : running + credit - debit;
    return { ...e, balance: String(running) };
  });
}

/** Human label for a ledger entry's voucher type — reversal/restore entries share the
 *  same underlying record, so they're distinguished but still open the same detail view. */
function voucherLabel(refType?: string | null) {
  switch (refType) {
    case 'SALE': return 'Sale';
    case 'SALE_REVERSAL': return 'Sale (reversed)';
    case 'SALE_RESTORE': return 'Sale (restored)';
    case 'PURCHASE': return 'Purchase';
    case 'PURCHASE_REVERSAL': return 'Purchase (reversed)';
    case 'PURCHASE_RESTORE': return 'Purchase (restored)';
    case 'PAYMENT': return 'Payment';
    case 'PAYMENT_REVERSAL': return 'Payment (voided)';
    case 'PAYMENT_RESTORE': return 'Payment (restored)';
    default: return refType ?? '—';
  }
}

export default function Ledger() {
  const { user } = useAuth();
  const canCreatePayment = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('PAYMENTS');
  const { data: customers, setData: setCustomers } = useFetch<Customer[]>('/customers');
  const { data: vendors, setData: setVendors } = useFetch<Vendor[]>('/vendors');

  // Supports deep-linking from a customer/vendor's own page, e.g. /ledger?type=VENDOR&id=abc123.
  const [searchParams] = useSearchParams();
  const [partyType, setPartyType] = useState<'CUSTOMER' | 'VENDOR'>(
    searchParams.get('type') === 'VENDOR' ? 'VENDOR' : 'CUSTOMER',
  );
  const [partyId, setPartyId] = useState(searchParams.get('id') ?? '');
  const [period, setPeriod] = useState(defaultPeriodState());
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);
  const [viewPurchaseId, setViewPurchaseId] = useState<string | null>(null);

  // Re-sync if the deep-link params change (e.g. navigating here again for a different party).
  useEffect(() => {
    const t = searchParams.get('type') === 'VENDOR' ? 'VENDOR' : 'CUSTOMER';
    const id = searchParams.get('id') ?? '';
    if (id) {
      setPartyType(t);
      setPartyId(id);
    }
  }, [searchParams]);

  function switchType(t: 'CUSTOMER' | 'VENDOR') {
    setPartyType(t);
    setPartyId('');
  }

  const ledgerUrl = partyId
    ? partyType === 'CUSTOMER'
      ? `/accounts/customers/${partyId}/ledger`
      : `/accounts/vendors/${partyId}/ledger`
    : null;
  const { data: ledger, loading, refetch: refetchLedger } = useFetch<LedgerResponse>(ledgerUrl);

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payMode, setPayMode] = useState<PaymentMode>('CASH');
  const [payAmount, setPayAmount] = useState(0);
  const [payReference, setPayReference] = useState('');
  const [payDate, setPayDate] = useState(todayIST());
  const [payAutoApply, setPayAutoApply] = useState(true);
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');

  function openAddPayment() {
    setPayMode('CASH');
    setPayAmount(0);
    setPayReference('');
    setPayDate(todayIST());
    setPayAutoApply(true);
    setPayError('');
    setShowAddPayment(true);
  }

  async function submitAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (payAmount <= 0) return setPayError('Enter an amount.');
    setPaySaving(true);
    setPayError('');
    try {
      await api.post('/accounts/payments', {
        partyType,
        customerId: partyType === 'CUSTOMER' ? partyId : undefined,
        vendorId: partyType === 'VENDOR' ? partyId : undefined,
        direction: partyType === 'CUSTOMER' ? 'IN' : 'OUT',
        mode: payMode,
        amount: Number(payAmount),
        reference: payReference || undefined,
        date: payDate,
        autoApply: payAutoApply,
      });
      setShowAddPayment(false);
      refetchLedger();
    } catch (err) {
      setPayError(apiError(err));
    } finally {
      setPaySaving(false);
    }
  }

  const { from, to } = periodRange(period);
  const allEntries = ledger?.entries ?? [];
  const filtered = allEntries.filter((e) => {
    const d = istDateKey(e.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  // Opening/closing are summed from each entry's amount BY DATE — never read from the
  // stored running `balance`, which is the balance at the moment an entry was posted.
  // Entries are routinely posted out of date order (sales first, purchases later), so the
  // stored value at a period's edge counts entries from other dates and reads wrong.
  const signed = (e: LedgerEntryRow) =>
    partyType === 'CUSTOMER' ? Number(e.debit) - Number(e.credit) : Number(e.credit) - Number(e.debit);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const openingForRange = round2(
    (ledger?.openingBalance ?? 0) +
      (from ? allEntries.filter((e) => istDateKey(e.date) < from).reduce((s, e) => s + signed(e), 0) : 0),
  );
  const closingBalance = round2(openingForRange + filtered.reduce((s, e) => s + signed(e), 0));
  const balanceColor = closingBalance > 0 ? 'var(--red)' : closingBalance < 0 ? 'var(--green)' : 'var(--text-2)';
  const balanceStatus = closingBalance > 0
    ? (partyType === 'CUSTOMER' ? 'Receivable — they owe us' : 'Payable — we owe them')
    : closingBalance < 0
      ? 'Advance / credit'
      : 'Settled';

  // What's actually displayed (table, CSV, PDF) — same net figures, with each transaction
  // as one line in its current state, in true transaction-date order.
  const displayEntries = sortByDateAndRebalance(collapseTransactions(filtered), openingForRange, partyType);
  // The Total Debit/Credit cards must match what's actually listed below them.
  const totalDebit = displayEntries.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = displayEntries.reduce((s, e) => s + Number(e.credit), 0);

  function exportCsv() {
    if (!ledger) return;
    downloadCsv(
      `${ledger.name}-ledger-${from ?? 'all'}-${to ?? 'all'}`,
      [
        { header: 'Date', value: (e: LedgerEntryRow) => fmtDate(e.date) },
        { header: 'Voucher', value: (e: LedgerEntryRow) => voucherLabel(e.refType) },
        { header: 'Description', value: (e: LedgerEntryRow) => e.description },
        { header: 'Debit', value: (e: LedgerEntryRow) => e.debit },
        { header: 'Credit', value: (e: LedgerEntryRow) => e.credit },
        { header: 'Balance', value: (e: LedgerEntryRow) => e.balance },
      ],
      displayEntries,
    );
  }

  // A nicer "01 Aug 2026 - 14 Aug 2026" style range when one's active, matching the
  // format of the statement PDFs vendors/customers are already used to seeing.
  const pdfPeriodLabel = from && to ? `${fmtDate(from)} - ${fmtDate(to)}` : periodLabel(period);
  const openingDateLabel = from ? fmtDate(from) : displayEntries.length ? fmtDate(displayEntries[0].date) : 'account opening';

  function downloadPdf() {
    if (!ledger) return;

    // Exactly what's on screen: each transaction once in its current state (no edit or
    // delete bookkeeping), in date order, with the running balance already recomputed.
    const entries = displayEntries.map((e) => ({
      date: e.date,
      voucher: voucherLabel(e.refType),
      description: e.description,
      debit: Number(e.debit),
      credit: Number(e.credit),
      balance: Number(e.balance),
    }));

    downloadLedgerPdf({
      partyName: ledger.name,
      partyPhone: ledger.phone,
      positiveMeansTheyOweUs: partyType === 'CUSTOMER',
      periodLabel: pdfPeriodLabel,
      openingBalance: openingForRange,
      openingDateLabel,
      entries,
      totalDebit: entries.reduce((s, e) => s + e.debit, 0),
      totalCredit: entries.reduce((s, e) => s + e.credit, 0),
      closingBalance: entries.length ? entries[entries.length - 1].balance : openingForRange,
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Ledger</h2>
          <div className="sub">Full statement of account — running balance, every debit and credit, for any customer or vendor</div>
        </div>
      </div>

      <div className="panel no-print picker-panel">
        <div className="body">
          <div className="row">
            <div>
              <label>Party type</label>
              <select value={partyType} onChange={(e) => switchType(e.target.value as 'CUSTOMER' | 'VENDOR')}>
                <option value="CUSTOMER">Customer (money in)</option>
                <option value="VENDOR">Vendor (money out)</option>
              </select>
            </div>
            <div>
              <label>{partyType === 'CUSTOMER' ? 'Customer' : 'Vendor'}</label>
              {partyType === 'CUSTOMER' ? (
                <CustomerPicker
                  customers={customers ?? []}
                  value={partyId}
                  onChange={setPartyId}
                  onCreated={(c) => setCustomers([...(customers ?? []), c])}
                />
              ) : (
                <VendorPicker
                  vendors={vendors ?? []}
                  value={partyId}
                  onChange={setPartyId}
                  onCreated={(v) => setVendors([...(vendors ?? []), v])}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {!partyId && (
        <div className="panel">
          <div className="muted" style={{ padding: 32, textAlign: 'center' }}>
            Search and select a {partyType === 'CUSTOMER' ? 'customer' : 'vendor'} above to view their ledger.
          </div>
        </div>
      )}

      {partyId && loading && (
        <div className="panel">
          <div className="muted" style={{ padding: 32, textAlign: 'center' }}>Loading…</div>
        </div>
      )}

      {partyId && ledger && (
        <>
          <div className="cards">
            <div className="stat">
              <div className="stat-icon blue"><Icon name="book" /></div>
              <div>
                <div className="label">Opening Balance</div>
                <div className="value">{money(openingForRange)}</div>
                <div className="sub">as of {periodLabel(period)}</div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon red"><Icon name="up" /></div>
              <div>
                <div className="label">Total Debit</div>
                <div className="value">{money(totalDebit)}</div>
                <div className="sub">{displayEntries.filter((e) => Number(e.debit) > 0).length} entries</div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon green"><Icon name="down" /></div>
              <div>
                <div className="label">Total Credit</div>
                <div className="value">{money(totalCredit)}</div>
                <div className="sub">{displayEntries.filter((e) => Number(e.credit) > 0).length} entries</div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon amber"><Icon name="wallet" /></div>
              <div>
                <div className="label">Closing Balance</div>
                <div className="value" style={{ color: balanceColor }}>{money(closingBalance)}</div>
                <div className="sub">{balanceStatus}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="between no-print" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
              <div className="flex" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{ledger.name}</strong>
                {ledger.phone && <span className="muted" style={{ fontSize: 13 }}>{ledger.phone}</span>}
                {canCreatePayment && (
                  <button type="button" className="btn sm no-print" onClick={openAddPayment}>Add Payment</button>
                )}
              </div>
              <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <PeriodFilter value={period} onChange={setPeriod} allowRecent />
                <button type="button" className="btn ghost sm" onClick={() => window.print()}>Print</button>
                <ExportCsvButton disabled={!filtered.length} onExport={exportCsv} label="Export CSV" />
                <button type="button" className="btn" disabled={!filtered.length} onClick={downloadPdf}>Download PDF</button>
              </div>
            </div>
            <div className="body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher</th>
                    <th>Description</th>
                    <th className="num">Debit</th>
                    <th className="num">Credit</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} style={{ fontWeight: 600 }}>Opening Balance</td>
                    <td className="num" style={{ fontWeight: 700 }}>{money(openingForRange)}</td>
                  </tr>
                  {displayEntries.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtDate(e.date)}</td>
                      <td>
                        {e.refType?.startsWith('SALE') && e.refId ? (
                          <button type="button" className="btn ghost sm no-print" onClick={() => setViewSaleId(e.refId!)}>
                            {voucherLabel(e.refType)}
                          </button>
                        ) : e.refType?.startsWith('PURCHASE') && e.refId ? (
                          <button type="button" className="btn ghost sm no-print" onClick={() => setViewPurchaseId(e.refId!)}>
                            {voucherLabel(e.refType)}
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: 12.5 }}>{voucherLabel(e.refType)}</span>
                        )}
                        <span className="print-only" style={{ fontSize: 12.5 }}>{voucherLabel(e.refType)}</span>
                      </td>
                      <td>{e.description}</td>
                      <td className="num">{Number(e.debit) ? money(e.debit) : '—'}</td>
                      <td className="num">{Number(e.credit) ? money(e.credit) : '—'}</td>
                      <td className="num">{money(e.balance)}</td>
                    </tr>
                  ))}
                  {!displayEntries.length && (
                    <tr>
                      <td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>No transactions in this period.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td colSpan={3}>Closing Balance</td>
                    <td className="num">{money(totalDebit)}</td>
                    <td className="num">{money(totalCredit)}</td>
                    <td className="num" style={{ color: balanceColor }}>{money(closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {viewSaleId && <SaleDetail id={viewSaleId} onClose={() => setViewSaleId(null)} />}
      {viewPurchaseId && <PurchaseDetail id={viewPurchaseId} onClose={() => setViewPurchaseId(null)} />}

      {showAddPayment && ledger && (
        <Modal title={`Add Payment — ${ledger.name}`} onClose={() => setShowAddPayment(false)}>
          <form onSubmit={submitAddPayment}>
            <div className="row">
              <div>
                <label>Mode</label>
                <select value={payMode} onChange={(e) => setPayMode(e.target.value as PaymentMode)}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div>
                <label>Amount</label>
                <input type="number" value={payAmount || ''} onChange={(e) => setPayAmount(Number(e.target.value))} autoFocus />
              </div>
              <div>
                <label>Reference (optional)</label>
                <input value={payReference} onChange={(e) => setPayReference(e.target.value)} />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} max={todayIST()} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 9 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={payAutoApply} onChange={(e) => setPayAutoApply(e.target.checked)} />
                <label style={{ margin: 0 }} title="On: split across the oldest open bills first. Off: one lump payment against the total outstanding, not tied to a specific bill.">
                  Apply to outstanding bills
                </label>
              </div>
            </div>
            {payError && <div className="err">{payError}</div>}
            <div className="between" style={{ marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowAddPayment(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={paySaving}>{paySaving ? 'Saving…' : 'Record Payment'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
