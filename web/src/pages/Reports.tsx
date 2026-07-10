import { useState } from 'react';
import { useFetch, money, qty } from '../lib/hooks';
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

export default function Reports() {
  const [period, setPeriod] = useState<PeriodState>({ ...defaultPeriodState(), view: 'day' });
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');

  const { from, to } = periodRange(period);
  const q = `from=${from}&to=${to}`;
  const { data: summary } = useFetch<DailyReport>(`/reports/summary?${q}`);
  const { data: materials } = useFetch<MaterialRow[]>(`/reports/materials?${q}`);
  const { data: expenses } = useFetch<ExpenseRow[]>(`/reports/expenses?${q}`);
  const { data: series } = useFetch<SeriesRow[]>(`/reports/series?${q}&granularity=${granularity}`);

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
          <h2>Material Breakdown</h2>
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
            <h2 style={{ margin: 0 }}>Expenses by Category</h2>
            <span>Total: <strong>{money(expensesTotal)}</strong></span>
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
