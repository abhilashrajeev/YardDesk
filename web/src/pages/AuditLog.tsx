import { Fragment, useState } from 'react';
import { useFetch, fmtDate } from '../lib/hooks';
import type { AuditLog } from '../types';

const ENTITY_TYPES = [
  'SALE', 'PURCHASE', 'PAYMENT', 'CUSTOMER', 'VENDOR', 'MATERIAL', 'VEHICLE', 'EXPENSE', 'STOCK_ADJUSTMENT', 'USER',
];

const actionClass: Record<string, string> = {
  CREATE: 'pos',
  UPDATE: 'warn',
  DELETE: 'neg',
};

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: logs } = useFetch<AuditLog[]>(
    `/audit-logs${entityType ? `?entityType=${entityType}` : ''}`,
  );

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Audit Log</h2>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} style={{ width: 220 }}>
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="panel">
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Summary</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((l) => (
                <Fragment key={l.id}>
                  <tr>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtTime(l.createdAt)}</td>
                    <td className="muted">{l.entityType.replace('_', ' ')}</td>
                    <td><span className={`pill ${actionClass[l.action] ?? 'warn'}`}>{l.action}</span></td>
                    <td>{l.summary}</td>
                    <td className="muted">{l.user?.name ?? '—'}</td>
                    <td className="right">
                      {Boolean(l.before || l.after) && (
                        <button
                          className="btn ghost sm"
                          onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                        >
                          {expanded === l.id ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === l.id && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--bg-soft, #f8fafc)', padding: 12 }}>
                        <div className="row">
                          {l.before !== undefined && l.before !== null && (
                            <div style={{ flex: 1 }}>
                              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Before</div>
                              <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                                {JSON.stringify(l.before, null, 2)}
                              </pre>
                            </div>
                          )}
                          {l.after !== undefined && l.after !== null && (
                            <div style={{ flex: 1 }}>
                              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>After</div>
                              <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                                {JSON.stringify(l.after, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {logs?.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>No audit entries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
