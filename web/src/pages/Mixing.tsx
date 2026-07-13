import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, qty, fmtDate } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import type { Material, Production } from '../types';

interface InputLine {
  materialId: string;
  quantity: number;
}

export default function Mixing() {
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('STOCK');
  const { data: materials } = useFetch<Material[]>('/inventory');
  const { data: batches, refetch } = useFetch<Production[]>('/production');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState(0);
  const [costOverride, setCostOverride] = useState<number | ''>('');
  const [inputs, setInputs] = useState<InputLine[]>([{ materialId: '', quantity: 0 }]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const materialById = new Map((materials ?? []).map((m) => [m.id, m]));

  // Mirrors the backend's weighted-average calc, so the operator sees the same
  // number they're about to submit (and can still override it).
  const suggestedCost = (() => {
    const output = materialById.get(materialId);
    if (!output || !quantity) return 0;
    const inputCost = inputs.reduce((sum, line) => {
      const m = materialById.get(line.materialId);
      if (!m || !line.quantity) return sum;
      return sum + line.quantity * Number(m.purchaseRate ?? m.defaultRate ?? 0);
    }, 0);
    // While editing, the output material's current stock already includes this
    // batch's old effect; that's fine as a rough on-screen estimate — the
    // server recomputes the real weighted average after reversing the old batch.
    const existingValue = Number(output.currentStock) * Number(output.purchaseRate ?? 0);
    const totalQty = Number(output.currentStock) + quantity;
    return totalQty > 0 ? (existingValue + inputCost) / totalQty : 0;
  })();

  function updateInput(i: number, field: 'materialId' | 'quantity', value: string) {
    setInputs(inputs.map((line, idx) => (idx === i ? { ...line, [field]: field === 'quantity' ? Number(value) : value } : line)));
  }
  function addInputLine() {
    setInputs([...inputs, { materialId: '', quantity: 0 }]);
  }
  function removeInputLine(i: number) {
    setInputs(inputs.filter((_, idx) => idx !== i));
  }

  function resetForm() {
    setEditingId(null);
    setMaterialId('');
    setDate(new Date().toISOString().slice(0, 10));
    setQuantity(0);
    setCostOverride('');
    setInputs([{ materialId: '', quantity: 0 }]);
    setNotes('');
    setError('');
  }

  function startEdit(b: Production) {
    setEditingId(b.id);
    setMaterialId(b.materialId);
    setDate(b.date.slice(0, 10));
    setQuantity(Number(b.quantity));
    setCostOverride(Number(b.costPerUnit));
    setInputs(b.inputs.map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity) })));
    setNotes(b.notes ?? '');
    setError('');
    setOpen(true);
  }

  function startNew() {
    resetForm();
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const validInputs = inputs.filter((l) => l.materialId && l.quantity > 0);
    if (!materialId || !quantity) return setError('Pick the output material and how much it produced.');
    if (!validInputs.length) return setError('Add at least one input material.');
    setSaving(true);
    try {
      const payload = {
        materialId,
        quantity,
        date,
        costPerUnit: costOverride === '' ? undefined : Number(costOverride),
        inputs: validInputs,
        notes: notes || undefined,
      };
      if (editingId) {
        await api.patch(`/production/${editingId}`, payload);
      } else {
        await api.post('/production', payload);
      }
      setOpen(false);
      resetForm();
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeBatch(id: string) {
    if (!confirm('Delete this batch? Its stock effects will be reversed.')) return;
    try {
      await api.delete(`/production/${id}`);
      refetch();
    } catch (e) {
      alert(apiError(e));
    }
  }

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Mixing</h2>
        {canCreate && (
          <button
            className="btn"
            onClick={() => {
              if (open) {
                setOpen(false);
                resetForm();
              } else {
                startNew();
              }
            }}
          >
            {open ? 'Close' : '+ New Batch'}
          </button>
        )}
      </div>

      {open && canCreate && !materials && (
        <div className="panel">
          <div className="body muted" style={{ textAlign: 'center', padding: '32px 0' }}>Loading…</div>
        </div>
      )}

      {open && canCreate && materials && (
        <form className="panel" onSubmit={submit}>
          <h2>{editingId ? 'Edit Mix Batch' : 'New Mix Batch'}</h2>
          <div className="body">
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Pick what this batch produces and how much, then list the materials it's mixed from.
              Stock for each input drops by the amount consumed; stock for the output rises by the
              amount produced. Stock can go negative if there isn't enough on hand yet.
            </p>
            <div className="row">
              <div>
                <label>Output material</label>
                <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                  <option value="">Select material</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Quantity produced</label>
                <input type="number" value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))} />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>

            <label>Inputs consumed</label>
            {inputs.map((line, i) => (
              <div key={i} className="row" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
                <div>
                  <select value={line.materialId} onChange={(e) => updateInput(i, 'materialId', e.target.value)}>
                    <option value="">Select material</option>
                    {materials
                      .filter((m) => m.id !== materialId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit}) — {qty(m.currentStock)} in stock
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Quantity consumed"
                    value={line.quantity || ''}
                    onChange={(e) => updateInput(i, 'quantity', e.target.value)}
                  />
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <button type="button" className="btn ghost sm" onClick={() => removeInputLine(i)}>✕</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn ghost sm" onClick={addInputLine}>+ Add input</button>

            <div className="row" style={{ marginTop: 14 }}>
              <div>
                <label>Cost per unit (₹, optional override)</label>
                <input
                  type="number"
                  placeholder={`Suggested: ${money(suggestedCost)}`}
                  value={costOverride}
                  onChange={(e) => setCostOverride(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Notes (optional)</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            {error && <div className="err">{error}</div>}
            <div className="between" style={{ marginTop: 10 }}>
              <div className="muted">Suggested cost/unit: <strong>{money(suggestedCost)}</strong></div>
              <div className="flex" style={{ gap: 8 }}>
                {editingId && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Record Batch'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="panel">
        <h2>Mixing — Recent Batches</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Produced</th>
                <th>From</th>
                <th className="num">Cost/unit</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {batches?.map((b) => (
                <tr key={b.id}>
                  <td className="muted">{fmtDate(b.date)}</td>
                  <td style={{ fontWeight: 500 }}>{qty(b.quantity)} {b.material.unit.toLowerCase()} {b.material.name}</td>
                  <td className="muted">
                    {b.inputs.map((i) => `${qty(i.quantity)} ${i.material.unit.toLowerCase()} ${i.material.name}`).join(' + ')}
                  </td>
                  <td className="num">{money(b.costPerUnit)}</td>
                  <td>
                    {b.status === 'CANCELLED' ? <span className="pill neg">Cancelled</span> : <span className="pill pos">Confirmed</span>}
                  </td>
                  <td className="right">
                    {canCreate && b.status !== 'CANCELLED' && (
                      <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => startEdit(b)}>Edit</button>
                        <button className="btn ghost sm" onClick={() => removeBatch(b.id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {batches?.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>No batches yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
