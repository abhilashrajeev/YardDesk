import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, qty, fmtDate } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import type { Material } from '../types';

interface Movement {
  id: string;
  date: string;
  direction: string;
  quantity: string;
  balance: string;
  refType?: string | null;
  material: { name: string; unit: string };
}

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const { data: stock, refetch } = useFetch<Material[]>('/inventory');
  const [selected, setSelected] = useState<string | null>(null);
  const { data: movements } = useFetch<Movement[]>(
    selected ? `/inventory/movements?materialId=${selected}` : null,
  );

  async function adjust(materialId: string) {
    const val = prompt('Adjustment quantity (use negative to reduce):');
    if (val == null) return;
    const quantity = Number(val);
    if (!quantity) return;
    try {
      await api.post('/inventory/adjust', { materialId, quantity, notes: 'Manual adjustment' });
      refetch();
    } catch (e) {
      alert(apiError(e));
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Stock Monitoring</h2>
      <div className="panel">
        <h2>Current Stock</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Unit</th>
                <th className="num">Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stock?.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="muted">{m.unit}</td>
                  <td className="num">
                    <span className={Number(m.currentStock) < 0 ? 'pill neg' : ''}>{qty(m.currentStock)}</span>
                  </td>
                  <td className="right">
                    <button className="btn sm ghost" onClick={() => setSelected(m.id)}>History</button>
                    {isAdmin && (
                      <button className="btn sm gray" style={{ marginLeft: 6 }} onClick={() => adjust(m.id)}>
                        Adjust
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="panel">
          <h2>Movement History</h2>
          <div className="body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Type</th>
                  <th>Ref</th>
                  <th className="num">Qty</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {movements?.map((m) => (
                  <tr key={m.id}>
                    <td>{fmtDate(m.date)}</td>
                    <td>{m.material.name}</td>
                    <td>
                      <span className={m.direction === 'IN' ? 'pill pos' : m.direction === 'OUT' ? 'pill neg' : ''}>
                        {m.direction}
                      </span>
                    </td>
                    <td className="muted">{m.refType}</td>
                    <td className="num">{qty(m.quantity)}</td>
                    <td className="num">{qty(m.balance)}</td>
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
