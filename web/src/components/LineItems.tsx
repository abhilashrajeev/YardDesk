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
  function setQuantity(i: number, qtyStr: string) {
    update(i, { quantity: Math.round(Number(qtyStr)), amountOverride: undefined });
  }
  function setRate(i: number, rateStr: string) {
    update(i, { rate: Number(rateStr), amountOverride: undefined });
  }
  /** Typing an amount directly sets it as this line's exact total (also updates the
   *  Rate field for reference, back-solved for the current quantity) — applied once
   *  typing finishes (blur/Enter) rather than per-keystroke, since recalculating a
   *  rounded rate on every character would make the field jump around as you type. */
  function commitAmount(i: number, amountStr: string) {
    setAmountDrafts((d) => {
      const next = { ...d };
      delete next[i];
      return next;
    });
    const amount = Number(amountStr);
    const qty = lines[i].quantity;
    if (!qty || Number.isNaN(amount)) return;
    update(i, { amountOverride: round2(amount), rate: round2(amount / qty) });
  }
  function add() {
    onChange([...lines, { materialId: materials[0]?.id ?? '', quantity: 0, rate: Number(materials[0]?.defaultRate ?? 0) }]);
  }
  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  const lineAmount = (l: LineInput) => l.amountOverride ?? round2(l.quantity * l.rate);
  const subTotal = lines.reduce((s, l) => s + lineAmount(l), 0);

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
                  update(i, { materialId: e.target.value, rate: Number(newMat?.defaultRate ?? 0), amountOverride: undefined });
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
                  step="1"
                  value={l.quantity || ''}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                  onBlur={(e) => setQuantity(i, e.target.value)}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div>
                <label className="li-field-label">Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={l.rate || ''}
                  onChange={(e) => setRate(i, e.target.value)}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div>
                <label className="li-field-label">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountDrafts[i] ?? (lineAmount(l) || '')}
                  title={l.quantity ? 'Type an amount to set this line\'s exact total' : 'Enter a quantity first'}
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
