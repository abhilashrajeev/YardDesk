import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import LineItems from '../components/LineItems';
import type { Vendor, Material, Purchase, LineInput, PaymentMode } from '../types';

export default function Purchases() {
  const { data: purchases, refetch } = useFetch<Purchase[]>('/purchases');
  const { data: vendors } = useFetch<Vendor[]>('/vendors');
  const { data: materials } = useFetch<Material[]>('/inventory');
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Purchases</h2>
        <button className="btn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : '+ New Purchase'}
        </button>
      </div>

      {open && vendors && materials && (
        <NewPurchase
          vendors={vendors}
          materials={materials}
          onDone={() => {
            setOpen(false);
            refetch();
          }}
        />
      )}

      <div className="panel">
        <h2>Recent Purchases</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Vendor</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases?.map((p) => (
                <tr key={p.id}>
                  <td>{p.invoiceNo ?? '—'}</td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.vendor?.name}</td>
                  <td className="num">{money(p.total)}</td>
                </tr>
              ))}
              {purchases?.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ padding: 16 }}>No purchases yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function NewPurchase({
  vendors,
  materials,
  onDone,
}: {
  vendors: Vendor[];
  materials: Material[];
  onDone: () => void;
}) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [freight, setFreight] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [lines, setLines] = useState<LineInput[]>([
    { materialId: materials[0]?.id ?? '', quantity: 0, rate: 0 },
  ]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const subTotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const total = subTotal + Number(freight);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const items = lines.filter((l) => l.materialId && l.quantity > 0);
    if (!items.length) return setError('Add at least one line with quantity.');
    setSaving(true);
    try {
      await api.post('/purchases', {
        vendorId,
        invoiceNo: invoiceNo || undefined,
        freight: Number(freight),
        paidAmount: paidAmount > 0 ? Number(paidAmount) : undefined,
        paymentMode: paidAmount > 0 ? paymentMode : undefined,
        items,
      });
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>New Purchase</h2>
      <div className="body">
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
        </div>

        <LineItems materials={materials} lines={lines} onChange={setLines} />

        <div className="row" style={{ marginTop: 14 }}>
          <div>
            <label>Freight</label>
            <input type="number" value={freight || ''} onChange={(e) => setFreight(Number(e.target.value))} />
          </div>
          <div>
            <label>Paid now (optional)</label>
            <input type="number" value={paidAmount || ''} onChange={(e) => setPaidAmount(Number(e.target.value))} />
          </div>
          {paidAmount > 0 && (
            <div>
              <label>Payment mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
          )}
        </div>

        {error && <div className="err">{error}</div>}
        <div className="between" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 18 }}>
            Total: <strong>{money(total)}</strong>
          </div>
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create Purchase'}</button>
        </div>
      </div>
    </form>
  );
}
