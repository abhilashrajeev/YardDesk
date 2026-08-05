import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../api/client';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import VehicleNumberInput from '../components/VehicleNumberInput';
import Modal from '../components/Modal';
import type { Vendor, VendorVehicle } from '../types';

export default function Vendors() {
  const navigate = useNavigate();
  const { data: vendors, loading: vendorsLoading, refetch } = useFetch<Vendor[]>('/vendors');
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const filteredVendors = (vendors ?? []).filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return v.name.toLowerCase().includes(q) || (v.phone ?? '').includes(q);
  });
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);

  const [vehiclesFor, setVehiclesFor] = useState<Vendor | null>(null);
  const { data: vendorVehicles, refetch: refetchVendorVehicles } = useFetch<VendorVehicle[]>(
    vehiclesFor ? `/vendors/${vehiclesFor.id}/vehicles` : null,
  );
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [newVehicleQty, setNewVehicleQty] = useState(0);
  const [vehicleError, setVehicleError] = useState('');

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!vehiclesFor) return;
    setVehicleError('');
    if (!newVehicleNumber.trim()) return setVehicleError('Enter a vehicle number.');
    if (!newVehicleQty || newVehicleQty <= 0) return setVehicleError('Enter a quantity.');
    try {
      await api.post(`/vendors/${vehiclesFor.id}/vehicles`, {
        vehicleNumber: newVehicleNumber.trim(),
        defaultQuantity: Number(newVehicleQty),
      });
      setNewVehicleNumber('');
      setNewVehicleQty(0);
      refetchVendorVehicles();
    } catch (err) {
      setVehicleError(apiError(err));
    }
  }

  async function updateVehicleQty(vv: VendorVehicle, value: number) {
    if (!vehiclesFor || value === Number(vv.defaultQuantity)) return;
    try {
      await api.patch(`/vendors/${vehiclesFor.id}/vehicles/${vv.id}`, { defaultQuantity: value });
      refetchVendorVehicles();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function removeVehicle(vv: VendorVehicle) {
    if (!vehiclesFor) return;
    if (!confirm(`Remove ${vv.vehicle.number} from this vendor's usual vehicles?`)) return;
    try {
      await api.delete(`/vendors/${vehiclesFor.id}/vehicles/${vv.id}`);
      refetchVendorVehicles();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/vendors', {
        name,
        phone: phone || undefined,
        openingBalance: Number(openingBalance) || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
      });
      setName('');
      setPhone('');
      setOpeningBalance(0);
      setVehicleNumber('');
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
      await api.patch(`/vendors/${editing.id}`, {
        name: editing.name,
        phone: editing.phone || undefined,
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

  async function remove(v: Vendor) {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;
    try {
      await api.delete(`/vendors/${v.id}`);
      refetch();
    } catch (err) {
      alert(apiError(err));
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
            <div>
              <label>Opening balance (optional)</label>
              <input
                type="number"
                value={openingBalance || ''}
                onChange={(e) => setOpeningBalance(Number(e.target.value))}
                placeholder="Amount you already owe them"
              />
            </div>
            <div>
              <label>Vehicle number (optional)</label>
              <VehicleNumberInput value={vehicleNumber} onChange={setVehicleNumber} />
            </div>
          </div>
          {error && !editing && <div className="err">{error}</div>}
          <button className="btn">Add</button>
        </div>
      </form>

      <div className="panel">
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, padding: 0, border: 0 }}>All Vendors</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone"
            style={{ maxWidth: 280 }}
          />
        </div>
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
              {filteredVendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td className="muted">{v.phone ?? '—'}</td>
                  <td className="right">
                    <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" onClick={() => navigate(`/ledger?type=VENDOR&id=${v.id}`)}>Ledger</button>
                      <button className="btn sm ghost" onClick={() => setVehiclesFor(v)}>Vehicles</button>
                      <button className="btn sm ghost" onClick={() => setEditing(v)}>Edit</button>
                      {isAdmin && (
                        <button className="btn sm ghost" onClick={() => remove(v)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {vendorsLoading && !vendors && (
                <tr>
                  <td colSpan={3} className="muted" style={{ padding: 16, textAlign: 'center' }}>Loading…</td>
                </tr>
              )}
              {vendors?.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted" style={{ padding: 16 }}>No vendors yet.</td>
                </tr>
              )}
              {(vendors?.length ?? 0) > 0 && filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted" style={{ padding: 16 }}>No vendors match "{search}".</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title="Edit Vendor" onClose={() => setEditing(null)}>
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
        </Modal>
      )}

      {vehiclesFor && (
        <div className="panel">
          <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <strong>{vehiclesFor.name} — Usual Vehicles</strong>
            <button className="btn sm ghost" onClick={() => setVehiclesFor(null)}>Close</button>
          </div>
          <div className="body">
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Register the truck(s) this vendor usually sends and the quantity they typically bring.
              On a new purchase, picking this vendor + vehicle prefills the quantity — still editable
              for the times it's different.
            </p>
            <form onSubmit={addVehicle} className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <label>Vehicle number</label>
                <VehicleNumberInput value={newVehicleNumber} onChange={setNewVehicleNumber} />
              </div>
              <div>
                <label>Usual quantity</label>
                <input
                  type="number"
                  value={newVehicleQty || ''}
                  onChange={(e) => setNewVehicleQty(Number(e.target.value))}
                />
              </div>
              <div>
                <button className="btn sm">Add</button>
              </div>
            </form>
            {vehicleError && <div className="err">{vehicleError}</div>}
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th className="num">Usual quantity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vendorVehicles?.map((vv) => (
                  <tr key={vv.id}>
                    <td>{vv.vehicle.number}</td>
                    <td className="num">
                      <input
                        type="number"
                        defaultValue={Number(vv.defaultQuantity)}
                        style={{ width: 100, textAlign: 'right' }}
                        onBlur={(e) => updateVehicleQty(vv, Number(e.target.value))}
                      />
                    </td>
                    <td className="right">
                      {isAdmin && (
                        <button className="btn sm ghost" onClick={() => removeVehicle(vv)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
                {vendorVehicles?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted" style={{ padding: 16 }}>No vehicles registered yet.</td>
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
