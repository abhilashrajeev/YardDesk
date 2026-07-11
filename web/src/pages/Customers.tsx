import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import VehicleNumberInput from '../components/VehicleNumberInput';
import type { Customer, CustomerVehicle } from '../types';

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

  const [vehiclesFor, setVehiclesFor] = useState<Customer | null>(null);
  const { data: customerVehicles, refetch: refetchCustomerVehicles } = useFetch<CustomerVehicle[]>(
    vehiclesFor ? `/customers/${vehiclesFor.id}/vehicles` : null,
  );
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [newVehicleQty, setNewVehicleQty] = useState(0);
  const [newVehicleExtraBody, setNewVehicleExtraBody] = useState(0);
  const [vehicleError, setVehicleError] = useState('');

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!vehiclesFor) return;
    setVehicleError('');
    if (!newVehicleNumber.trim()) return setVehicleError('Enter a vehicle number.');
    if (!newVehicleQty || newVehicleQty <= 0) return setVehicleError('Enter a capacity (cft).');
    try {
      await api.post(`/customers/${vehiclesFor.id}/vehicles`, {
        vehicleNumber: newVehicleNumber.trim(),
        quantityCft: Number(newVehicleQty),
        extraBodyCft: newVehicleExtraBody > 0 ? Number(newVehicleExtraBody) : undefined,
      });
      setNewVehicleNumber('');
      setNewVehicleQty(0);
      setNewVehicleExtraBody(0);
      refetchCustomerVehicles();
    } catch (err) {
      setVehicleError(apiError(err));
    }
  }

  async function updateVehicleField(cv: CustomerVehicle, field: 'quantityCft' | 'extraBodyCft', value: number) {
    if (!vehiclesFor) return;
    try {
      await api.patch(`/customers/${vehiclesFor.id}/vehicles/${cv.id}`, { [field]: value });
      refetchCustomerVehicles();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function removeVehicle(cv: CustomerVehicle) {
    if (!vehiclesFor) return;
    if (!confirm(`Remove ${cv.vehicle.number} from this customer's usual vehicles?`)) return;
    try {
      await api.delete(`/customers/${vehiclesFor.id}/vehicles/${cv.id}`);
      refetchCustomerVehicles();
    } catch (err) {
      alert(apiError(err));
    }
  }

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
                      <button className="btn sm ghost" onClick={() => setVehiclesFor(c)}>Vehicles</button>
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

      {vehiclesFor && (
        <div className="panel">
          <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <strong>{vehiclesFor.name} — Usual Vehicles</strong>
            <button className="btn sm ghost" onClick={() => setVehiclesFor(null)}>Close</button>
          </div>
          <div className="body">
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Register the truck(s) this customer usually sends and their capacity, always in cft.
              Some trucks add a second "extra body" for more load — track that separately if it applies.
              On a new sale, picking this customer + vehicle prefills the capacity — still editable.
            </p>
            {isAdmin && (
              <form onSubmit={addVehicle} className="row" style={{ alignItems: 'flex-end' }}>
                <div>
                  <label>Vehicle number</label>
                  <VehicleNumberInput value={newVehicleNumber} onChange={setNewVehicleNumber} />
                </div>
                <div>
                  <label>Capacity (cft)</label>
                  <input
                    type="number"
                    value={newVehicleQty || ''}
                    onChange={(e) => setNewVehicleQty(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label>Extra body capacity (cft, optional)</label>
                  <input
                    type="number"
                    value={newVehicleExtraBody || ''}
                    onChange={(e) => setNewVehicleExtraBody(Number(e.target.value))}
                  />
                </div>
                <div>
                  <button className="btn sm">Add</button>
                </div>
              </form>
            )}
            {vehicleError && <div className="err">{vehicleError}</div>}
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th className="num">Capacity (cft)</th>
                  <th className="num">Extra body capacity (cft)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customerVehicles?.map((cv) => (
                  <tr key={cv.id}>
                    <td>{cv.vehicle.number}</td>
                    <td className="num">
                      <input
                        type="number"
                        defaultValue={Number(cv.quantityCft)}
                        style={{ width: 100, textAlign: 'right' }}
                        onBlur={(e) => updateVehicleField(cv, 'quantityCft', Number(e.target.value))}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        defaultValue={cv.extraBodyCft ? Number(cv.extraBodyCft) : ''}
                        placeholder="—"
                        style={{ width: 100, textAlign: 'right' }}
                        onBlur={(e) => updateVehicleField(cv, 'extraBodyCft', Number(e.target.value))}
                      />
                    </td>
                    <td className="right">
                      {isAdmin && (
                        <button className="btn sm ghost" onClick={() => removeVehicle(cv)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
                {customerVehicles?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted" style={{ padding: 16 }}>No vehicles registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
