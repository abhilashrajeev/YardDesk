import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, qty } from '../lib/hooks';

interface Row {
  materialId: string;
  name: string;
  unit: string;
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
}

function today() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function DayClose() {
  const [date, setDate] = useState(today());
  const { data: rows, refetch } = useFetch<Row[]>(`/day-close/preview?date=${date}`);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function lock() {
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const { data } = await api.post('/day-close', { date });
      setMsg(`Locked ${data.rows.length} materials for ${data.businessDate}.`);
      refetch();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Day Close</h2>
        <div className="flex">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
          <button className="btn" onClick={lock} disabled={saving}>
            {saving ? 'Closing…' : 'Lock Day'}
          </button>
        </div>
      </div>
      {error && <div className="err">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="panel">
        <h2>Stock movement for {date}</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Unit</th>
                <th className="num">Opening</th>
                <th className="num">In</th>
                <th className="num">Out</th>
                <th className="num">Closing</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.materialId}>
                  <td>{r.name}</td>
                  <td className="muted">{r.unit}</td>
                  <td className="num">{qty(r.opening)}</td>
                  <td className="num" style={{ color: 'var(--green)' }}>{qty(r.totalIn)}</td>
                  <td className="num" style={{ color: 'var(--red)' }}>{qty(r.totalOut)}</td>
                  <td className="num"><strong>{qty(r.closing)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
