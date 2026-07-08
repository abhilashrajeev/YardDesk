import { api, apiError } from '../api/client';
import { useFetch, money, qty, fmtDate } from '../lib/hooks';
import Modal from './Modal';
import type { Sale } from '../types';

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

  async function issuePass(kind: 'gate-pass' | 'loading-pass') {
    try {
      await api.post(`/sales/${id}/${kind}`);
      await refetch();
      onChange?.();
    } catch (e) {
      alert(apiError(e));
    }
  }

  if (!sale) return null;

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
        <span className="muted">Freight</span><span>{money(sale.freight)}</span>
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
      </div>
    </Modal>
  );
}
