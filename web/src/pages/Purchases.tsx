import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate, statusPillClass } from '../lib/hooks';
import { downloadCsv } from '../lib/csv';
import { useAuth } from '../auth/AuthContext';
import PurchaseLineItems from '../components/PurchaseLineItems';
import PurchaseDetail from '../components/PurchaseDetail';
import ExportCsvButton from '../components/ExportCsvButton';
import VendorPicker from '../components/VendorPicker';
import VehiclePicker, { type UsualVehicle } from '../components/VehiclePicker';
import PeriodFilter, { defaultPeriodState, periodRange, periodLabel } from '../components/PeriodFilter';
import type { Vendor, Material, Purchase, LineInput, PaymentMode, Vehicle, VendorVehicle } from '../types';

export default function Purchases() {
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('PURCHASES');
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const [period, setPeriod] = useState(defaultPeriodState());
  const { from, to } = periodRange(period);
  const purchasesUrl = from ? `/purchases?from=${from}&to=${to}` : '/purchases';
  const { data: purchases, refetch } = useFetch<Purchase[]>(purchasesUrl);
  const { data: vendors, setData: setVendors } = useFetch<Vendor[]>('/vendors');
  const { data: materials } = useFetch<Material[]>('/inventory');
  const { data: vehicles, refetch: refetchVehicles } = useFetch<Vehicle[]>('/vehicles');
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(searchParams.get('new') === '1');
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewEdit, setViewEdit] = useState(false);

  async function quickDelete(p: Purchase) {
    if (!confirm('Delete this purchase? Stock and ledger effects will be reversed.')) return;
    try {
      await api.delete(`/purchases/${p.id}`);
      refetch();
    } catch (e) {
      alert(apiError(e));
    }
  }

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

  const active = purchases?.filter((p) => p.status !== 'CANCELLED') ?? [];
  const periodTotal = active.reduce((sum, p) => sum + Number(p.total), 0);

  async function exportCsv(exportFrom: string, exportTo: string) {
    const { data } = await api.get<Purchase[]>(`/purchases?from=${exportFrom}&to=${exportTo}`);
    downloadCsv(
      `purchases-${exportFrom}-${exportTo}`,
      [
        { header: 'Invoice #', value: (p: Purchase) => p.invoiceNo ?? '' },
        { header: 'Date', value: (p: Purchase) => fmtDate(p.date) },
        { header: 'Vendor', value: (p: Purchase) => p.vendor?.name ?? '' },
        { header: 'Vehicle', value: (p: Purchase) => p.vehicle?.number ?? '' },
        { header: 'Total', value: (p: Purchase) => p.total },
        { header: 'Paid', value: (p: Purchase) => p.paidAmount ?? '' },
        { header: 'Balance', value: (p: Purchase) => p.balance ?? '' },
        { header: 'Status', value: (p: Purchase) => (p.status === 'CANCELLED' ? 'CANCELLED' : p.paymentStatus ?? '') },
      ],
      data,
    );
  }

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Purchases</h2>
        <div className="flex" style={{ gap: 8 }}>
          <ExportCsvButton onExport={exportCsv} defaultFrom={from || undefined} defaultTo={to || undefined} />
          {canCreate && (
            <button className="btn" onClick={() => setOpen((o) => !o)}>
              {open ? 'Close' : '+ New Purchase'}
            </button>
          )}
        </div>
      </div>

      {open && canCreate && vendors && materials && (
        <NewPurchase
          vendors={vendors}
          onVendorCreated={(v) => setVendors([...(vendors ?? []), v])}
          materials={materials}
          vehicles={vehicles ?? []}
          onDone={() => {
            setOpen(false);
            refetch();
            refetchVehicles();
          }}
        />
      )}

      <div className="panel">
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, padding: 0, border: 0 }}>Purchases — {periodLabel(period)}</h2>
          <PeriodFilter value={period} onChange={setPeriod} allowRecent />
        </div>
        <div className="between" style={{ padding: '10px 16px' }}>
          <span className="muted">{active.length} entr{active.length === 1 ? 'y' : 'ies'}</span>
          <span>Total: <strong>{money(periodTotal)}</strong></span>
        </div>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Vehicle</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {purchases?.map((p) => (
                <tr key={p.id}>
                  <td>{p.invoiceNo ?? '—'}</td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.vendor?.name}</td>
                  <td className="muted">{p.vehicle?.number ?? '—'}</td>
                  <td className="num">{money(p.total)}</td>
                  <td>
                    {p.status === 'CANCELLED' ? (
                      <span className="pill neg">CANCELLED</span>
                    ) : (
                      p.paymentStatus && (
                        <span className={`pill ${statusPillClass(p.paymentStatus)}`}>{p.paymentStatus}</span>
                      )
                    )}
                  </td>
                  <td className="right">
                    <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn ghost sm" onClick={() => { setViewId(p.id); setViewEdit(false); }}>View</button>
                      {isAdmin && p.status !== 'CANCELLED' && (
                        <>
                          <button className="btn ghost sm" onClick={() => { setViewId(p.id); setViewEdit(true); }}>Edit</button>
                          <button className="btn ghost sm" onClick={() => quickDelete(p)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {purchases?.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 16 }}>No purchases for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewId && (
        <PurchaseDetail
          id={viewId}
          startInEdit={viewEdit}
          onClose={() => { setViewId(null); setViewEdit(false); }}
          onChange={refetch}
        />
      )}
    </>
  );
}

function NewPurchase({
  vendors,
  onVendorCreated,
  materials,
  vehicles,
  onDone,
}: {
  vendors: Vendor[];
  onVendorCreated: (vendor: Vendor) => void;
  materials: Material[];
  vehicles: Vehicle[];
  onDone: () => void;
}) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNo, setInvoiceNo] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vendorVehicles, setVendorVehicles] = useState<VendorVehicle[]>([]);
  const [freight, setFreight] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [lines, setLines] = useState<LineInput[]>([
    { materialId: materials[0]?.id ?? '', quantity: 0, rate: Number(materials[0]?.purchaseRate ?? materials[0]?.defaultRate ?? 0), unit: materials[0]?.unit },
  ]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const subTotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const total = subTotal + Number(freight);

  // Load this vendor's usual vehicles so the vehicle field can prefill quantity from them.
  useEffect(() => {
    if (!vendorId) {
      setVendorVehicles([]);
      return;
    }
    let cancelled = false;
    api.get<VendorVehicle[]>(`/vendors/${vendorId}/vehicles`).then(({ data }) => {
      if (!cancelled) setVendorVehicles(data);
    });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const usualVehicles: UsualVehicle[] = vendorVehicles.map((vv) => ({
    id: vv.id,
    vehicleId: vv.vehicleId,
    vehicle: vv.vehicle,
    usualLabel: String(vv.defaultQuantity),
    quantity: Number(vv.defaultQuantity),
  }));

  /** Picking one of this vendor's registered vehicles prefills the first line's quantity
   *  (only if it's still empty, so it never clobbers something already typed in) — still editable,
   *  since the same truck doesn't always bring the same amount. */
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
      await api.post('/purchases', {
        vendorId,
        vehicleId,
        date,
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
            <VendorPicker
              vendors={vendors}
              value={vendorId}
              onChange={setVendorId}
              onCreated={onVendorCreated}
            />
          </div>
          <div>
            <label>Vendor invoice # (optional)</label>
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div>
            <label>Vehicle number (optional)</label>
            <VehiclePicker
              usualVehicles={usualVehicles}
              allVehicles={vehicles}
              value={vehicleNumber}
              onChange={setVehicleNumber}
              onSelectUsual={handleSelectUsual}
              groupLabel="This vendor's usual trucks"
            />
          </div>
          <div>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>

        <PurchaseLineItems materials={materials} lines={lines} onChange={setLines} />

        <div className="row" style={{ marginTop: 14 }}>
          <div>
            <label>Transportation charge</label>
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
