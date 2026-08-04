import { useState } from 'react';
import type { Material, LineInput } from '../types';
import { money, round2 } from '../lib/hooks';

interface Props {
  materials: Material[];
  lines: LineInput[];
  onChange: (lines: LineInput[]) => void;
}

export default function LineItems({ materials, lines, onChange }: Props) {
  // Raw text of an in-progress Amount edit, keyed by line index — kept separate from the
  // derived qty*rate value so recalculating the rate mid-keystroke doesn't fight typing.
  const [amountDrafts, setAmountDrafts] = useState<Record<number, string>>({});

  function update(i: number, patch: Partial<LineInput>) {
    const next = lines.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  /** Typing an amount directly back-solves the rate for the current quantity, applied
   *  once typing finishes (blur/Enter) rather than per-keystroke — recalculating the
   *  rounded rate on every character otherwise makes the field jump around as you type. */
  function commitAmount(i: number, amountStr: string) {
    setAmountDrafts((d) => {
      const next = { ...d };
      delete next[i];
      return next;
    });
    const amount = Number(amountStr);
    const qty = lines[i].quantity;
    if (!qty || Number.isNaN(amount)) return;
    update(i, { rate: round2(amount / qty) });
  }
  function add() {
    onChange([...lines, { materialId: materials[0]?.id ?? '', quantity: 0, rate: Number(materials[0]?.defaultRate ?? 0) }]);
  }
  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  const subTotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);

  return (
    <div>
      <label style={{ marginBottom: 8 }}>Materials</label>
      {lines.map((l, i) => {
        const mat = materials.find((m) => m.id === l.materialId);
        return (
          <div key={i} className="li-card">
            <div className="li-material">
              <select
                value={l.materialId}
                onChange={(e) => {
                  const newMat = materials.find((m) => m.id === e.target.value);
                  update(i, { materialId: e.target.value, rate: Number(newMat?.defaultRate ?? 0) });
                }}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
              <button type="button" className="btn sm gray li-remove" onClick={() => remove(i)}>
                ✕
              </button>
            </div>
            <div className="li-fields">
              <div>
                <label className="li-field-label">Qty ({mat?.unit ?? 'unit'})</label>
                <input
                  type="number"
                  step="0.001"
                  value={l.quantity || ''}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div>
                <label className="li-field-label">Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={l.rate || ''}
                  onChange={(e) => update(i, { rate: Number(e.target.value) })}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div>
                <label className="li-field-label">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountDrafts[i] ?? (round2(l.quantity * l.rate) || '')}
                  title={l.quantity ? 'Type an amount to back-solve the rate' : 'Enter a quantity first'}
                  onChange={(e) => setAmountDrafts((d) => ({ ...d, [i]: e.target.value }))}
                  onBlur={(e) => commitAmount(i, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  style={{ textAlign: 'right' }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="between" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost sm" onClick={add}>
          + Add Sale
        </button>
        <div>
          Subtotal: <strong>{money(subTotal)}</strong>
        </div>
      </div>
    </div>
  );
}
