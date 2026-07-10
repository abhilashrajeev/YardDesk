import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate, statusPillClass } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import LineItems from '../components/LineItems';
import SaleDetail from '../components/SaleDetail';
import CustomerPicker from '../components/CustomerPicker';
import PeriodFilter, { defaultPeriodState, periodRange, periodLabel } from '../components/PeriodFilter';
import type { Customer, Material, Sale, LineInput, PaymentMode } from '../types';

export default function Sales() {
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('SALES');
  const [period, setPeriod] = useState(defaultPeriodState());
  const { from, to } = periodRange(period);
  const salesUrl = from ? `/sales?from=${from}&to=${to}` : '/sales';
  const { data: sales, refetch } = useFetch<Sale[]>(salesUrl);
  const { data: customers, setData: setCustomers } = useFetch<Customer[]>('/customers');
  const { data: materials } = useFetch<Material[]>('/inventory');
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const active = sales?.filter((s) => s.status !== 'CANCELLED') ?? [];
  const periodTotal = active.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Sales &amp; Billing</h2>
        {canCreate && (
          <button className="btn" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : '+ New Sale'}
          </button>
        )}
      </div>

      {open && canCreate && customers && materials && (
        <NewSale
          customers={customers}
          materials={materials}
          onCustomerCreated={(c) => setCustomers([...(customers ?? []), c])}
          onDone={() => {
            setOpen(false);
            refetch();
          }}
        />
      )}

      <div className="panel">
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Sales — {periodLabel(period)}</h2>
          <PeriodFilter value={period} onChange={setPeriod} allowRecent />
        </div>
        <div className="between" style={{ padding: '10px 16px' }}>
          <span className="muted">{active.length} bill{active.length === 1 ? '' : 's'}</span>
          <span>Total: <strong>{money(periodTotal)}</strong></span>
        </div>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Mode</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th></th>
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
                  <td>
                    {s.status === 'CANCELLED' ? (
                      <span className="pill neg">CANCELLED</span>
                    ) : (
                      s.paymentStatus && (
                        <span className={`pill ${statusPillClass(s.paymentStatus)}`}>{s.paymentStatus}</span>
                      )
                    )}
                  </td>
                  <td className="right">
                    <button className="btn ghost sm" onClick={() => setViewId(s.id)}>View</button>
                  </td>
                </tr>
              ))}
              {sales?.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 16 }}>No sales for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewId && <SaleDetail id={viewId} onClose={() => setViewId(null)} onChange={refetch} />}
    </>
  );
}

function NewSale({
  customers,
  materials,
  onCustomerCreated,
  onDone,
}: {
  customers: Customer[];
  materials: Material[];
  onCustomerCreated: (c: Customer) => void;
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
            <CustomerPicker
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              onCreated={onCustomerCreated}
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
