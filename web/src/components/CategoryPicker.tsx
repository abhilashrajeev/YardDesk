import { useEffect, useRef, useState } from 'react';
import { api, apiError } from '../api/client';

interface Props {
  categories: string[];
  value: string;
  onChange: (category: string) => void;
  /** A brand-new category was picked via "+ Add new category" — persist it as a known one. */
  onCreated?: (name: string) => void;
  /** Category was renamed everywhere (backend already updated matching expenses). */
  onRenamed?: (from: string, to: string) => void;
  /** Category was removed (only allowed once nothing references it). */
  onRemoved?: (name: string) => void;
  /** Show inline Edit/Delete controls — gate to admins, since rename/delete affect all past expenses. */
  canManage?: boolean;
}

/**
 * Searchable expense-category dropdown with inline "add new category" quick entry, plus
 * (for admins) inline rename/delete per row — same interaction pattern as
 * CustomerPicker/VendorPicker, extended with lightweight category management.
 */
export default function CategoryPicker({ categories, value, onChange, onCreated, onRenamed, onRemoved, canManage }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRenaming(null);
        setError('');
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = categories.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.toLowerCase().includes(q);
  });
  const exactMatch = categories.some((c) => c.toLowerCase() === query.trim().toLowerCase());

  function select(c: string) {
    onChange(c);
    setOpen(false);
    setQuery('');
  }

  function addNew(name: string) {
    onCreated?.(name);
    select(name);
  }

  function startRename(c: string) {
    setRenaming(c);
    setRenameValue(c);
    setError('');
  }

  async function saveRename(from: string) {
    const to = renameValue.trim();
    if (!to) return setError('Enter a name.');
    if (to === from) {
      setRenaming(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/expenses/categories/rename', { from, to });
      // The parent owns `value`/selection state and knows the full category list — let its
      // onRenamed handler decide what the current selection should become.
      onRenamed?.(from, to);
      setRenaming(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(name: string) {
    if (!confirm(`Delete category "${name}"?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/expenses/categories/remove', { name });
      // Same reasoning as saveRename — let the parent's onRemoved handler pick the fallback
      // selection instead of racing it with a plain onChange('') here.
      onRemoved?.(name);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        value={open ? query : value}
        placeholder="Search category…"
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div
          className="panel"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 320,
            overflowY: 'auto',
            marginTop: 4,
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          }}
        >
          {filtered.map((c) =>
            renaming === c ? (
              <div key={c} style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename(c);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
                <div className="between" style={{ marginTop: 6 }}>
                  <button type="button" className="btn ghost sm" onClick={() => setRenaming(null)}>Cancel</button>
                  <button type="button" className="btn sm" disabled={busy} onClick={() => saveRename(c)}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={c}
                className="picker-row"
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
              >
                <span onClick={() => select(c)} style={{ flex: 1 }}>{c}</span>
                {canManage && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ padding: '3px 8px' }}
                      onClick={(e) => { e.stopPropagation(); startRename(c); }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ padding: '3px 8px' }}
                      disabled={busy}
                      onClick={(e) => { e.stopPropagation(); removeCategory(c); }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ),
          )}
          {filtered.length === 0 && (
            <div className="muted" style={{ padding: '8px 12px' }}>No matches.</div>
          )}
          {error && <div className="err" style={{ padding: '0 12px 8px' }}>{error}</div>}
          {query.trim() && !exactMatch && (
            <div
              onClick={() => addNew(query.trim())}
              style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid var(--border)', color: 'var(--accent, #2563eb)', fontWeight: 500 }}
            >
              + Add new category "{query.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
