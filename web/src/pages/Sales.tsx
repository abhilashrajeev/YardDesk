import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate, statusPillClass } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import LineItems from '../components/LineItems';
import SaleDetail from '../components/SaleDetail';
import CustomerPicker from '../components/CustomerPicker';
import VehiclePicker, { type UsualVehicle } from '../components/VehiclePicker';
import PeriodFilter, { defaultPeriodState, periodRange, periodLabel } from '../components/PeriodFilter';
import type { Customer, Material, Sale, LineInput, PaymentMode, Vehicle, CustomerVehicle } from '../types';

export default function Sales() {
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('SALES');
  const [period, setPeriod] = useState(defaultPeriodState());
  const { from, to } = periodRange(period);
  const salesUrl = from ? `/sales?from=${from}&to=${to}` : '/sales';
  const { data: sales, refetch } = useFetch<Sale[]>(salesUrl);
  const { data: customers, setData: setCustomers } = useFetch<Customer[]>('/customers');
  const { data: materials } = useFetch<Material[]>('/inventory');
  const { data: vehicles, refetch: refetchVehicles } = useFetch<Vehicle[]>('/vehicles');
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(searchParams.get('new') === '1');
  const [viewId, setViewId] = useState<string | null>(null);

  // Quick Actions on the dashboard link here with ?new=1 to open the form directly;
  // strip it once applied so it doesn't reopen if the user navigates back later.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          vehicles={vehicles ?? []}
          onCustomerCreated={(c) => setCustomers([...(customers ?? []), c])}
          onDone={() => {
            setOpen(false);
            refetch();
            refetchVehicles();
          }}
        />
      )}

      <div className="panel">
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, padding: 0, border: 0 }}>Sales — {periodLabel(period)}</h2>
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
                <th>Vehicle</th>
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
                  <td className="muted">{s.vehicle?.number ?? '—'}</td>
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
                  <td colSpan={8} className="muted" style={{ padding: 16 }}>No sales for this period.</td>
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
  vehicles,
  onCustomerCreated,
  onDone,
}: {
  customers: Customer[];
  materials: Material[];
  vehicles: Vehicle[];
  onCustomerCreated: (c: Customer) => void;
  onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [customerVehicles, setCustomerVehicles] = useState<CustomerVehicle[]>([]);
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

  // Load this customer's usual vehicles so the vehicle field can prefill quantity from them.
  useEffect(() => {
    if (!customerId) {
      setCustomerVehicles([]);
      return;
    }
    let cancelled = false;
    api.get<CustomerVehicle[]>(`/customers/${customerId}/vehicles`).then(({ data }) => {
      if (!cancelled) setCustomerVehicles(data);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const usualVehicles: UsualVehicle[] = customerVehicles.map((cv) => ({
    id: cv.id,
    vehicleId: cv.vehicleId,
    vehicle: cv.vehicle,
    usualLabel: cv.extraBodyCft
      ? `${cv.quantityCft} cft + ${cv.extraBodyCft} cft extra body`
      : `${cv.quantityCft} cft`,
    quantity: Number(cv.quantityCft) + Number(cv.extraBodyCft ?? 0),
  }));

  /** Picking one of this customer's registered vehicles prefills the first line's quantity
   *  (only if it's still empty, so it never clobbers something already typed in) — still editable,
   *  since load size varies. */
  function handleSelectUsual(u: UsualVehicle) {
    if (lines.length && !lines[0].quantity) {
      setLines(lines.map((l, i) => (i === 0 ? { ...l, quantity: u.quantity } : l)));
    }
  }

  /** Same vehicle comes back daily — reuse it by number (case-insensitive), or register it on the fly. */
  async function resolveVehicleId(): Promise<string | undefined> {
    const num = vehicleNumber.trim();
    if (!num) return undefined;
    const existing = vehicles.find((v) => v.number.toLowerCase() === num.toLowerCase());
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
      await api.post('/sales', {
        customerId,
        vehicleId,
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
            <label>Vehicle number (optional)</label>
            <VehiclePicker
              usualVehicles={usualVehicles}
              allVehicles={vehicles}
              value={vehicleNumber}
              onChange={setVehicleNumber}
              onSelectUsual={handleSelectUsual}
              groupLabel="This customer's usual trucks"
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
