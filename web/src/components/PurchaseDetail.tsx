import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, qty, fmtDate } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import Modal from './Modal';
import PurchaseLineItems from './PurchaseLineItems';
import type { Purchase, Vendor, Material, Vehicle, LineInput } from '../types';

export default function PurchaseDetail({
  id,
  onClose,
  onChange,
}: {
  id: string;
  onClose: () => void;
  onChange?: () => void;
}) {
  const { data: purchase, refetch } = useFetch<Purchase>(`/purchases/${id}`);
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const [editing, setEditing] = useState(false);

  async function removePurchase() {
    if (!confirm('Delete this purchase? Stock and ledger effects will be reversed.')) return;
    try {
      await api.delete(`/purchases/${id}`);
      onChange?.();
      onClose();
    } catch (e) {
      alert(apiError(e));
    }
  }

  if (!purchase) return null;

  if (editing) {
    return (
      <EditPurchase
        purchase={purchase}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          refetch();
          onChange?.();
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal title={purchase.invoiceNo ?? 'Purchase'} onClose={onClose}>
      <div className="row">
        <div>
          <label>Vendor</label>
          <div style={{ fontWeight: 600 }}>{purchase.vendor?.name}</div>
        </div>
        <div>
          <label>Date</label>
          <div>{fmtDate(purchase.date)}</div>
        </div>
        {purchase.status === 'CANCELLED' && (
          <div>
            <label>Status</label>
            <div><span className="pill neg">CANCELLED</span></div>
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr><th>Material</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {purchase.items?.map((it) => (
            <tr key={it.id}>
              <td style={{ fontWeight: 500 }}>{it.material?.name}</td>
              <td className="num">{qty(it.quantity)} {(it.unit ?? it.material?.unit)?.toLowerCase()}</td>
              <td className="num">{money(it.rate)}</td>
              <td className="num" style={{ fontWeight: 700 }}>{money(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="between" style={{ paddingTop: 12 }}>
        <span className="muted">Subtotal</span><span>{money(purchase.subTotal)}</span>
      </div>
      <div className="between">
        <span className="muted">Transportation charge</span><span>{money(purchase.freight)}</span>
      </div>
      <div className="between" style={{ fontSize: 16, padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}>
        <b>Total</b><b>{money(purchase.total)}</b>
      </div>
      <div className="between">
        <span className="muted">Paid</span><span>{money(purchase.paidAmount)}</span>
      </div>
      <div className="between">
        <span className="muted">Balance</span>
        <span style={{ fontWeight: 700, color: (purchase.balance ?? 0) > 0 ? 'var(--red)' : 'var(--green)' }}>
          {money(purchase.balance)}
        </span>
      </div>

      {isAdmin && purchase.status !== 'CANCELLED' && (
        <div className="between" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div />
          <div className="flex" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn ghost sm" onClick={removePurchase}>Delete</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditPurchase({
  purchase,
  onCancel,
  onSaved,
  onClose,
}: {
  purchase: Purchase;
  onCancel: () => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { data: vendors } = useFetch<Vendor[]>('/vendors');
  const { data: materials } = useFetch<Material[]>('/inventory');
  const { data: vehicles } = useFetch<Vehicle[]>('/vehicles');

  const [vendorId, setVendorId] = useState(purchase.vendorId ?? '');
  const [invoiceNo, setInvoiceNo] = useState(purchase.invoiceNo ?? '');
  const [vehicleNumber, setVehicleNumber] = useState(purchase.vehicle?.number ?? '');
  const [freight, setFreight] = useState(Number(purchase.freight ?? 0));
  const [lines, setLines] = useState<LineInput[]>(
    (purchase.items ?? []).map((it) => ({
      materialId: it.materialId,
      quantity: Number(it.quantity),
      rate: Number(it.rate),
      unit: it.unit,
    })),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const subTotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const total = subTotal + Number(freight);

  async function resolveVehicleId(): Promise<string | undefined> {
    const num = vehicleNumber.trim();
    if (!num) return undefined;
    const existing = vehicles?.find((v) => v.number.toLowerCase() === num.toLowerCase());
    if (existing) return existing.id;
    const { data } = await api.post('/vehicles', { number: num });
    return data.id;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const items = lines.filter((l) => l.materialId && l.quantity > 0);
    if (!items.length) return setError('Add at least one line with quantity.');
    setSaving(true);
    try {
      const vehicleId = await resolveVehicleId();
      await api.patch(`/purchases/${purchase.id}`, {
        vendorId,
        vehicleId,
        invoiceNo: invoiceNo || undefined,
        freight: Number(freight),
        items,
      });
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!vendors || !materials || !vehicles) return null;

  return (
    <Modal title={`Edit ${purchase.invoiceNo ?? 'Purchase'}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="row">
          <div>
            <label>Vendor</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Vendor invoice # (optional)</label>
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div>
            <label>Vehicle number (optional)</label>
            <input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. KA-05-AB-1234"
              list="vehicle-numbers-edit"
            />
            <datalist id="vehicle-numbers-edit">
              {vehicles.map((v) => (
                <option key={v.id} value={v.number} />
              ))}
            </datalist>
          </div>
        </div>

        <PurchaseLineItems materials={materials} lines={lines} onChange={setLines} />

        <div className="row" style={{ marginTop: 14 }}>
          <div>
            <label>Transportation charge</label>
            <input type="number" value={freight || ''} onChange={(e) => setFreight(Number(e.target.value))} />
          </div>
        </div>

        {error && <div className="err">{error}</div>}
        <div className="between" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 18 }}>
            Total: <strong>{money(total)}</strong>
          </div>
          <div className="flex" style={{ gap: 6 }}>
            <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
            <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
