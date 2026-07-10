import { useEffect, useRef, useState } from 'react';
import { api, apiError } from '../api/client';
import type { Customer } from '../types';

interface Props {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  onCreated: (customer: Customer) => void;
}

/** Searchable customer dropdown (for 100+ customers) with inline "add new customer" quick entry. */
export default function CustomerPicker({ customers, value, onChange, onCreated }: Props) {
  const selected = customers.find((c) => c.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q);
  });

  async function createCustomer() {
    if (!newName.trim()) return setError('Name is required.');
    setSaving(true);
    setError('');
    try {
      const res = await api.post<Customer>('/customers', {
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
      });
      onCreated(res.data);
      onChange(res.data.id);
      setAdding(false);
      setOpen(false);
      setNewName('');
      setNewPhone('');
      setQuery('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        value={open ? query : selected?.name ?? ''}
        placeholder="Search customer by name/phone…"
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
            maxHeight: 280,
            overflowY: 'auto',
            marginTop: 4,
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          }}
        >
          {!adding ? (
            <>
              {filtered.slice(0, 50).map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                  className="picker-row"
                >
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  {c.phone && <div className="muted" style={{ fontSize: 12 }}>{c.phone}</div>}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="muted" style={{ padding: '8px 12px' }}>No matches.</div>
              )}
              <div
                onClick={() => {
                  setAdding(true);
                  setNewName(query);
                }}
                style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid var(--border)', color: 'var(--accent, #2563eb)', fontWeight: 500 }}
              >
                + Add new customer{query ? ` "${query}"` : ''}
              </div>
            </>
          ) : (
            <div style={{ padding: 12 }}>
              <label>Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <label style={{ marginTop: 8 }}>Phone (optional)</label>
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              {error && <div className="err">{error}</div>}
              <div className="between" style={{ marginTop: 10 }}>
                <button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>
                  Back
                </button>
                <button type="button" className="btn sm" disabled={saving} onClick={createCustomer}>
                  {saving ? 'Saving…' : 'Add & select'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
