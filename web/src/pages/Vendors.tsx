import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import type { Vendor } from '../types';

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export default function Vendors() {
  const { data: vendors, refetch } = useFetch<Vendor[]>('/vendors');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [ledgerFor, setLedgerFor] = useState<Vendor | null>(null);
  const { data: ledger } = useFetch<{ balance: number; entries: LedgerEntry[] }>(
    ledgerFor ? `/accounts/vendors/${ledgerFor.id}/ledger` : null,
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/vendors', { name, phone: phone || undefined });
      setName('');
      setPhone('');
      refetch();
    } catch (err) {
      setError(apiError(err));
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Vendors</h2>
      <form className="panel" onSubmit={add}>
        <h2>Add Vendor</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          {error && <div className="err">{error}</div>}
          <button className="btn">Add</button>
        </div>
      </form>

      <div className="panel">
        <h2>All Vendors</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendors?.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td className="muted">{v.phone ?? '—'}</td>
                  <td className="right">
                    <button className="btn sm ghost" onClick={() => setLedgerFor(v)}>Ledger</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {ledgerFor && (
        <div className="panel">
          <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <strong>{ledgerFor.name} — Ledger</strong>
            <span>
              We owe:{' '}
              <strong style={{ color: (ledger?.balance ?? 0) > 0 ? 'var(--red)' : 'var(--green)' }}>
                {money(ledger?.balance)}
              </strong>
            </span>
          </div>
          <div className="body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger?.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.date)}</td>
                    <td>{e.description}</td>
                    <td className="num">{Number(e.debit) ? money(e.debit) : '—'}</td>
                    <td className="num">{Number(e.credit) ? money(e.credit) : '—'}</td>
                    <td className="num">{money(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
