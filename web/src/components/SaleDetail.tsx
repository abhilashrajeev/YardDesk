import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, qty, fmtDate } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import Modal from './Modal';
import LineItems from './LineItems';
import CustomerPicker from './CustomerPicker';
import type { Sale, Customer, Material, LineInput, PaymentMode } from '../types';

export default function SaleDetail({
  id,
  onClose,
  onChange,
}: {
  id: string;
  onClose: () => void;
  onChange?: () => void;
}) {
  const { data: sale, refetch } = useFetch<Sale>(`/sales/${id}`);
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const [editing, setEditing] = useState(false);

  async function issuePass(kind: 'gate-pass' | 'loading-pass') {
    try {
      await api.post(`/sales/${id}/${kind}`);
      await refetch();
      onChange?.();
    } catch (e) {
      alert(apiError(e));
    }
  }

  async function removeSale() {
    if (!confirm('Delete this sale? Stock and ledger effects will be reversed.')) return;
    try {
      await api.delete(`/sales/${id}`);
      onChange?.();
      onClose();
    } catch (e) {
      alert(apiError(e));
    }
  }

  if (!sale) return null;

  if (editing) {
    return (
      <EditSale
        sale={sale}
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
    <Modal title={`Bill #${sale.billNo}`} onClose={onClose}>
      <div className="row">
        <div>
          <label>Customer</label>
          <div style={{ fontWeight: 600 }}>{sale.customer?.name}</div>
        </div>
        <div>
          <label>Date</label>
          <div>{fmtDate(sale.date)}</div>
        </div>
        <div>
          <label>Payment mode</label>
          <div>
            <span className={`pill ${sale.paymentMode === 'CREDIT' ? 'neg' : 'pos'}`}>{sale.paymentMode}</span>
          </div>
        </div>
        {sale.status === 'CANCELLED' && (
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
          {sale.items?.map((it) => (
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
        <span className="muted">Subtotal</span><span>{money(sale.subTotal)}</span>
      </div>
      <div className="between">
        <span className="muted">Transportation charge</span><span>{money(sale.freight)}</span>
      </div>
      {!!Number(sale.discount) && (
        <div className="between">
          <span className="muted">Discount</span><span>-{money(sale.discount)}</span>
        </div>
      )}
      <div className="between" style={{ fontSize: 16, padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}>
        <b>Total</b><b>{money(sale.total)}</b>
      </div>
      <div className="between">
        <span className="muted">Paid</span><span>{money(sale.paidAmount)}</span>
      </div>
      <div className="between">
        <span className="muted">Balance</span>
        <span style={{ fontWeight: 700, color: (sale.balance ?? 0) > 0 ? 'var(--red)' : 'var(--green)' }}>
          {money(sale.balance)}
        </span>
      </div>

      <div className="between" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div className="flex">
          {sale.gatePass ? (
            <span className="pill pos">Gate Pass #{sale.gatePass.passNo}</span>
          ) : (
            <button className="btn ghost sm" onClick={() => issuePass('gate-pass')}>Issue Gate Pass</button>
          )}
          {sale.loadingPass ? (
            <span className="pill pos">Loading Pass #{sale.loadingPass.passNo}</span>
          ) : (
            <button className="btn ghost sm" onClick={() => issuePass('loading-pass')}>Issue Loading Pass</button>
          )}
        </div>
        {isAdmin && sale.status !== 'CANCELLED' && (
          <div className="flex" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn ghost sm" onClick={removeSale}>Delete</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EditSale({
  sale,
  onCancel,
  onSaved,
  onClose,
}: {
  sale: Sale;
  onCancel: () => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { data: customers, setData: setCustomers } = useFetch<Customer[]>('/customers');
  const { data: materials } = useFetch<Material[]>('/inventory');

  const [customerId, setCustomerId] = useState(sale.customerId ?? '');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(sale.paymentMode);
  const [freight, setFreight] = useState(Number(sale.freight ?? 0));
  const [discount, setDiscount] = useState(Number(sale.discount ?? 0));
  const [lines, setLines] = useState<LineInput[]>(
    (sale.items ?? []).map((it) => ({
      materialId: it.materialId,
      quantity: Number(it.quantity),
      rate: Number(it.rate),
    })),
  );
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
      await api.patch(`/sales/${sale.id}`, {
        customerId,
        paymentMode,
        freight: Number(freight),
        discount: Number(discount),
        items,
      });
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!customers || !materials) return null;

  return (
    <Modal title={`Edit Bill #${sale.billNo}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="row">
          <div>
            <label>Customer</label>
            <CustomerPicker
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              onCreated={(c) => setCustomers([...(customers ?? []), c])}
            />
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
            <label>Transportation charge</label>
            <input type="number" value={freight || ''} onChange={(e) => setFreight(Number(e.target.value))} />
          </div>
          <div>
            <label>Discount</label>
            <input type="number" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))} />
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
