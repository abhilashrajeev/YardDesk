import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, money, fmtDate } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import PeriodFilter, { defaultPeriodState, periodRange, periodLabel } from '../components/PeriodFilter';
import CategoryPicker from '../components/CategoryPicker';
import type { Expense, PaymentMode } from '../types';

const DEFAULT_CATEGORIES = ['Fuel', 'Salary', 'Maintenance', 'Rent', 'Loading/Unloading', 'Misc'];
const STORAGE_KEY = 'yard_expense_categories';

function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage, fall back to defaults
  }
  return DEFAULT_CATEGORIES;
}

export default function Expenses() {
  const [period, setPeriod] = useState(defaultPeriodState());
  const { from, to } = periodRange(period);
  const expensesUrl = from ? `/expenses?from=${from}&to=${to}` : '/expenses';
  const { data: expenses, refetch } = useFetch<Expense[]>(expensesUrl);
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canCreate = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('EXPENSES');

  // Categories aren't a backend entity — the known list lives here, persisted locally, and is
  // kept in sync with rename/delete actions performed via CategoryPicker (which call the
  // backend to relabel/validate against real expenses first).
  const [storedCategories, setStoredCategories] = useState<string[]>(loadCategories);
  function persistCategories(next: string[]) {
    const unique = Array.from(new Set(next));
    setStoredCategories(unique);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  }

  const [category, setCategory] = useState(storedCategories[0] ?? '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!category.trim()) return setError('Enter a category.');
    if (!amount || amount <= 0) return setError('Enter a valid amount.');
    setSaving(true);
    try {
      await api.post('/expenses', { category: category.trim(), description: description || undefined, amount: Number(amount), mode });
      setCategory(storedCategories[0] ?? '');
      setDescription('');
      setAmount(0);
      setMode('CASH');
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.category.trim()) return setError('Enter a category.');
    setSaving(true);
    setError('');
    try {
      await api.patch(`/expenses/${editing.id}`, {
        category: editing.category.trim(),
        description: editing.description || undefined,
        amount: Number(editing.amount),
        mode: editing.mode,
      });
      setEditing(null);
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      refetch();
    } catch (err) {
      alert(apiError(err));
    }
  }

  function handleCategoryCreated(name: string) {
    persistCategories([...storedCategories, name]);
  }

  function handleCategoryRenamed(from: string, to: string) {
    persistCategories(storedCategories.map((c) => (c === from ? to : c)).concat(to));
    if (category === from) setCategory(to);
    if (editing && editing.category === from) setEditing({ ...editing, category: to });
    refetch();
  }

  function handleCategoryRemoved(name: string) {
    const next = storedCategories.filter((c) => c !== name);
    persistCategories(next);
    if (category === name) setCategory(next[0] ?? '');
  }

  const total = expenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;
  // Suggestions merge the persisted list with any category already used — so typing a new one
  // (or renaming/removing one) stays in sync across the app from then on.
  const knownCategories = Array.from(new Set([...storedCategories, ...(expenses?.map((e) => e.category) ?? [])])).sort();

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Expenses</h2>
      {canCreate && (
      <form className="panel" onSubmit={add}>
        <h2>Add Expense</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Category</label>
              <CategoryPicker
                categories={knownCategories}
                value={category}
                onChange={setCategory}
                onCreated={handleCategoryCreated}
                onRenamed={handleCategoryRenamed}
                onRemoved={handleCategoryRemoved}
                canManage={isAdmin}
              />
            </div>
            <div>
              <label>Description (optional)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label>Amount</label>
              <input type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <label>Paid via</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
          </div>
          {error && <div className="err">{error}</div>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Add Expense'}</button>
        </div>
      </form>
      )}

      <div className="panel">
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Expenses — {periodLabel(period)}</h2>
          <PeriodFilter value={period} onChange={setPeriod} allowRecent />
        </div>
        <div className="between" style={{ padding: '10px 16px' }}>
          <span className="muted">{expenses?.length ?? 0} entries</span>
          <span>Total: <strong>{money(total)}</strong></span>
        </div>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Mode</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses?.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>{e.category}</td>
                  <td className="muted">{e.description ?? '—'}</td>
                  <td className="muted">{e.mode}</td>
                  <td className="num">{money(e.amount)}</td>
                  <td className="right">
                    {isAdmin && (
                      <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => setEditing(e)}>Edit</button>
                        <button className="btn ghost sm" onClick={() => remove(e.id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {expenses?.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>No expenses for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2>Edit Expense</h2>
          <div className="body">
            <div className="row">
              <div>
                <label>Category</label>
                <CategoryPicker
                  categories={knownCategories}
                  value={editing.category}
                  onChange={(c) => setEditing({ ...editing, category: c })}
                  onCreated={handleCategoryCreated}
                  onRenamed={handleCategoryRenamed}
                  onRemoved={handleCategoryRemoved}
                  canManage={isAdmin}
                />
              </div>
              <div>
                <label>Description</label>
                <input value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label>Amount</label>
                <input type="number" value={Number(editing.amount) || ''} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
              </div>
              <div>
                <label>Paid via</label>
                <select value={editing.mode} onChange={(e) => setEditing({ ...editing, mode: e.target.value as PaymentMode })}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
            </div>
            {error && <div className="err">{error}</div>}
            <div className="between" style={{ marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
