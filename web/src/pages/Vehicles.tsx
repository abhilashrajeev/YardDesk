import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import type { Vehicle } from '../types';

export default function Vehicles() {
  const { data: vehicles, refetch } = useFetch<Vehicle[]>('/vehicles');
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [number, setNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!number.trim()) return setError('Vehicle number is required.');
    setSaving(true);
    try {
      await api.post('/vehicles', {
        number: number.trim(),
        ownerName: ownerName || undefined,
        ownerPhone: ownerPhone || undefined,
        capacity: capacity > 0 ? Number(capacity) : undefined,
      });
      setNumber('');
      setOwnerName('');
      setOwnerPhone('');
      setCapacity(0);
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
      await api.patch(`/vehicles/${editing.id}`, {
        number: editing.number,
        ownerName: editing.ownerName || undefined,
        ownerPhone: editing.ownerPhone || undefined,
        capacity: editing.capacity ? Number(editing.capacity) : undefined,
      });
      setEditing(null);
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this vehicle?')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      refetch();
    } catch (err) {
      alert(apiError(err));
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Vehicles</h2>
      <form className="panel" onSubmit={add}>
        <h2>Add Vehicle</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Vehicle number</label>
              <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. KA-05-AB-1234" required />
            </div>
            <div>
              <label>Owner name</label>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div>
              <label>Owner phone</label>
              <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
            </div>
            <div>
              <label>Capacity (tons)</label>
              <input type="number" value={capacity || ''} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
          </div>
          {error && <div className="err">{error}</div>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Add Vehicle'}</button>
        </div>
      </form>

      <div className="panel">
        <h2>All Vehicles</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Owner</th>
                <th>Phone</th>
                <th className="num">Capacity (t)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehicles?.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.number}</td>
                  <td className="muted">{v.ownerName ?? '—'}</td>
                  <td className="muted">{v.ownerPhone ?? '—'}</td>
                  <td className="num">{v.capacity ?? '—'}</td>
                  <td className="right">
                    {isAdmin && (
                      <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => setEditing(v)}>Edit</button>
                        <button className="btn ghost sm" onClick={() => remove(v.id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {vehicles?.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 16 }}>No vehicles yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2>Edit Vehicle</h2>
          <div className="body">
            <div className="row">
              <div>
                <label>Vehicle number</label>
                <input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} />
              </div>
              <div>
                <label>Owner name</label>
                <input value={editing.ownerName ?? ''} onChange={(e) => setEditing({ ...editing, ownerName: e.target.value })} />
              </div>
              <div>
                <label>Owner phone</label>
                <input value={editing.ownerPhone ?? ''} onChange={(e) => setEditing({ ...editing, ownerPhone: e.target.value })} />
              </div>
              <div>
                <label>Capacity (tons)</label>
                <input type="number" value={Number(editing.capacity) || ''} onChange={(e) => setEditing({ ...editing, capacity: e.target.value })} />
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
    </>
  );
}
