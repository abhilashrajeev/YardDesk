import { useFetch, money, qty } from '../lib/hooks';
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
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Today at a glance</h2>
        <span className="muted">{report ? report.from : ''}</span>
      </div>

      <div className="cards">
        <div className="card">
          <div className="label">Sales today</div>
          <div className="value">{money(report?.sales.total)}</div>
          <div className="muted">{report?.sales.count ?? 0} bills</div>
        </div>
        <div className="card">
          <div className="label">Purchases today</div>
          <div className="value">{money(report?.purchases.total)}</div>
          <div className="muted">{report?.purchases.count ?? 0} entries</div>
        </div>
        <div className="card">
          <div className="label">Collected</div>
          <div className="value" style={{ color: 'var(--green)' }}>{money(report?.payments.collected)}</div>
        </div>
        <div className="card">
          <div className="label">Credit given today</div>
          <div className="value" style={{ color: 'var(--red)' }}>{money(report?.creditGiven)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="panel">
          <h2>Current Stock</h2>
          <div className="body" style={{ padding: 0 }}>
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
                    <td>{m.name}</td>
                    <td className="num">
                      <span className={Number(m.currentStock) < 0 ? 'pill neg' : ''}>{qty(m.currentStock)}</span>
                    </td>
                    <td className="muted">{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Outstanding Customers</h2>
          <div className="body" style={{ padding: 0 }}>
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
                      <td>{d.name}</td>
                      <td className="num" style={{ color: 'var(--red)', fontWeight: 600 }}>{money(d.balance)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="muted" style={{ padding: 16 }}>No dues 🎉</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
