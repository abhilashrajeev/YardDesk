import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import VehicleNumberInput from '../components/VehicleNumberInput';
import CustomerPicker from '../components/CustomerPicker';
import VendorPicker from '../components/VendorPicker';
import type { Vehicle, Customer, Vendor } from '../types';

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

function isLinked(v: Vehicle): boolean {
  return !!(v.customerVehicles?.length || v.vendorVehicles?.length);
}

export default function Vehicles() {
  const { data: vehicles, loading: vehiclesLoading, refetch } = useFetch<Vehicle[]>('/vehicles');
  const { data: customers, setData: setCustomers } = useFetch<Customer[]>('/customers');
  const { data: vendors, setData: setVendors } = useFetch<Vendor[]>('/vendors');
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [number, setNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [extraBodyCft, setExtraBodyCft] = useState(0);
  const [linkType, setLinkType] = useState<'' | 'CUSTOMER' | 'VENDOR'>('');
  const [linkPartyId, setLinkPartyId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  // Prefilled from the same effective value shown in the table (customer/vendor
  // registration takes priority over the vehicle's own field) so editing doesn't look
  // like it's ignoring what's on screen.
  const [editCapacity, setEditCapacity] = useState('');
  const [editExtraBody, setEditExtraBody] = useState('');

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const needsLinking = (vehicles ?? []).filter((v) => v.ownerName && !isLinked(v) && !skipped.has(v.id));

  const [search, setSearch] = useState('');
  const filteredVehicles = (vehicles ?? []).filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    // Strip dashes/spaces so "8203" also matches the last few digits of "KL-01-BJ-8203" —
    // that's usually all a driver remembers of their own plate.
    const normalizedNumber = v.number.replace(/[-\s]/g, '').toLowerCase();
    return normalizedNumber.includes(q.replace(/[-\s]/g, '')) || (v.ownerName ?? '').toLowerCase().includes(q);
  });

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
    if (linkType && !linkPartyId) return setError(`Pick or add a ${linkType === 'CUSTOMER' ? 'customer' : 'vendor'} to link this vehicle to.`);
    setSaving(true);
    try {
      await api.post('/vehicles', {
        number: number.trim(),
        ownerName: ownerName || undefined,
        ownerPhone: ownerPhone || undefined,
        capacity: capacity > 0 ? Number(capacity) : undefined,
        extraBodyCft: extraBodyCft > 0 ? Number(extraBodyCft) : undefined,
      });
      if (linkType === 'CUSTOMER' && linkPartyId) {
        await api.post(`/customers/${linkPartyId}/vehicles`, {
          vehicleNumber: number.trim(),
          quantityCft: capacity > 0 ? Number(capacity) : 0,
          extraBodyCft: extraBodyCft > 0 ? Number(extraBodyCft) : undefined,
        });
      } else if (linkType === 'VENDOR' && linkPartyId) {
        await api.post(`/vendors/${linkPartyId}/vehicles`, {
          vehicleNumber: number.trim(),
          defaultQuantity: capacity > 0 ? Number(capacity) : 0,
        });
      }
      setNumber('');
      setOwnerName('');
      setOwnerPhone('');
      setCapacity(0);
      setExtraBodyCft(0);
      setLinkType('');
      setLinkPartyId('');
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
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={!!linkType}
                placeholder={linkType ? `Same as the linked ${linkType === 'CUSTOMER' ? 'customer' : 'vendor'}` : undefined}
              />
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

          <div className="row">
            <div>
              <label>Link to (optional)</label>
              <select
                value={linkType}
                onChange={(e) => {
                  const type = e.target.value as '' | 'CUSTOMER' | 'VENDOR';
                  setLinkType(type);
                  // If an owner name was already typed, try to connect it to an existing
                  // customer/vendor of that exact name — saves re-searching for someone
                  // who's already registered. No match just leaves it to pick or add.
                  const typedName = ownerName.trim().toLowerCase();
                  const match =
                    type === 'CUSTOMER'
                      ? customers?.find((c) => c.name.trim().toLowerCase() === typedName)
                      : type === 'VENDOR'
                        ? vendors?.find((v) => v.name.trim().toLowerCase() === typedName)
                        : undefined;
                  if (typedName && match) {
                    setLinkPartyId(match.id);
                    setOwnerName(match.name);
                  } else {
                    setLinkPartyId('');
                  }
                }}
              >
                <option value="">Not linked</option>
                <option value="CUSTOMER">A customer</option>
                <option value="VENDOR">A vendor</option>
              </select>
            </div>
            {linkType === 'CUSTOMER' && customers && (
              <div>
                <label>Customer</label>
                <CustomerPicker
                  customers={customers}
                  value={linkPartyId}
                  initialQuery={ownerName}
                  onChange={(id) => {
                    setLinkPartyId(id);
                    setOwnerName(customers.find((c) => c.id === id)?.name ?? '');
                  }}
                  onCreated={(c) => {
                    setCustomers([...(customers ?? []), c]);
                    setOwnerName(c.name);
                  }}
                />
              </div>
            )}
            {linkType === 'VENDOR' && vendors && (
              <div>
                <label>Vendor</label>
                <VendorPicker
                  vendors={vendors}
                  value={linkPartyId}
                  initialQuery={ownerName}
                  onChange={(id) => {
                    setLinkPartyId(id);
                    setOwnerName(vendors.find((v) => v.id === id)?.name ?? '');
                  }}
                  onCreated={(v) => {
                    setVendors([...(vendors ?? []), v]);
                    setOwnerName(v.name);
                  }}
                />
              </div>
            )}
          </div>

          {error && <div className="err">{error}</div>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Add Vehicle'}</button>
        </div>
      </form>

      {needsLinking.length > 0 && (
        <div className="panel">
          <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, padding: 0, border: 0 }}>Needs Linking</h2>
            <span className="muted" style={{ fontSize: 13 }}>{needsLinking.length} vehicle{needsLinking.length === 1 ? '' : 's'} have an owner name but aren't linked to a real customer/vendor yet</span>
          </div>
          <div className="body">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Owner</th>
                  <th className="num">Capacity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {needsLinking.map((v) => (
                  <VehicleLinkRow
                    key={v.id}
                    vehicle={v}
                    customers={customers ?? []}
                    vendors={vendors ?? []}
                    onCustomerCreated={(c) => setCustomers([...(customers ?? []), c])}
                    onVendorCreated={(vd) => setVendors([...(vendors ?? []), vd])}
                    onLinked={refetch}
                    onSkip={() => setSkipped((prev) => new Set(prev).add(v.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, padding: 0, border: 0 }}>All Vehicles</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vehicle number (even just last 4 digits) or owner name"
            style={{ maxWidth: 340 }}
          />
        </div>
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
              {filteredVehicles.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.number}</td>
                  <td className="muted">{v.ownerName ?? '—'}</td>
                  <td className="muted">{v.ownerPhone ?? '—'}</td>
                  <td className="num">{displayCapacity(v)}</td>
                  <td className="num">{displayExtraBody(v)}</td>
                  <td className="right">
                    <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn ghost sm" onClick={() => startEdit(v)}>Edit</button>
                      {isAdmin && (
                        <button className="btn ghost sm" onClick={() => remove(v.id)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {vehiclesLoading && !vehicles && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>Loading…</td>
                </tr>
              )}
              {vehicles?.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>No vehicles yet.</td>
                </tr>
              )}
              {(vehicles?.length ?? 0) > 0 && filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>No vehicles match "{search}".</td>
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

function VehicleLinkRow({
  vehicle,
  customers,
  vendors,
  onCustomerCreated,
  onVendorCreated,
  onLinked,
  onSkip,
}: {
  vehicle: Vehicle;
  customers: Customer[];
  vendors: Vendor[];
  onCustomerCreated: (c: Customer) => void;
  onVendorCreated: (v: Vendor) => void;
  onLinked: () => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'CUSTOMER' | 'VENDOR'>('idle');
  const [partyId, setPartyId] = useState('');
  const [qty, setQty] = useState(Number(vehicle.capacity ?? 0));
  const [extraBody, setExtraBody] = useState(Number(vehicle.extraBodyCft ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirmLink() {
    if (!partyId) return setError('Pick or add a party first.');
    if (!qty || qty <= 0) return setError('Enter the usual quantity (cft).');
    setSaving(true);
    setError('');
    try {
      if (mode === 'CUSTOMER') {
        await api.post(`/customers/${partyId}/vehicles`, {
          vehicleNumber: vehicle.number,
          quantityCft: qty,
          extraBodyCft: extraBody > 0 ? extraBody : undefined,
        });
      } else if (mode === 'VENDOR') {
        await api.post(`/vendors/${partyId}/vehicles`, {
          vehicleNumber: vehicle.number,
          defaultQuantity: qty,
        });
      }
      onLinked();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr>
        <td style={{ fontWeight: 600, verticalAlign: 'top' }}>{vehicle.number}</td>
        <td className="muted" style={{ verticalAlign: 'top' }}>
          {vehicle.ownerName ?? '—'}
          {vehicle.ownerPhone && <div style={{ fontSize: 12 }}>{vehicle.ownerPhone}</div>}
        </td>
        <td className="num" style={{ verticalAlign: 'top' }}>{vehicle.capacity ?? '—'}</td>
        <td className="right">
          {mode === 'idle' ? (
            <div className="flex" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost sm" onClick={() => setMode('CUSTOMER')}>As Customer</button>
              <button type="button" className="btn ghost sm" onClick={() => setMode('VENDOR')}>As Vendor</button>
              <button type="button" className="btn ghost sm" onClick={onSkip}>Skip</button>
            </div>
          ) : (
            <button type="button" className="btn ghost sm" onClick={() => setMode('idle')}>Cancel</button>
          )}
        </td>
      </tr>
      {mode !== 'idle' && (
        <tr>
          <td colSpan={4} style={{ background: 'var(--bg-soft, rgba(0,0,0,0.02))' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 220px', minWidth: 180 }}>
                {mode === 'CUSTOMER' ? (
                  <CustomerPicker
                    customers={customers}
                    value={partyId}
                    onChange={setPartyId}
                    onCreated={(c) => {
                      onCustomerCreated(c);
                      setPartyId(c.id);
                    }}
                  />
                ) : (
                  <VendorPicker
                    vendors={vendors}
                    value={partyId}
                    onChange={setPartyId}
                    onCreated={(v) => {
                      onVendorCreated(v);
                      setPartyId(v.id);
                    }}
                  />
                )}
              </div>
              <input
                type="number"
                placeholder="Usual qty (cft)"
                value={qty || ''}
                onChange={(e) => setQty(Number(e.target.value))}
                style={{ width: 120 }}
              />
              {mode === 'CUSTOMER' && (
                <input
                  type="number"
                  placeholder="Extra body"
                  value={extraBody || ''}
                  onChange={(e) => setExtraBody(Number(e.target.value))}
                  style={{ width: 110 }}
                />
              )}
              <button type="button" className="btn sm" disabled={saving} onClick={confirmLink}>
                {saving ? '…' : 'Link'}
              </button>
            </div>
            {error && <div className="err" style={{ fontSize: 12, marginTop: 4 }}>{error}</div>}
          </td>
        </tr>
      )}
    </>
  );
}
