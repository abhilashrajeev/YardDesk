import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import LineItems from '../components/LineItems';
import type { Customer, Material, Sale, LineInput, PaymentMode } from '../types';

export default function Sales() {
  const { data: sales, refetch } = useFetch<Sale[]>('/sales');
  const { data: customers } = useFetch<Customer[]>('/customers');
  const { data: materials } = useFetch<Material[]>('/inventory');
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Sales &amp; Billing</h2>
        <button className="btn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : '+ New Sale'}
        </button>
      </div>

      {open && customers && materials && (
        <NewSale
          customers={customers}
          materials={materials}
          onDone={() => {
            setOpen(false);
            refetch();
          }}
        />
      )}

      <div className="panel">
        <h2>Recent Sales</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Mode</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales?.map((s) => (
                <tr key={s.id}>
                  <td>{s.billNo}</td>
                  <td>{fmtDate(s.date)}</td>
                  <td>{s.customer?.name}</td>
                  <td>
                    <span className={s.paymentMode === 'CREDIT' ? 'pill neg' : 'pill pos'}>{s.paymentMode}</span>
                  </td>
                  <td className="num">{money(s.total)}</td>
                </tr>
              ))}
              {sales?.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 16 }}>No sales yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function NewSale({
  customers,
  materials,
  onDone,
}: {
  customers: Customer[];
  materials: Material[];
  onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [freight, setFreight] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [lines, setLines] = useState<LineInput[]>([
    { materialId: materials[0]?.id ?? '', quantity: 0, rate: 0 },
  ]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const subTotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const total = subTotal + Number(freight) - Number(discount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const items = lines.filter((l) => l.materialId && l.quantity > 0);
    if (!items.length) return setError('Add at least one line with quantity.');
    setSaving(true);
    try {
      await api.post('/sales', {
        customerId,
        paymentMode,
        freight: Number(freight),
        discount: Number(discount),
        paidAmount: paymentMode === 'CREDIT' ? Number(paidAmount) : undefined,
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
      <h2>New Sale</h2>
      <div className="body">
        <div className="row">
          <div>
            <label>Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Payment mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK">Bank</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
        </div>

        <LineItems materials={materials} lines={lines} onChange={setLines} />

        <div className="row" style={{ marginTop: 14 }}>
          <div>
            <label>Freight</label>
            <input type="number" value={freight || ''} onChange={(e) => setFreight(Number(e.target.value))} />
          </div>
          <div>
            <label>Discount</label>
            <input type="number" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          {paymentMode === 'CREDIT' && (
            <div>
              <label>Paid now (optional)</label>
              <input type="number" value={paidAmount || ''} onChange={(e) => setPaidAmount(Number(e.target.value))} />
            </div>
          )}
        </div>

        {error && <div className="err">{error}</div>}
        <div className="between" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 18 }}>
            Total: <strong>{money(total)}</strong>
          </div>
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create Sale'}</button>
        </div>
      </div>
    </form>
  );
}
