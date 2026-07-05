import { useState } from 'react';
import { useFetch, money, qty } from '../lib/hooks';
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

function monthStart() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return `${d.toISOString().slice(0, 7)}-01`;
}
function today() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function Reports() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');

  const q = `from=${from}&to=${to}`;
  const { data: summary } = useFetch<DailyReport>(`/reports/summary?${q}`);
  const { data: materials } = useFetch<MaterialRow[]>(`/reports/materials?${q}`);
  const { data: series } = useFetch<SeriesRow[]>(`/reports/series?${q}&granularity=${granularity}`);

  const maxVal = Math.max(1, ...(series ?? []).map((s) => Math.max(s.sales, s.purchases)));

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Reports &amp; Analytics</h2>
        <div className="flex">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
          <span className="muted">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} />
          <select value={granularity} onChange={(e) => setGranularity(e.target.value as any)} style={{ width: 110 }}>
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
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
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
