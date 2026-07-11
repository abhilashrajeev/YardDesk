import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import VehicleNumberInput from '../components/VehicleNumberInput';
import type { Vehicle } from '../types';

/** Capacity registered against this truck by a customer/vendor takes priority over the
 *  manually-entered value, since that's the number actually used day-to-day. */
function displayCapacity(v: Vehicle): string {
  const cv = v.customerVehicles?.[0];
  if (cv) return cv.quantityCft;
  const vv = v.vendorVehicles?.[0];
  if (vv) return vv.defaultQuantity;
  return v.capacity ?? '—';
}

function displayExtraBody(v: Vehicle): string {
  return v.customerVehicles?.[0]?.extraBodyCft ?? v.extraBodyCft ?? '—';
}

export default function Vehicles() {
  const { data: vehicles, refetch } = useFetch<Vehicle[]>('/vehicles');
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [number, setNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [extraBodyCft, setExtraBodyCft] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  // Prefilled from the same effective value shown in the table (customer/vendor
  // registration takes priority over the vehicle's own field) so editing doesn't look
  // like it's ignoring what's on screen.
  const [editCapacity, setEditCapacity] = useState('');
  const [editExtraBody, setEditExtraBody] = useState('');

  function startEdit(v: Vehicle) {
    setEditing(v);
    const cap = displayCapacity(v);
    const extra = displayExtraBody(v);
    setEditCapacity(cap === '—' ? '' : cap);
    setEditExtraBody(extra === '—' ? '' : extra);
  }

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
        extraBodyCft: extraBodyCft > 0 ? Number(extraBodyCft) : undefined,
      });
      setNumber('');
      setOwnerName('');
      setOwnerPhone('');
      setCapacity(0);
      setExtraBodyCft(0);
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
      const cv = editing.customerVehicles?.[0];
      const vv = editing.vendorVehicles?.[0];

      await api.patch(`/vehicles/${editing.id}`, {
        number: editing.number,
        ownerName: editing.ownerName || undefined,
        ownerPhone: editing.ownerPhone || undefined,
        // Only write capacity/extra body onto the vehicle itself when no customer/vendor
        // registration owns those numbers — otherwise the table would keep showing the
        // registered value and this edit would look like it did nothing.
        ...(!cv && !vv
          ? {
              capacity: editCapacity ? Number(editCapacity) : undefined,
              extraBodyCft: editExtraBody ? Number(editExtraBody) : undefined,
            }
          : {}),
      });

      if (cv) {
        await api.patch(`/customers/${cv.customer.id}/vehicles/${cv.id}`, {
          quantityCft: editCapacity ? Number(editCapacity) : undefined,
          extraBodyCft: editExtraBody ? Number(editExtraBody) : undefined,
        });
      } else if (vv) {
        await api.patch(`/vendors/${vv.vendor.id}/vehicles/${vv.id}`, {
          defaultQuantity: editCapacity ? Number(editCapacity) : undefined,
        });
      }

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
              <VehicleNumberInput value={number} onChange={setNumber} required />
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
              <label>Capacity (cft)</label>
              <input type="number" value={capacity || ''} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
            <div>
              <label>Extra body capacity (cft, optional)</label>
              <input type="number" value={extraBodyCft || ''} onChange={(e) => setExtraBodyCft(Number(e.target.value))} />
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
                <th className="num">Capacity (cft)</th>
                <th className="num">Extra body capacity (cft)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehicles?.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.number}</td>
                  <td className="muted">{v.ownerName ?? '—'}</td>
                  <td className="muted">{v.ownerPhone ?? '—'}</td>
                  <td className="num">{displayCapacity(v)}</td>
                  <td className="num">{displayExtraBody(v)}</td>
                  <td className="right">
                    {isAdmin && (
                      <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => startEdit(v)}>Edit</button>
                        <button className="btn ghost sm" onClick={() => remove(v.id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {vehicles?.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>No vehicles yet.</td>
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
                <VehicleNumberInput value={editing.number} onChange={(v) => setEditing({ ...editing, number: v })} />
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
                <label>Capacity (cft)</label>
                <input type="number" value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} />
              </div>
              <div>
                <label>Extra body capacity (cft, optional)</label>
                <input type="number" value={editExtraBody} onChange={(e) => setEditExtraBody(e.target.value)} />
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
