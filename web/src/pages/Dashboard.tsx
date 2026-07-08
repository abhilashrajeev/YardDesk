import { useFetch, money, qty, fmtDate } from '../lib/hooks';
import { Icon } from '../components/Icon';
import type { DailyReport, Material } from '../types';

interface Outstanding {
  id: string;
  name: string;
  balance: number;
}

export default function Dashboard() {
  const { data: report } = useFetch<DailyReport>('/reports/daily');
  const { data: stock } = useFetch<Material[]>('/inventory');
  const { data: dues } = useFetch<Outstanding[]>('/accounts/outstanding/customers');

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Today at a glance</h2>
          <div className="sub">{report ? fmtDate(report.from) : ''}</div>
        </div>
      </div>

      <div className="cards">
        <div className="stat">
          <div className="stat-icon amber"><Icon name="cart" /></div>
          <div>
            <div className="label">Sales today</div>
            <div className="value">{money(report?.sales.total)}</div>
            <div className="sub">{report?.sales.count ?? 0} bills</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon blue"><Icon name="truck" /></div>
          <div>
            <div className="label">Purchases today</div>
            <div className="value">{money(report?.purchases.total)}</div>
            <div className="sub">{report?.purchases.count ?? 0} entries</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon green"><Icon name="up" /></div>
          <div>
            <div className="label">Collected</div>
            <div className="value">{money(report?.payments.collected)}</div>
            <div className="sub">received today</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon red"><Icon name="down" /></div>
          <div>
            <div className="label">Credit given</div>
            <div className="value">{money(report?.creditGiven)}</div>
            <div className="sub">outstanding added</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2><Icon name="box" size={17} /> Current Stock</h2>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th className="num">Stock</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {stock?.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td className="num">
                    {Number(m.currentStock) < 0 ? (
                      <span className="pill neg">{qty(m.currentStock)}</span>
                    ) : (
                      qty(m.currentStock)
                    )}
                  </td>
                  <td className="muted">{m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2><Icon name="wallet" size={17} /> Outstanding Customers</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Owes</th>
              </tr>
            </thead>
            <tbody>
              {dues?.length ? (
                dues.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>{money(d.balance)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="muted" style={{ padding: 18 }}>No dues 🎉</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
