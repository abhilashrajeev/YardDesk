interface SeriesPoint {
  bucket: string;
  sales: number;
  purchases: number;
}

const W = 640;
const H = 200;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

function linePath(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** Short label for a bucket string ("2026-07-12" -> "12 Jul", "2026-07" -> "Jul 2026"). */
function bucketLabel(bucket: string) {
  const isMonth = bucket.length === 7;
  const d = new Date(isMonth ? `${bucket}-01` : bucket);
  return isMonth
    ? d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

/**
 * Sales-vs-purchases trend line, matching the color convention already used on
 * the Reports page (green = sales, primary/maroon = purchases): identity stays
 * consistent with the same two series shown as bars there.
 */
export default function TrendChart({ data }: { data: SeriesPoint[] }) {
  if (!data.length) {
    return <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>No activity for this range.</div>;
  }

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.sales, d.purchases)));
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => PAD_L + i * stepX;
  const y = (v: number) => PAD_T + innerH - (v / maxVal) * innerH;

  const salesPts = data.map((d, i) => ({ x: x(i), y: y(d.sales) }));
  const purchPts = data.map((d, i) => ({ x: x(i), y: y(d.purchases) }));

  // Grid lines at 0/25/50/75/100% of the max value.
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  // Show at most ~7 x-axis labels so they don't collide on longer ranges.
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div>
      <div className="flex" style={{ gap: 16, marginBottom: 6, fontSize: 12.5 }}>
        <span className="flex" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green)', display: 'inline-block' }} />
          <span className="muted">Sales</span>
        </span>
        <span className="flex" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--primary)', display: 'inline-block' }} />
          <span className="muted">Purchases</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Sales vs purchases trend">
        {gridSteps.map((g) => {
          const gy = PAD_T + innerH - g * innerH;
          return (
            <g key={g}>
              <line x1={PAD_L} y1={gy} x2={W - PAD_R} y2={gy} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
                {money(maxVal * g)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.bucket} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {bucketLabel(d.bucket)}
            </text>
          ) : null,
        )}

        <path d={linePath(purchPts)} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={linePath(salesPts)} fill="none" stroke="var(--green)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => (
          <g key={d.bucket}>
            <circle cx={x(i)} cy={y(d.sales)} r={3} fill="var(--green)">
              <title>{`${bucketLabel(d.bucket)} — Sales: ${money(d.sales)}`}</title>
            </circle>
            <circle cx={x(i)} cy={y(d.purchases)} r={3} fill="var(--primary)">
              <title>{`${bucketLabel(d.bucket)} — Purchases: ${money(d.purchases)}`}</title>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}
