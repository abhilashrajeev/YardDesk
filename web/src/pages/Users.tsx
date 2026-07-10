import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useFetch, fmtDate } from '../lib/hooks';
import { ALL_PERMISSIONS } from '../types';
import type { StaffUser, Permission, Role } from '../types';

function PermissionPicker({
  value,
  onChange,
}: {
  value: Permission[];
  onChange: (next: Permission[]) => void;
}) {
  function toggle(p: Permission) {
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  }
  return (
    <div className="flex" style={{ gap: 14, flexWrap: 'wrap' }}>
      {ALL_PERMISSIONS.map((p) => (
        <label key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={value.includes(p.value)} onChange={() => toggle(p.value)} />
          {p.label}
        </label>
      ))}
    </div>
  );
}

export default function Users() {
  const { data: users, refetch } = useFetch<StaffUser[]>('/users');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !phone.trim() || password.length < 6) {
      return setError('Name, phone, and a password of at least 6 characters are required.');
    }
    setSaving(true);
    try {
      await api.post('/users', { name: name.trim(), phone: phone.trim(), password, role, permissions });
      setName('');
      setPhone('');
      setPassword('');
      setRole('EMPLOYEE');
      setPermissions([]);
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/users/${editing.id}`, {
        name: editing.name,
        role: editing.role,
        permissions: editing.permissions,
        isActive: editing.isActive,
        password: resetPassword.length >= 6 ? resetPassword : undefined,
      });
      setEditing(null);
      setResetPassword('');
      refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: StaffUser) {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      refetch();
    } catch (err) {
      alert(apiError(err));
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Users</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>
        Create Admin or Employee logins and choose exactly which modules each one can create records in.
        The owner account isn&apos;t managed here.
      </p>

      <form className="panel" onSubmit={add}>
        <h2>Add User</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div>
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" required />
            </div>
            <div>
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="ADMIN">Admin</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Can create records in</label>
            <PermissionPicker value={permissions} onChange={setPermissions} />
          </div>
          {error && !editing && <div className="err">{error}</div>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Add User'}</button>
        </div>
      </form>

      <div className="panel">
        <h2>All Users</h2>
        <div className="body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td className="muted">{u.phone}</td>
                  <td>
                    <span className={`pill ${u.role === 'SUPER_ADMIN' ? 'warn' : u.role === 'ADMIN' ? 'pos' : ''}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {u.role === 'SUPER_ADMIN'
                      ? 'All'
                      : u.permissions.length
                        ? u.permissions.join(', ')
                        : '—'}
                  </td>
                  <td>
                    <span className={`pill ${u.isActive ? 'pos' : 'neg'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="muted">{fmtDate(u.createdAt)}</td>
                  <td className="right">
                    {u.role !== 'SUPER_ADMIN' && (
                      <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => { setEditing(u); setResetPassword(''); }}>Edit</button>
                        <button className="btn ghost sm" onClick={() => toggleActive(u)}>
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 16 }}>No users yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2>Edit {editing.name}</h2>
          <div className="body">
            <div className="row">
              <div>
                <label>Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label>Role</label>
                <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}>
                  <option value="ADMIN">Admin</option>
                  <option value="EMPLOYEE">Employee</option>
                </select>
              </div>
              <div>
                <label>Reset password (optional)</label>
                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="leave blank to keep current" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Can create records in</label>
              <PermissionPicker
                value={editing.permissions}
                onChange={(next) => setEditing({ ...editing, permissions: next })}
              />
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
