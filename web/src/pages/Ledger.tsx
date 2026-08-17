import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFetch, money, fmtDate } from '../lib/hooks';
import { downloadCsv } from '../lib/csv';
import { downloadLedgerPdf } from '../lib/ledgerPdf';
import { Icon } from '../components/Icon';
import ExportCsvButton from '../components/ExportCsvButton';
import PeriodFilter, { defaultPeriodState, periodRange, periodLabel } from '../components/PeriodFilter';
import CustomerPicker from '../components/CustomerPicker';
import VendorPicker from '../components/VendorPicker';
import SaleDetail from '../components/SaleDetail';
import PurchaseDetail from '../components/PurchaseDetail';
import type { Customer, Vendor } from '../types';

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
  const { data: ledger, loading } = useFetch<LedgerResponse>(ledgerUrl);

  const { from, to } = periodRange(period);
  const allEntries = ledger?.entries ?? [];
  const filtered = allEntries.filter((e) => {
    const d = e.date.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  // Balance immediately before the first shown entry — the account's true opening
  // balance when nothing's filtered out, or the running balance as of the cutoff otherwise.
  const firstShownIndex = filtered.length ? allEntries.indexOf(filtered[0]) : allEntries.length;
  const openingForRange = firstShownIndex > 0 ? Number(allEntries[firstShownIndex - 1].balance) : (ledger?.openingBalance ?? 0);
  const closingBalance = filtered.length ? Number(filtered[filtered.length - 1].balance) : openingForRange;
  const totalDebit = filtered.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = filtered.reduce((s, e) => s + Number(e.credit), 0);
  const balanceColor = closingBalance > 0 ? 'var(--red)' : closingBalance < 0 ? 'var(--green)' : 'var(--text-2)';
  const balanceStatus = closingBalance > 0
    ? (partyType === 'CUSTOMER' ? 'Receivable — they owe us' : 'Payable — we owe them')
    : closingBalance < 0
      ? 'Advance / credit'
      : 'Settled';

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
      filtered,
    );
  }

  // A nicer "01 Aug 2026 - 14 Aug 2026" style range when one's active, matching the
  // format of the statement PDFs vendors/customers are already used to seeing.
  const pdfPeriodLabel = from && to ? `${fmtDate(from)} - ${fmtDate(to)}` : periodLabel(period);
  const openingDateLabel = from ? fmtDate(from) : filtered.length ? fmtDate(filtered[0].date) : 'account opening';

  function downloadPdf() {
    if (!ledger) return;

    // Group by the underlying record so an edited/voided entry only appears once, as its
    // final state — a customer/vendor statement shouldn't show the correction noise, just
    // what's actually owed. A group whose latest entry is itself a reversal means the
    // transaction was voided with nothing to replace it, so the whole group is dropped.
    const groups = new Map<string, LedgerEntryRow[]>();
    const ungrouped: LedgerEntryRow[] = [];
    for (const e of filtered) {
      if (!e.refId) { ungrouped.push(e); continue; }
      const list = groups.get(e.refId) ?? [];
      list.push(e);
      groups.set(e.refId, list);
    }
    const cleaned = [
      ...ungrouped,
      ...Array.from(groups.values())
        .map((g) => g[g.length - 1])
        .filter((e) => !e.refType?.endsWith('_REVERSAL')),
    ];

    // A statement reads naturally in transaction-date order, not entry-creation order —
    // re-sort (same-date entries keep their original relative order) and recompute the
    // running balance to match, since the stored `balance` field is only meaningful in
    // original creation-order sequence.
    const withIndex = cleaned.map((e, i) => ({ e, i }));
    withIndex.sort((a, b) => a.e.date.localeCompare(b.e.date) || a.i - b.i);

    let running = openingForRange;
    const entries = withIndex.map(({ e }) => {
      const debit = Number(e.debit);
      const credit = Number(e.credit);
      running = partyType === 'CUSTOMER' ? running + debit - credit : running + credit - debit;
      return { date: e.date, voucher: voucherLabel(e.refType), description: e.description, debit, credit, balance: running };
    });

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
                <div className="sub">{filtered.filter((e) => Number(e.debit) > 0).length} entries</div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon green"><Icon name="down" /></div>
              <div>
                <div className="label">Total Credit</div>
                <div className="value">{money(totalCredit)}</div>
                <div className="sub">{filtered.filter((e) => Number(e.credit) > 0).length} entries</div>
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
              <div>
                <strong>{ledger.name}</strong>
                {ledger.phone && <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>{ledger.phone}</span>}
              </div>
              <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <PeriodFilter value={period} onChange={setPeriod} allowRecent />
                <button type="button" className="btn ghost sm" onClick={() => window.print()}>Print</button>
                <button type="button" className="btn ghost sm" disabled={!filtered.length} onClick={downloadPdf}>Download PDF</button>
                <ExportCsvButton disabled={!filtered.length} onExport={exportCsv} label="Export CSV" />
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
                  {filtered.map((e) => (
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
                  {!filtered.length && (
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
    </>
  );
}
