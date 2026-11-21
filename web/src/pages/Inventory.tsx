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
  refId?: string | null;
  material: { name: string; unit: string };
}

interface HistoryRow {
  id: string;
  date: string;
  type: string;
  material: { name: string; unit: string };
  /** Signed: positive added stock, negative removed it. */
  qty: number;
  /** Stock after this row. */
  balance: number;
  /** Set only for a manual adjustment that can still be undone. */
  undoableId?: string;
}

const TYPE_LABEL: Record<string, string> = {
  SALE: 'Sale',
  PURCHASE: 'Purchase',
  PRODUCTION: 'Mixing',
  ADJUSTMENT: 'Adjustment',
};

/**
 * Turn raw stock movements (newest date first) into one row per transaction, in its
 * current state. Editing or deleting a sale/purchase/mixing batch posts an undo of the
 * old movement (and, for an edit, a new one); restoring posts a redo; undoing a manual
 * adjustment posts its opposite. Those all net out under the record they belong to, so
 * an edited bill shows once at its current quantity and a deleted or undone one vanishes.
 *
 * "Stock after" is derived backwards from the material's current stock rather than read
 * from each movement's stored balance — that stored figure is the stock at the moment of
 * ENTRY, which is wrong whenever entries are made out of date order (sales first,
 * purchases later). Works because the list is a newest-first run back from today.
 */
function toHistory(movements: Movement[], currentStock: number): HistoryRow[] {
  const signed = (m: Movement) => (m.direction === 'OUT' ? -1 : 1) * Number(m.quantity);
  const keyOf = (m: Movement) => {
    if (m.refType === 'ADJUSTMENT') return `ADJUSTMENT:${m.id}`;
    if (m.refType === 'ADJUSTMENT_UNDO') return `ADJUSTMENT:${m.refId}`;
    if (!m.refType || !m.refId) return `RAW:${m.id}`;
    // SALE_REVERSAL / PURCHASE_RESTORE / PRODUCTION_UNDO / PRODUCTION_EDIT_UNDO -> base type.
    const base = m.refType.replace(/_(REVERSAL|RESTORE|EDIT_UNDO|UNDO)$/, '');
    return `${base}:${m.refId}`;
  };

  const groups = new Map<string, { first: Movement; net: number; undone: boolean }>();
  const order: string[] = [];
  for (const m of movements) {
    const k = keyOf(m);
    const g = groups.get(k);
    if (g) {
      g.net += signed(m);
      if (m.refType === 'ADJUSTMENT_UNDO') g.undone = true;
    } else {
      groups.set(k, { first: m, net: signed(m), undone: m.refType === 'ADJUSTMENT_UNDO' });
      order.push(k);
    }
  }

  let after = currentStock;
  const rows: HistoryRow[] = [];
  for (const k of order) {
    const g = groups.get(k)!;
    const qty = Math.round(g.net * 1000) / 1000;
    if (Math.abs(qty) < 0.0005) continue;
    const base = k.slice(0, k.indexOf(':'));
    rows.push({
      id: g.first.id,
      date: g.first.date,
      type: TYPE_LABEL[base] ?? base,
      material: g.first.material,
      qty,
      balance: Math.round(after * 1000) / 1000,
      undoableId: base === 'ADJUSTMENT' && !g.undone ? k.slice(k.indexOf(':') + 1) : undefined,
    });
    after -= qty;
  }
  return rows;
}

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canAdjust = isAdmin && (user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('STOCK'));
  const { data: stock, loading: stockLoading, refetch } = useFetch<Material[]>('/inventory');
  const [selected, setSelected] = useState<string | null>(null);
  const { data: movements, loading: movementsLoading, refetch: refetchMovements } = useFetch<Movement[]>(
    selected ? `/inventory/movements?materialId=${selected}` : null,
  );

  const selectedStock = Number(stock?.find((m) => m.id === selected)?.currentStock ?? 0);
  const history = movements ? toHistory(movements, selectedStock) : null;

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
                            step="1"
                            placeholder="e.g. 50 or -10"
                            value={adjustQty}
                            onChange={(e) => setAdjustQty(e.target.value)}
                            onBlur={(e) => e.target.value && setAdjustQty(String(Math.round(Number(e.target.value))))}
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
              {stockLoading && !stock && (
                <tr>
                  <td colSpan={4} className="muted" style={{ padding: 16, textAlign: 'center' }}>Loading…</td>
                </tr>
              )}
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
                  <th className="num">Stock after</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history?.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.material.name}</td>
                    <td>
                      <span className={r.qty > 0 ? 'pill pos' : 'pill neg'}>{r.qty > 0 ? 'IN' : 'OUT'}</span>
                    </td>
                    <td className="muted">{r.type}</td>
                    <td className="num">{qty(Math.abs(r.qty))}</td>
                    <td className="num">{qty(r.balance)}</td>
                    <td className="right">
                      {canAdjust && r.undoableId && (
                        <button className="btn sm ghost" onClick={() => undoAdjustment(r.undoableId!)}>Undo</button>
                      )}
                    </td>
                  </tr>
                ))}
                {movementsLoading && !movements && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ padding: 16, textAlign: 'center' }}>Loading…</td>
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
