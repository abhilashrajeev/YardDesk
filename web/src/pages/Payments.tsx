import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import type { Customer, Vendor, PaymentMode } from '../types';

interface PaymentRow {
  id: string;
  date: string;
  direction: 'IN' | 'OUT';
  mode: PaymentMode;
  amount: string;
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
}

export default function Payments() {
  const { data: payments, refetch } = useFetch<PaymentRow[]>('/accounts/payments');
  const { data: customers } = useFetch<Customer[]>('/customers');
  const { data: vendors } = useFetch<Vendor[]>('/vendors');

  const [partyType, setPartyType] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [partyId, setPartyId] = useState('');
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parties = partyType === 'CUSTOMER' ? customers : vendors;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    const id = partyId || parties?.[0]?.id;
    if (!id) return setError('Select a party.');
    if (amount <= 0) return setError('Enter an amount.');
    setSaving(true);
    try {
      await api.post('/accounts/payments', {
        partyType,
        customerId: partyType === 'CUSTOMER' ? id : undefined,
        vendorId: partyType === 'VENDOR' ? id : undefined,
        direction: partyType === 'CUSTOMER' ? 'IN' : 'OUT',
        mode,
        amount: Number(amount),
        reference: reference || undefined,
      });
      setMsg('Payment recorded.');
      setAmount(0);
      setReference('');
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Payments</h2>
      <form className="panel" onSubmit={submit}>
        <h2>Record Payment</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Party type</label>
              <select value={partyType} onChange={(e) => { setPartyType(e.target.value as any); setPartyId(''); }}>
                <option value="CUSTOMER">Customer (money in)</option>
                <option value="VENDOR">Vendor (money out)</option>
              </select>
            </div>
            <div>
              <label>{partyType === 'CUSTOMER' ? 'Customer' : 'Vendor'}</label>
              <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                {parties?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
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
          </div>
          {error && <div className="err">{error}</div>}
          {msg && <div className="ok">{msg}</div>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
        </div>
      </form>

      <div className="panel">
        <h2>Recent Payments</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Party</th>
                <th>Direction</th>
                <th>Mode</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments?.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.customer?.name ?? p.vendor?.name}</td>
                  <td>
                    <span className={p.direction === 'IN' ? 'pill pos' : 'pill neg'}>{p.direction}</span>
                  </td>
                  <td>{p.mode}</td>
                  <td className="num">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
