import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useFetch, money, qty, fmtDate } from '../lib/hooks';
import { Icon } from '../components/Icon';
import TrendChart from '../components/TrendChart';
import type { DailyReport, Material, Outstanding } from '../types';

function monthRange() {
  // Shift to IST before formatting — new Date(y, m, 1).toISOString() rolls back to the
  // previous day for IST users, since local midnight IST is still the previous UTC day.
  const to = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const from = `${to.slice(0, 7)}-01`;
  return { from, to };
}

/** Trailing 14-day window (IST), for the dashboard's at-a-glance trend chart. */
function last14DaysRange() {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now.getTime() - 13 * 86400000);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

interface SeriesPoint {
  bucket: string;
  sales: number;
  purchases: number;
}

function ReportCards({ report, salesLabel, purchasesLabel, collectedLabel }: {
  report: DailyReport | null;
  salesLabel: string;
  purchasesLabel: string;
  collectedLabel: string;
}) {
  return (
    <div className="cards">
      <div className="stat">
        <div className="stat-icon amber"><Icon name="cart" /></div>
        <div>
          <div className="label">{salesLabel}</div>
          <div className="value">{money(report?.sales.total)}</div>
          <div className="sub">{report?.sales.count ?? 0} bills</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-icon blue"><Icon name="truck" /></div>
        <div>
          <div className="label">{purchasesLabel}</div>
          <div className="value">{money(report?.purchases.total)}</div>
          <div className="sub">{report?.purchases.count ?? 0} entries</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-icon green"><Icon name="up" /></div>
        <div>
          <div className="label">Collected</div>
          <div className="value">{money(report?.payments.collected)}</div>
          <div className="sub">{collectedLabel}</div>
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
  );
}

/** Deterministic pastel-ish color per name, for the small initials avatars below. */
const AVATAR_PALETTE = ['#ae2a2e', '#2563eb', '#7c3aed', '#059669', '#b8863b', '#0891b2', '#db2777'];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function stockStatus(stock: number): { label: string; cls: string } {
  if (stock < 0) return { label: 'Low Stock', cls: 'neg' };
  if (stock === 0) return { label: 'Out of Stock', cls: 'gray' };
  return { label: 'In Stock', cls: 'pos' };
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const can = (p: 'SALES' | 'PURCHASES' | 'PAYMENTS' | 'EXPENSES') =>
    user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes(p);

  const { data: report } = useFetch<DailyReport>('/reports/daily');
  const { from, to } = monthRange();
  const { data: monthReport } = useFetch<DailyReport>(`/reports/summary?from=${from}&to=${to}`);
  const { data: stock } = useFetch<Material[]>('/inventory');
  const { data: dues } = useFetch<Outstanding[]>('/accounts/outstanding/customers');
  const trendRange = last14DaysRange();
  const { data: series } = useFetch<SeriesPoint[]>(
    isAdmin ? `/reports/series?from=${trendRange.from}&to=${trendRange.to}&granularity=day` : null,
  );

  return (
    <>
      <div className="panel">
        <h2><Icon name="zap" size={17} /> Quick Actions</h2>
        <div className="body">
          <div className="qa-bar">
            {can('SALES') && (
              <Link to="/sales?new=1" className="qa-btn">
                <div className="qa-icon"><Icon name="cart" size={16} /></div> New Sale
              </Link>
            )}
            {can('PURCHASES') && (
              <Link to="/purchases?new=1" className="qa-btn">
                <div className="qa-icon"><Icon name="truck" size={16} /></div> New Purchase
              </Link>
            )}
            {can('PAYMENTS') && (
              <Link to="/payments" className="qa-btn">
                <div className="qa-icon"><Icon name="wallet" size={16} /></div> Add Payment
              </Link>
            )}
            {can('EXPENSES') && (
              <Link to="/expenses" className="qa-btn">
                <div className="qa-icon"><Icon name="receipt" size={16} /></div> Add Expense
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="page-head" style={{ marginTop: 24 }}>
        <div>
          <h2>Today at a glance</h2>
          <div className="sub">{report ? fmtDate(report.from) : ''}</div>
        </div>
      </div>

      <ReportCards report={report} salesLabel="Sales today" purchasesLabel="Purchases today" collectedLabel="received today" />

      <div className="page-head" style={{ marginTop: 24 }}>
        <div>
          <h2>This month</h2>
          <div className="sub">{monthReport ? `${fmtDate(monthReport.from)} – ${fmtDate(monthReport.to)}` : ''}</div>
        </div>
      </div>

      <ReportCards report={monthReport} salesLabel="Sales this month" purchasesLabel="Purchases this month" collectedLabel="received this month" />

      {isAdmin && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, padding: 0, border: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="chart" size={17} /> Sales &amp; Purchases — Last 14 Days
            </h2>
            <Link to="/reports" className="view-all">
              Full Reports <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <div className="body">
            <TrendChart data={series ?? []} />
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="panel">
          <div className="between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, padding: 0, border: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="box" size={17} /> Current Stock
            </h2>
            <Link to="/inventory" className="view-all">
              View All <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th className="num">Stock</th>
                <th>Unit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stock?.slice(0, 7).map((m) => {
                const st = stockStatus(Number(m.currentStock));
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td className="num">{qty(m.currentStock)}</td>
                    <td className="muted">{m.unit}</td>
                    <td><span className={`pill ${st.cls}`}>{st.label}</span></td>
                  </tr>
                );
              })}
              {stock?.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ padding: 18 }}>No materials yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, padding: 0, border: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="wallet" size={17} /> Outstanding Customers
            </h2>
            <Link to="/outstanding" className="view-all">
              View All <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Owes</th>
              </tr>
            </thead>
            <tbody>
              {dues?.length ? (
                dues.slice(0, 7).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="flex" style={{ gap: 10 }}>
                        <div className="mini-avatar" style={{ background: avatarColor(d.name) }}>{initials(d.name)}</div>
                        <span style={{ fontWeight: 500 }}>{d.name}</span>
                      </div>
                    </td>
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
