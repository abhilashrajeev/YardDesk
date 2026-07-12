import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import type { Payment } from '../types';

/**
 * Shows payments already linked to a sale/purchase, plus (for admins) a picker
 * to link an existing unallocated payment from the same customer/vendor — for
 * payments that were recorded generally (e.g. from the Payments page) rather
 * than from within this specific invoice.
 */
export default function PaymentAllocation({
  payments,
  partyType,
  partyId,
  txnId,
  canEdit,
  onChange,
}: {
  payments: Payment[];
  partyType: 'CUSTOMER' | 'VENDOR';
  partyId?: string;
  txnId: string;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const partyParam = partyType === 'CUSTOMER' ? 'customerId' : 'vendorId';
  const { data: candidates, refetch: refetchCandidates } = useFetch<Payment[]>(
    linking && partyId ? `/accounts/payments?${partyParam}=${partyId}&unallocated=true` : null,
  );

  async function link() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await api.patch(`/accounts/payments/${selected}/allocate`, { txnId });
      setLinking(false);
      setSelected('');
      onChange();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function unlink(paymentId: string) {
    if (!confirm('Unlink this payment from this invoice? The payment itself is kept — only the link is removed.')) return;
    try {
      await api.patch(`/accounts/payments/${paymentId}/allocate`, { txnId: null });
      onChange();
    } catch (e) {
      alert(apiError(e));
    }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div className="between">
        <label style={{ margin: 0 }}>Linked payments</label>
        {canEdit && !linking && (
          <button type="button" className="btn ghost sm" onClick={() => { setLinking(true); refetchCandidates(); }}>
            + Link a payment
          </button>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>No payments linked yet.</div>
      ) : (
        <table style={{ marginTop: 6 }}>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="muted">{fmtDate(p.date)}</td>
                <td>{p.mode}</td>
                <td className="num">{money(p.amount)}</td>
                <td className="right">
                  {canEdit && (
                    <button type="button" className="btn ghost sm" onClick={() => unlink(p.id)}>Unlink</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {linking && (
        <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
          <div>
            <label>Unlinked {partyType === 'CUSTOMER' ? "customer's" : "vendor's"} payments</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a payment</option>
              {candidates?.map((p) => (
                <option key={p.id} value={p.id}>
                  {fmtDate(p.date)} — {money(p.amount)} ({p.mode})
                </option>
              ))}
            </select>
            {candidates?.length === 0 && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>No unlinked payments found for this party.</div>
            )}
          </div>
          <div className="flex" style={{ gap: 6, flex: '0 0 auto' }}>
            <button type="button" className="btn ghost sm" onClick={() => { setLinking(false); setSelected(''); setError(''); }}>Cancel</button>
            <button type="button" className="btn sm" disabled={!selected || busy} onClick={link}>{busy ? 'Linking…' : 'Link'}</button>
          </div>
        </div>
      )}
      {error && <div className="err" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}
