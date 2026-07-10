import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, qty } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import type { Material, Unit } from '../types';

export default function Materials() {
  const { data: materials, refetch } = useFetch<Material[]>('/materials');
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>('CFT');
  const [defaultRate, setDefaultRate] = useState(0);
  const [purchaseRate, setPurchaseRate] = useState(0);
  const [allowTon, setAllowTon] = useState(false);
  const [purchaseRateTon, setPurchaseRateTon] = useState(0);
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/materials', {
        name,
        unit,
        defaultRate: defaultRate > 0 ? Number(defaultRate) : undefined,
        purchaseRate: purchaseRate > 0 ? Number(purchaseRate) : undefined,
        purchaseRateTon: unit === 'CFT' && allowTon && purchaseRateTon > 0 ? Number(purchaseRateTon) : undefined,
      });
      setName('');
      setDefaultRate(0);
      setPurchaseRate(0);
      setAllowTon(false);
      setPurchaseRateTon(0);
      refetch();
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function saveField(m: Material, field: 'defaultRate' | 'purchaseRate' | 'purchaseRateTon', value: number) {
    try {
      await api.patch(`/materials/${m.id}`, { [field]: value });
      refetch();
    } catch (e) {
      alert(apiError(e));
    }
  }

  async function remove(m: Material) {
    if (!confirm(`Delete material "${m.name}"?`)) return;
    try {
      await api.delete(`/materials/${m.id}`);
      refetch();
    } catch (e) {
      alert(apiError(e));
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Materials</h2>
      <form className="panel" onSubmit={add}>
        <h2>Add Material</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label>Sale unit (sold &amp; stocked in)</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                <option value="CFT">CFT</option>
                <option value="BAG">BAG</option>
                <option value="NOS">NOS</option>
              </select>
            </div>
            <div>
              <label>Sale rate</label>
              <input type="number" value={defaultRate || ''} onChange={(e) => setDefaultRate(Number(e.target.value))} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Purchase rate (₹/{unit.toLowerCase()})</label>
              <input type="number" value={purchaseRate || ''} onChange={(e) => setPurchaseRate(Number(e.target.value))} />
            </div>
            {unit === 'CFT' && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 9 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={allowTon} onChange={(e) => setAllowTon(e.target.checked)} />
                <label style={{ margin: 0 }}>Also buy this by the ton</label>
              </div>
            )}
            {unit === 'CFT' && allowTon && (
              <div>
                <label>Purchase rate (₹/ton)</label>
                <input type="number" value={purchaseRateTon || ''} onChange={(e) => setPurchaseRateTon(Number(e.target.value))} />
              </div>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: -6, marginBottom: 12 }}>
            Ton ⇄ cft conversion is fixed at 1 ton = 21 cft.
          </div>
          {error && <div className="err">{error}</div>}
          <button className="btn">Add</button>
        </div>
      </form>

      <div className="panel">
        <h2>All Materials</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Unit</th>
                <th className="num">Stock</th>
                <th className="num">Sale rate</th>
                <th className="num">Purchase rate (own unit)</th>
                <th className="num">Purchase rate (₹/ton)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materials?.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="muted">{m.unit}</td>
                  <td className="num">{qty(m.currentStock)}</td>
                  <td className="num">
                    <input
                      type="number"
                      defaultValue={m.defaultRate ?? ''}
                      style={{ width: 90, textAlign: 'right' }}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== Number(m.defaultRate ?? 0)) saveField(m, 'defaultRate', v);
                      }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      defaultValue={m.purchaseRate ?? ''}
                      style={{ width: 90, textAlign: 'right' }}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== Number(m.purchaseRate ?? 0)) saveField(m, 'purchaseRate', v);
                      }}
                    />
                  </td>
                  <td className="num">
                    {m.unit === 'CFT' ? (
                      m.purchaseRateTon != null ? (
                        <input
                          type="number"
                          defaultValue={m.purchaseRateTon}
                          style={{ width: 90, textAlign: 'right' }}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== Number(m.purchaseRateTon ?? 0)) saveField(m, 'purchaseRateTon', v);
                          }}
                        />
                      ) : (
                        <button
                          className="btn ghost sm"
                          onClick={() => saveField(m, 'purchaseRateTon', Math.round(Number(m.purchaseRate ?? m.defaultRate ?? 0) * 21))}
                        >
                          Enable
                        </button>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="right">
                    {isAdmin && (
                      <button className="btn sm ghost" onClick={() => remove(m)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
