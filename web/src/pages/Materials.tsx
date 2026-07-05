import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, qty } from '../lib/hooks';
import type { Material, Unit } from '../types';

export default function Materials() {
  const { data: materials, refetch } = useFetch<Material[]>('/materials');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>('CFT');
  const [defaultRate, setDefaultRate] = useState(0);
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/materials', {
        name,
        unit,
        defaultRate: defaultRate > 0 ? Number(defaultRate) : undefined,
      });
      setName('');
      setDefaultRate(0);
      refetch();
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function saveRate(m: Material, value: number) {
    try {
      await api.patch(`/materials/${m.id}`, { defaultRate: value });
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
              <label>Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                <option value="CFT">CFT</option>
                <option value="BAG">BAG</option>
                <option value="NOS">NOS</option>
              </select>
            </div>
            <div>
              <label>Default rate</label>
              <input type="number" value={defaultRate || ''} onChange={(e) => setDefaultRate(Number(e.target.value))} />
            </div>
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
                <th className="num">Default rate</th>
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
                        if (v !== Number(m.defaultRate ?? 0)) saveRate(m, v);
                      }}
                    />
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
