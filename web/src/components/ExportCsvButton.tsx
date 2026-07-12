import { useState } from 'react';

/**
 * "Export CSV" button that first asks for a From/To date range in a centered
 * modal (dimmed backdrop, like the mobile nav drawer), then hands it to the
 * caller — which re-fetches data scoped to exactly that range rather than
 * exporting whatever happens to be on screen (list pages cap "Recent" views
 * at ~100 rows, so this is also how you get a true full-range export).
 */
export default function ExportCsvButton({
  onExport,
  disabled,
  label = 'Export CSV',
  defaultFrom,
  defaultTo,
}: {
  onExport: (from: string, to: string) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  defaultFrom?: string;
  defaultTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [from, setFrom] = useState(defaultFrom || monthStart);
  const [to, setTo] = useState(defaultTo || today);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onExport(from, to);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn ghost" disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(10, 12, 30, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 320, maxWidth: '100%', boxShadow: 'var(--shadow-lg)' }}
          >
            <h2>Export CSV</h2>
            <div className="body">
              <div className="row">
                <div>
                  <label>From</label>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <label>To</label>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <div className="between" style={{ marginTop: 14 }}>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className="btn" disabled={busy || !from || !to} onClick={confirm}>
                  {busy ? 'Exporting…' : 'Export'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
