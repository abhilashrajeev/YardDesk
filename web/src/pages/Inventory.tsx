import { Fragment, useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, qty, fmtDate } from '../lib/hooks';
import { downloadCsv } from '../lib/csv';
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
  const canAdjust = isAdmin && (user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('STOCK'));
  const { data: stock, refetch } = useFetch<Material[]>('/inventory');
  const [selected, setSelected] = useState<string | null>(null);
  const { data: movements, refetch: refetchMovements } = useFetch<Movement[]>(
    selected ? `/inventory/movements?materialId=${selected}` : null,
  );

  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  function openAdjust(materialId: string) {
    setAdjustingId(materialId);
    setAdjustQty('');
    setAdjustError('');
  }
  function cancelAdjust() {
    setAdjustingId(null);
    setAdjustQty('');
    setAdjustError('');
  }
  async function submitAdjust(materialId: string) {
    const quantity = Number(adjustQty);
    if (!adjustQty || Number.isNaN(quantity) || quantity === 0) {
      setAdjustError('Enter a non-zero quantity (negative to reduce).');
      return;
    }
    setAdjustSaving(true);
    setAdjustError('');
    try {
      await api.post('/inventory/adjust', { materialId, quantity, notes: 'Manual adjustment' });
      cancelAdjust();
      refetch();
    } catch (e) {
      setAdjustError(apiError(e));
    } finally {
      setAdjustSaving(false);
    }
  }

  async function undoAdjustment(movementId: string) {
    if (!confirm('Undo this adjustment? A compensating entry will be posted.')) return;
    try {
      await api.post(`/inventory/adjust/${movementId}/undo`);
      refetch();
      refetchMovements();
    } catch (e) {
      alert(apiError(e));
    }
  }

  function exportCsv() {
    downloadCsv(
      'stock',
      [
        { header: 'Material', value: (m: Material) => m.name },
        { header: 'Unit', value: (m: Material) => m.unit },
        { header: 'Current Stock', value: (m: Material) => m.currentStock },
        { header: 'Default Rate', value: (m: Material) => m.defaultRate ?? '' },
        { header: 'Purchase Rate', value: (m: Material) => m.purchaseRate ?? '' },
      ],
      stock ?? [],
    );
  }

  return (
    <>
      <div className="between" style={{ marginTop: 0, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Stock Monitoring</h2>
        <button className="btn ghost" onClick={exportCsv} disabled={!stock?.length}>Export CSV</button>
      </div>
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
                <Fragment key={m.id}>
                  <tr>
                    <td>{m.name}</td>
                    <td className="muted">{m.unit}</td>
                    <td className="num">
                      <span className={Number(m.currentStock) < 0 ? 'pill neg' : ''}>{qty(m.currentStock)}</span>
                    </td>
                    <td className="right">
                      <button className="btn sm ghost" onClick={() => setSelected(m.id)}>History</button>
                      {canAdjust && (
                        <button className="btn sm gray" style={{ marginLeft: 6 }} onClick={() => openAdjust(m.id)}>
                          Adjust
                        </button>
                      )}
                    </td>
                  </tr>
                  {adjustingId === m.id && (
                    <tr>
                      <td colSpan={4} style={{ background: '#fafbfc' }}>
                        <div className="flex" style={{ gap: 10, padding: '4px 0' }}>
                          <input
                            type="number"
                            step="0.001"
                            placeholder="e.g. 50 or -10"
                            value={adjustQty}
                            onChange={(e) => setAdjustQty(e.target.value)}
                            style={{ width: 160 }}
                            autoFocus
                          />
                          <span className="muted" style={{ fontSize: 12 }}>
                            positive adds, negative reduces ({m.unit.toLowerCase()})
                          </span>
                          <button className="btn sm" disabled={adjustSaving} onClick={() => submitAdjust(m.id)}>
                            {adjustSaving ? 'Saving…' : 'Apply'}
                          </button>
                          <button className="btn sm gray" onClick={cancelAdjust}>Cancel</button>
                        </div>
                        {adjustError && <div className="err" style={{ margin: '4px 0 8px' }}>{adjustError}</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
                  <th></th>
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
                    <td className="right">
                      {canAdjust && m.refType === 'ADJUSTMENT' && (
                        <button className="btn sm ghost" onClick={() => undoAdjustment(m.id)}>Undo</button>
                      )}
                    </td>
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
