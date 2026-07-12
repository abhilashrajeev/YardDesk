import type { Material, LineInput } from '../types';
import { TON_TO_CFT } from '../types';
import { money, round2 } from '../lib/hooks';

interface Props {
  materials: Material[];
  lines: LineInput[];
  onChange: (lines: LineInput[]) => void;
}

/** Units a material can be purchased in — its own unit, plus TON if purchaseRateTon is set. */
function purchaseUnitsFor(mat?: Material) {
  if (!mat) return ['CFT'];
  const units = [mat.unit];
  if (mat.unit === 'CFT' && mat.purchaseRateTon != null) units.push('TON');
  return units;
}

function defaultRateFor(mat: Material | undefined, unit: string | undefined) {
  if (!mat) return 0;
  if (unit === 'TON') return Number(mat.purchaseRateTon ?? 0);
  return Number(mat.purchaseRate ?? mat.defaultRate ?? 0);
}

export default function PurchaseLineItems({ materials, lines, onChange }: Props) {
  function update(i: number, patch: Partial<LineInput>) {
    const next = lines.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function setMaterial(i: number, materialId: string) {
    const mat = materials.find((m) => m.id === materialId);
    const unit = purchaseUnitsFor(mat)[0];
    update(i, { materialId, unit: unit as LineInput['unit'], rate: defaultRateFor(mat, unit) });
  }
  function setUnit(i: number, unit: string) {
    const mat = materials.find((m) => m.id === lines[i].materialId);
    update(i, { unit: unit as LineInput['unit'], rate: defaultRateFor(mat, unit) });
  }
  /** Typing an amount directly back-solves the rate for the current quantity. */
  function setAmount(i: number, amountStr: string) {
    const amount = Number(amountStr);
    const qty = lines[i].quantity;
    if (!qty || Number.isNaN(amount)) return;
    update(i, { rate: round2(amount / qty) });
  }
  function add() {
    const mat = materials[0];
    const unit = purchaseUnitsFor(mat)[0];
    onChange([...lines, { materialId: mat?.id ?? '', unit: unit as LineInput['unit'], quantity: 0, rate: defaultRateFor(mat, unit) }]);
  }
  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  const subTotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);

  return (
    <div>
      {/* Scrolls horizontally on narrow screens instead of squeezing every column
          (and its input) down to an unusable few pixels wide. */}
      <div style={{ overflowX: 'auto' }}>
      <table style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ width: '32%' }}>Material</th>
            <th>Unit bought in</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const mat = materials.find((m) => m.id === l.materialId);
            const units = purchaseUnitsFor(mat);
            const convertsToOther = l.unit && l.unit !== mat?.unit;
            return (
              <tr key={i}>
                <td>
                  <select value={l.materialId} onChange={(e) => setMaterial(i, e.target.value)}>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={l.unit ?? mat?.unit} onChange={(e) => setUnit(i, e.target.value)}>
                    {units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  {convertsToOther && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                      1 {l.unit?.toLowerCase()} = {TON_TO_CFT} {mat?.unit.toLowerCase()}
                    </div>
                  )}
                </td>
                <td className="num">
                  <input
                    type="number"
                    step="0.001"
                    value={l.quantity || ''}
                    onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                    style={{ textAlign: 'right' }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    step="0.01"
                    value={l.rate || ''}
                    onChange={(e) => update(i, { rate: Number(e.target.value) })}
                    style={{ textAlign: 'right' }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    step="0.01"
                    value={round2(l.quantity * l.rate) || ''}
                    title={l.quantity ? 'Type an amount to back-solve the rate' : 'Enter a quantity first'}
                    onChange={(e) => setAmount(i, e.target.value)}
                    style={{ textAlign: 'right' }}
                  />
                </td>
                <td>
                  <button type="button" className="btn sm gray" onClick={() => remove(i)}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <div className="between" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost sm" onClick={add}>
          + Add Purchase
        </button>
        <div>
          Subtotal: <strong>{money(subTotal)}</strong>
        </div>
      </div>
    </div>
  );
}
