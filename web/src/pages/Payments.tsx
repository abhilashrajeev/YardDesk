import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import { downloadCsv } from '../lib/csv';
import { useAuth } from '../auth/AuthContext';
import ExportCsvButton from '../components/ExportCsvButton';
import Modal from '../components/Modal';
import CustomerPicker from '../components/CustomerPicker';
import VendorPicker from '../components/VendorPicker';
import PeriodFilter, { defaultPeriodState, periodRange, periodLabel } from '../components/PeriodFilter';
import type { Customer, Vendor, Payment, PaymentMode } from '../types';

export default function Payments() {
  const [period, setPeriod] = useState(defaultPeriodState());
  const { from, to } = periodRange(period);
  const paymentsUrl = from ? `/accounts/payments?from=${from}&to=${to}` : '/accounts/payments';
  const { data: payments, loading: paymentsLoading, refetch } = useFetch<Payment[]>(paymentsUrl);
  const { data: customers, setData: setCustomers } = useFetch<Customer[]>('/customers');
  const { data: vendors, setData: setVendors } = useFetch<Vendor[]>('/vendors');
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canCreate = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('PAYMENTS');

  const [partyType, setPartyType] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [partyId, setPartyId] = useState('');
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // Default: FIFO-apply the payment across the party's oldest open bills (may create
  // several linked payment rows). Off: one lump payment against the total outstanding,
  // not tied to any specific bill — for "just record what they paid" without allocating it.
  const [autoApply, setAutoApply] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  const [search, setSearch] = useState('');
  const visiblePayments = (payments ?? []).filter((p) => !p.voided);
  const filteredPayments = visiblePayments.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.customer?.name ?? p.vendor?.name ?? '').toLowerCase().includes(q) ||
      p.mode.toLowerCase().includes(q) ||
      (p.reference ?? '').toLowerCase().includes(q)
    );
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!partyId) return setError('Select a party.');
    if (amount <= 0) return setError('Enter an amount.');
    setSaving(true);
    try {
      await api.post('/accounts/payments', {
        partyType,
        customerId: partyType === 'CUSTOMER' ? partyId : undefined,
        vendorId: partyType === 'VENDOR' ? partyId : undefined,
        direction: partyType === 'CUSTOMER' ? 'IN' : 'OUT',
        mode,
        amount: Number(amount),
        reference: reference || undefined,
        date,
        autoApply,
      });
      setMsg('Payment recorded.');
      setPartyId('');
      setMode('CASH');
      setAmount(0);
      setReference('');
      setDate(new Date().toISOString().slice(0, 10));
      setAutoApply(true);
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/accounts/payments/${editing.id}`, {
        mode: editing.mode,
        amount: Number(editing.amount),
        reference: editing.reference || undefined,
        date: editing.date.slice(0, 10),
      });
      setEditing(null);
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Payment) {
    if (!confirm('Delete (void) this payment? Its ledger effect will be reversed.')) return;
    try {
      await api.delete(`/accounts/payments/${p.id}`);
      refetch();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function exportCsv(exportFrom: string, exportTo: string) {
    const { data } = await api.get<Payment[]>(`/accounts/payments?from=${exportFrom}&to=${exportTo}`);
    downloadCsv(
      `payments-${exportFrom}-${exportTo}`,
      [
        { header: 'Date', value: (p: Payment) => fmtDate(p.date) },
        { header: 'Party', value: (p: Payment) => p.customer?.name ?? p.vendor?.name ?? '' },
        { header: 'Direction', value: (p: Payment) => p.direction },
        { header: 'Mode', value: (p: Payment) => p.mode },
        { header: 'Amount', value: (p: Payment) => p.amount },
        { header: 'Reference', value: (p: Payment) => p.reference ?? '' },
        { header: 'Status', value: (p: Payment) => (p.voided ? 'Voided' : 'Active') },
      ],
      data,
    );
  }

  return (
    <>
      <div className="between" style={{ marginTop: 0, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Payments</h2>
        <ExportCsvButton onExport={exportCsv} defaultFrom={from || undefined} defaultTo={to || undefined} />
      </div>
      {canCreate && (
      <form className="panel" onSubmit={submit}>
        <h2>Record Payment</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Party type</label>
              <select value={partyType} onChange={(e) => { setPartyType(e.target.value as 'CUSTOMER' | 'VENDOR'); setPartyId(''); }}>
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
            <div>
              <label>Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
            <div>
              <label>Amount</label>
              <input type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <label>Reference (optional)</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div>
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 9 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
              <label style={{ margin: 0 }} title="On: split across the oldest open bills first (may create several linked payments). Off: one lump payment against the total outstanding, not tied to a specific bill.">
                Apply to outstanding bills
              </label>
            </div>
          </div>
          {error && !editing && <div className="err">{error}</div>}
          {msg && <div className="ok">{msg}</div>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
        </div>
      </form>
      )}

      <div className="panel">
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, padding: 0, border: 0 }}>Payments — {periodLabel(period)}</h2>
          <PeriodFilter value={period} onChange={setPeriod} allowRecent />
        </div>
        <div style={{ padding: '10px 16px 12px' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by party, mode, or reference"
            style={{ width: '100%', maxWidth: 380 }}
          />
        </div>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Party</th>
                <th>Direction</th>
                <th>Mode</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.customer?.name ?? p.vendor?.name}</td>
                  <td>
                    <span className={p.direction === 'IN' ? 'pill pos' : 'pill neg'}>{p.direction}</span>
                  </td>
                  <td>{p.mode}</td>
                  <td className="num">{money(p.amount)}</td>
                  <td className="right">
                    {(canCreate || isAdmin) && (
                      <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        {canCreate && <button className="btn sm ghost" onClick={() => setEditing(p)}>Edit</button>}
                        {isAdmin && <button className="btn sm ghost" onClick={() => remove(p)}>Delete</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {paymentsLoading && !payments && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>Loading…</td>
                </tr>
              )}
              {visiblePayments.length === 0 && !paymentsLoading && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>No payments yet.</td>
                </tr>
              )}
              {visiblePayments.length > 0 && filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>No payments match "{search}".</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title="Edit Payment" onClose={() => setEditing(null)}>
          <div className="row">
            <div>
              <label>Mode</label>
              <select value={editing.mode} onChange={(e) => setEditing({ ...editing, mode: e.target.value as PaymentMode })}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
            <div>
              <label>Amount</label>
              <input type="number" value={Number(editing.amount) || ''} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
            </div>
            <div>
              <label>Reference</label>
              <input value={editing.reference ?? ''} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} />
            </div>
            <div>
              <label>Date</label>
              <input
                type="date"
                value={editing.date.slice(0, 10)}
                onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          {error && <div className="err">{error}</div>}
          <div className="between" style={{ marginTop: 10 }}>
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
