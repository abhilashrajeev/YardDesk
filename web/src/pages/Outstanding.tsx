import { useState } from 'react';
import { useFetch, money, fmtDate, statusPillClass } from '../lib/hooks';
import { Icon } from '../components/Icon';
import SaleDetail from '../components/SaleDetail';
import PurchaseDetail from '../components/PurchaseDetail';
import type { Sale, Purchase, Outstanding as OutstandingParty } from '../types';

export default function Outstanding() {
  const { data: custBal, loading: custLoading } = useFetch<OutstandingParty[]>('/accounts/outstanding/customers');
  const { data: vendBal, loading: vendLoading } = useFetch<OutstandingParty[]>('/accounts/outstanding/vendors');
  const { data: pendingSales, loading: salesLoading, refetch: refetchSales } = useFetch<Sale[]>('/sales/outstanding');
  const { data: pendingPurchases, loading: purchasesLoading, refetch: refetchPurchases } = useFetch<Purchase[]>('/purchases/outstanding');
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);
  const [viewPurchaseId, setViewPurchaseId] = useState<string | null>(null);

  const custTotal = custBal?.reduce((s, c) => s + c.balance, 0) ?? 0;
  const vendTotal = vendBal?.reduce((s, v) => s + v.balance, 0) ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Outstanding &amp; Pending</h2>
          <div className="sub">Who owes us, who we owe, and every bill/PO still open</div>
        </div>
      </div>

      <div className="cards">
        <div className="stat">
          <div className="stat-icon red"><Icon name="users" /></div>
          <div>
            <div className="label">Customers owe us</div>
            <div className="value">{money(custTotal)}</div>
            <div className="sub">{custBal?.length ?? 0} accounts</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon blue"><Icon name="briefcase" /></div>
          <div>
            <div className="label">We owe vendors</div>
            <div className="value">{money(vendTotal)}</div>
            <div className="sub">{vendBal?.length ?? 0} accounts</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon amber"><Icon name="cart" /></div>
          <div>
            <div className="label">Pending bills</div>
            <div className="value">{pendingSales?.length ?? 0}</div>
            <div className="sub">not fully paid</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon green"><Icon name="truck" /></div>
          <div>
            <div className="label">Pending POs</div>
            <div className="value">{pendingPurchases?.length ?? 0}</div>
            <div className="sub">outstanding to vendors</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2><Icon name="users" size={17} /> Outstanding Customers</h2>
          <table>
            <thead>
              <tr><th>Customer</th><th className="num">Balance</th></tr>
            </thead>
            <tbody>
              {custLoading ? (
                <tr><td colSpan={2} className="muted" style={{ padding: 16 }}>Loading…</td></tr>
              ) : custBal?.length ? (
                custBal.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>{money(c.balance)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={2} className="muted" style={{ padding: 16 }}>No customer dues.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h2><Icon name="briefcase" size={17} /> Outstanding Vendors</h2>
          <table>
            <thead>
              <tr><th>Vendor</th><th className="num">We owe</th></tr>
            </thead>
            <tbody>
              {vendLoading ? (
                <tr><td colSpan={2} className="muted" style={{ padding: 16 }}>Loading…</td></tr>
              ) : vendBal?.length ? (
                vendBal.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 500 }}>{v.name}</td>
                    <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>{money(v.balance)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={2} className="muted" style={{ padding: 16 }}>No vendor dues.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2><Icon name="cart" size={17} /> Payments Pending — Sales</h2>
        <table>
          <thead>
            <tr>
              <th>Bill No.</th><th>Date</th><th>Customer</th>
              <th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {salesLoading ? (
              <tr><td colSpan={8} className="muted" style={{ padding: 16 }}>Loading…</td></tr>
            ) : pendingSales?.length ? (
              pendingSales.map((s) => (
                <tr key={s.id}>
                  <td>#{s.billNo}</td>
                  <td>{fmtDate(s.date)}</td>
                  <td>{s.customer?.name}</td>
                  <td className="num">{money(s.total)}</td>
                  <td className="num">{money(s.paidAmount)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--red)' }}>{money(s.balance)}</td>
                  <td><span className={`pill ${statusPillClass(s.paymentStatus)}`}>{s.paymentStatus}</span></td>
                  <td className="right">
                    <button className="btn ghost sm" onClick={() => setViewSaleId(s.id)}>View</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className="muted" style={{ padding: 16 }}>Every bill is settled.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2><Icon name="truck" size={17} /> Payments Pending — Purchases</h2>
        <table>
          <thead>
            <tr>
              <th>Invoice</th><th>Date</th><th>Vendor</th>
              <th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {purchasesLoading ? (
              <tr><td colSpan={8} className="muted" style={{ padding: 16 }}>Loading…</td></tr>
            ) : pendingPurchases?.length ? (
              pendingPurchases.map((p) => (
                <tr key={p.id}>
                  <td>{p.invoiceNo ?? '—'}</td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.vendor?.name}</td>
                  <td className="num">{money(p.total)}</td>
                  <td className="num">{money(p.paidAmount)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--red)' }}>{money(p.balance)}</td>
                  <td><span className={`pill ${statusPillClass(p.paymentStatus)}`}>{p.paymentStatus}</span></td>
                  <td className="right">
                    <button className="btn ghost sm" onClick={() => setViewPurchaseId(p.id)}>View</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className="muted" style={{ padding: 16 }}>No purchase balances outstanding.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {viewSaleId && (
        <SaleDetail
          id={viewSaleId}
          onClose={() => setViewSaleId(null)}
          onChange={refetchSales}
        />
      )}
      {viewPurchaseId && (
        <PurchaseDetail id={viewPurchaseId} onClose={() => setViewPurchaseId(null)} onChange={refetchPurchases} />
      )}
    </>
  );
}
