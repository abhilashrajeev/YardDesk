import { useState } from 'react';
import { useFetch, money, qty } from '../lib/hooks';
import { downloadCsv } from '../lib/csv';
import PeriodFilter, { defaultPeriodState, periodRange, type PeriodState } from '../components/PeriodFilter';
import type { DailyReport } from '../types';

interface MaterialRow {
  name: string;
  unit: string;
  soldQty: number;
  soldAmt: number;
  boughtQty: number;
  boughtAmt: number;
}
interface SeriesRow {
  bucket: string;
  sales: number;
  purchases: number;
}
interface ExpenseRow {
  category: string;
  count: number;
  total: number;
}
interface PeriodFinancials {
  revenue: number;
  purchaseCost: number;
  operatingExpenses: number;
  openingStockValue: number;
  closingStockValue: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
}
interface MaterialMargin {
  name: string;
  unit: string;
  soldQty: number;
  revenue: number;
  estCogs: number;
  margin: number;
  marginPct: number;
}
interface ProfitLoss extends PeriodFinancials {
  from: string;
  to: string;
  grossMarginPct: number;
  netMarginPct: number;
  expenseBreakdown: ExpenseRow[];
  materialMargins: MaterialMargin[];
  previousPeriod: PeriodFinancials & { from: string; to: string };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Trend({ current, previous }: { current: number; previous: number }) {
  const pct = pctChange(current, previous);
  if (pct === null) return <span className="muted" style={{ fontSize: 12 }}>—</span>;
  const up = pct >= 0;
  return (
    <span style={{ fontSize: 12, color: up ? 'var(--green)' : 'var(--red)' }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% vs previous period
    </span>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState<PeriodState>({ ...defaultPeriodState(), view: 'day' });
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');

  const { from, to } = periodRange(period);
  const q = `from=${from}&to=${to}`;
  const { data: summary } = useFetch<DailyReport>(`/reports/summary?${q}`);
  const { data: materials } = useFetch<MaterialRow[]>(`/reports/materials?${q}`);
  const { data: expenses } = useFetch<ExpenseRow[]>(`/reports/expenses?${q}`);
  const { data: series } = useFetch<SeriesRow[]>(`/reports/series?${q}&granularity=${granularity}`);
  const { data: pnl } = useFetch<ProfitLoss>(`/reports/profit-loss?${q}`);

  const maxVal = Math.max(1, ...(series ?? []).map((s) => Math.max(s.sales, s.purchases)));
  const expensesTotal = expenses?.reduce((s, e) => s + e.total, 0) ?? 0;

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Reports &amp; Analytics</h2>
        <div className="flex" style={{ gap: 8 }}>
          <PeriodFilter value={period} onChange={setPeriod} />
          <select value={granularity} onChange={(e) => setGranularity(e.target.value as 'day' | 'month')} style={{ width: 110 }}>
            <option value="day">Daily chart</option>
            <option value="month">Monthly chart</option>
          </select>
        </div>
      </div>

      <div className="cards">
        <div className="card">
          <div className="label">Sales</div>
          <div className="value">{money(summary?.sales.total)}</div>
          <div className="muted">{summary?.sales.count ?? 0} bills</div>
        </div>
        <div className="card">
          <div className="label">Purchases</div>
          <div className="value">{money(summary?.purchases.total)}</div>
          <div className="muted">{summary?.purchases.count ?? 0} entries</div>
        </div>
        <div className="card">
          <div className="label">Expenses</div>
          <div className="value" style={{ color: 'var(--red)' }}>{money(summary?.expenses.total)}</div>
          <div className="muted">{summary?.expenses.count ?? 0} entries</div>
        </div>
        <div className="card">
          <div className="label">Collected</div>
          <div className="value" style={{ color: 'var(--green)' }}>{money(summary?.payments.collected)}</div>
        </div>
        <div className="card">
          <div className="label">Credit given</div>
          <div className="value" style={{ color: 'var(--red)' }}>{money(summary?.creditGiven)}</div>
        </div>
      </div>

      <div className="panel">
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, padding: 0, border: 0 }}>Profit &amp; Loss</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            vs {pnl?.previousPeriod.from}{pnl?.previousPeriod.from !== pnl?.previousPeriod.to ? ` – ${pnl?.previousPeriod.to}` : ''}
          </span>
        </div>
        <div className="body">
          <div className="cards" style={{ marginBottom: 4 }}>
            <div className="card">
              <div className="label">Revenue</div>
              <div className="value">{money(pnl?.revenue)}</div>
              <Trend current={pnl?.revenue ?? 0} previous={pnl?.previousPeriod.revenue ?? 0} />
            </div>
            <div className="card">
              <div className="label">Gross profit</div>
              <div className="value" style={{ color: (pnl?.grossProfit ?? 0) < 0 ? 'var(--red)' : 'var(--green)' }}>
                {money(pnl?.grossProfit)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{pnl?.grossMarginPct ?? 0}% margin</div>
            </div>
            <div className="card">
              <div className="label">Net {(pnl?.netProfit ?? 0) < 0 ? 'loss' : 'profit'}</div>
              <div className="value" style={{ color: (pnl?.netProfit ?? 0) < 0 ? 'var(--red)' : 'var(--green)' }}>
                {money(pnl?.netProfit)}
              </div>
              <Trend current={pnl?.netProfit ?? 0} previous={pnl?.previousPeriod.netProfit ?? 0} />
            </div>
          </div>

          <table style={{ marginTop: 14 }}>
            <tbody>
              <tr>
                <td>Sales revenue</td>
                <td className="num">{money(pnl?.revenue)}</td>
              </tr>
              <tr>
                <td className="muted">Opening stock value</td>
                <td className="num muted">{money(pnl?.openingStockValue)}</td>
              </tr>
              <tr>
                <td className="muted">+ Purchases</td>
                <td className="num muted">{money(pnl?.purchaseCost)}</td>
              </tr>
              <tr>
                <td className="muted">- Closing stock value</td>
                <td className="num muted">-{money(pnl?.closingStockValue)}</td>
              </tr>
              <tr>
                <td><b>Cost of goods sold</b></td>
                <td className="num"><b>{money(pnl?.cogs)}</b></td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td><b>Gross profit</b></td>
                <td className="num"><b>{money(pnl?.grossProfit)}</b></td>
              </tr>
              <tr>
                <td>Less: Operating expenses</td>
                <td className="num">-{money(pnl?.operatingExpenses)}</td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--border)', fontSize: 16 }}>
                <td><b>Net {(pnl?.netProfit ?? 0) < 0 ? 'loss' : 'profit'}</b></td>
                <td className="num">
                  <b style={{ color: (pnl?.netProfit ?? 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{money(pnl?.netProfit)}</b>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            COGS = opening stock + purchases - closing stock, with stock valued at each material's current purchase rate
            (no batch/FIFO cost history is tracked, so this is an approximation, not exact historical costing).
          </div>

          {!!pnl?.materialMargins.length && (
            <>
              <h3 style={{ marginTop: 18, marginBottom: 8 }}>Margin by material</h3>
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="num">Sold qty</th>
                    <th className="num">Revenue</th>
                    <th className="num">Est. COGS</th>
                    <th className="num">Margin</th>
                    <th className="num">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.materialMargins.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name} <span className="muted">({m.unit})</span></td>
                      <td className="num">{qty(m.soldQty)}</td>
                      <td className="num">{money(m.revenue)}</td>
                      <td className="num">{money(m.estCogs)}</td>
                      <td className="num" style={{ color: m.margin < 0 ? 'var(--red)' : 'var(--green)' }}>{money(m.margin)}</td>
                      <td className="num">{m.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Sales vs Purchases</h2>
        <div className="body">
          {series?.length ? (
            series.map((s) => (
              <div key={s.bucket} style={{ marginBottom: 10 }}>
                <div className="between" style={{ fontSize: 13, marginBottom: 3 }}>
                  <span>{s.bucket}</span>
                  <span className="muted">sales {money(s.sales)} · purch {money(s.purchases)}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, height: 16 }}>
                  <div style={{ width: `${(s.sales / maxVal) * 100}%`, background: 'var(--green)', borderRadius: 3 }} />
                  <div style={{ width: `${(s.purchases / maxVal) * 100}%`, background: 'var(--primary)', borderRadius: 3 }} />
                </div>
              </div>
            ))
          ) : (
            <div className="muted">No data for this range.</div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, padding: 0, border: 0 }}>Material Breakdown</h2>
            <button
              className="btn sm ghost"
              disabled={!materials?.length}
              onClick={() =>
                downloadCsv(
                  `material-breakdown-${from}-${to}`,
                  [
                    { header: 'Material', value: (m: MaterialRow) => m.name },
                    { header: 'Unit', value: (m: MaterialRow) => m.unit },
                    { header: 'Sold Qty', value: (m: MaterialRow) => m.soldQty },
                    { header: 'Sold ₹', value: (m: MaterialRow) => m.soldAmt },
                    { header: 'Bought Qty', value: (m: MaterialRow) => m.boughtQty },
                    { header: 'Bought ₹', value: (m: MaterialRow) => m.boughtAmt },
                  ],
                  materials ?? [],
                )
              }
            >
              Export CSV
            </button>
          </div>
          <div className="body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="num">Sold qty</th>
                  <th className="num">Sold ₹</th>
                  <th className="num">Bought qty</th>
                  <th className="num">Bought ₹</th>
                </tr>
              </thead>
              <tbody>
                {materials?.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name} <span className="muted">({m.unit})</span></td>
                    <td className="num">{qty(m.soldQty)}</td>
                    <td className="num">{money(m.soldAmt)}</td>
                    <td className="num">{qty(m.boughtQty)}</td>
                    <td className="num">{money(m.boughtAmt)}</td>
                  </tr>
                ))}
                {materials?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: 16 }}>No activity for this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, padding: 0, border: 0 }}>Expenses by Category</h2>
            <div className="flex" style={{ gap: 12, alignItems: 'center' }}>
              <span>Total: <strong>{money(expensesTotal)}</strong></span>
              <button
                className="btn sm ghost"
                disabled={!expenses?.length}
                onClick={() =>
                  downloadCsv(
                    `expenses-by-category-${from}-${to}`,
                    [
                      { header: 'Category', value: (e: ExpenseRow) => e.category },
                      { header: 'Count', value: (e: ExpenseRow) => e.count },
                      { header: 'Total', value: (e: ExpenseRow) => e.total },
                    ],
                    expenses ?? [],
                  )
                }
              >
                Export CSV
              </button>
            </div>
          </div>
          <div className="body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Count</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses?.map((e) => (
                  <tr key={e.category}>
                    <td>{e.category}</td>
                    <td className="num">{e.count}</td>
                    <td className="num">{money(e.total)}</td>
                  </tr>
                ))}
                {expenses?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted" style={{ padding: 16 }}>No expenses for this range.</td>
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
