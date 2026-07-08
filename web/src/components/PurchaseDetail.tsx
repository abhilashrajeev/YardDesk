import { useFetch, money, qty, fmtDate } from '../lib/hooks';
import Modal from './Modal';
import type { Purchase } from '../types';

export default function PurchaseDetail({
  id,
  onClose,
  onChange: _onChange,
}: {
  id: string;
  onClose: () => void;
  onChange?: () => void;
}) {
  const { data: purchase } = useFetch<Purchase>(`/purchases/${id}`);
  if (!purchase) return null;

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
        <span className="muted">Freight</span><span>{money(purchase.freight)}</span>
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
    </Modal>
  );
}
