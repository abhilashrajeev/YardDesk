import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import type { Customer } from '../types';

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export default function Customers() {
  const { data: customers, refetch } = useFetch<Customer[]>('/customers');
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [error, setError] = useState('');
  const [ledgerFor, setLedgerFor] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: ledger } = useFetch<{ balance: number; entries: LedgerEntry[] }>(
    ledgerFor ? `/accounts/customers/${ledgerFor.id}/ledger` : null,
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/customers', {
        name,
        phone: phone || undefined,
        creditLimit: Number(creditLimit),
        openingBalance: Number(openingBalance) || undefined,
      });
      setName('');
      setPhone('');
      setCreditLimit(0);
      setOpeningBalance(0);
      refetch();
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/customers/${editing.id}`, {
        name: editing.name,
        phone: editing.phone || undefined,
        address: editing.address || undefined,
        creditLimit: Number(editing.creditLimit),
        openingBalance: Number(editing.openingBalance),
      });
      setEditing(null);
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Customer) {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      refetch();
    } catch (err) {
      alert(apiError(err));
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Customers</h2>
      <form className="panel" onSubmit={add}>
        <h2>Add Customer</h2>
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
            <div>
              <label>Credit limit</label>
              <input type="number" value={creditLimit || ''} onChange={(e) => setCreditLimit(Number(e.target.value))} />
            </div>
            <div>
              <label>Opening balance (optional)</label>
              <input
                type="number"
                value={openingBalance || ''}
                onChange={(e) => setOpeningBalance(Number(e.target.value))}
                placeholder="Amount they already owe you"
              />
            </div>
          </div>
          {error && !editing && <div className="err">{error}</div>}
          <button className="btn">Add</button>
        </div>
      </form>

      <div className="panel">
        <h2>All Customers</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th className="num">Credit limit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers?.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="muted">{c.phone ?? '—'}</td>
                  <td className="num">{money(c.creditLimit)}</td>
                  <td className="right">
                    <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" onClick={() => setLedgerFor(c)}>Ledger</button>
                      {isAdmin && (
                        <>
                          <button className="btn sm ghost" onClick={() => setEditing(c)}>Edit</button>
                          <button className="btn sm ghost" onClick={() => remove(c)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2>Edit Customer</h2>
          <div className="body">
            <div className="row">
              <div>
                <label>Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label>Phone</label>
                <input value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <label>Address</label>
                <input value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div>
                <label>Credit limit</label>
                <input type="number" value={Number(editing.creditLimit) || ''} onChange={(e) => setEditing({ ...editing, creditLimit: e.target.value })} />
              </div>
              <div>
                <label>Opening balance</label>
                <input
                  type="number"
                  value={Number(editing.openingBalance) || ''}
                  onChange={(e) => setEditing({ ...editing, openingBalance: e.target.value })}
                />
              </div>
            </div>
            {error && <div className="err">{error}</div>}
            <div className="between" style={{ marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {ledgerFor && (
        <div className="panel">
          <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <strong>{ledgerFor.name} — Ledger</strong>
            <span>
              Balance:{' '}
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
