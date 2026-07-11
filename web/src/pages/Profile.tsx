import { useEffect, useState } from 'react';
import { api, apiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { titleCase } from '../lib/hooks';

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  // The cached login payload may predate the `phone` field being added — refresh from
  // the server once so the form (and the sidebar) always show current, complete data.
  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setName(data.name);
      setPhone(data.phone);
      updateUser({ name: data.name, phone: data.phone });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileErr('');
    setProfileMsg('');
    if (!name.trim()) return setProfileErr('Name is required.');
    if (!phone.trim()) return setProfileErr('Phone is required.');
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/auth/me', { name: name.trim(), phone: phone.trim() });
      updateUser({ name: data.name, phone: data.phone });
      setProfileMsg('Profile updated.');
    } catch (err) {
      setProfileErr(apiError(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordErr('');
    setPasswordMsg('');
    if (newPassword.length < 6) return setPasswordErr('New password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return setPasswordErr('New password and confirmation do not match.');
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordMsg('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordErr(apiError(err));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>My Profile</h2>

      <form className="panel" onSubmit={saveProfile}>
        <h2>Profile details</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label>Role</label>
              <input value={user ? titleCase(user.role.replace('_', ' ')) : ''} disabled />
            </div>
          </div>
          {profileErr && <div className="err">{profileErr}</div>}
          {profileMsg && <div className="ok">{profileMsg}</div>}
          <button className="btn" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>

      <form className="panel" onSubmit={savePassword}>
        <h2>Change password</h2>
        <div className="body">
          <div className="row">
            <div>
              <label>Current password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label>New password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label>Confirm new password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          {passwordErr && <div className="err">{passwordErr}</div>}
          {passwordMsg && <div className="ok">{passwordMsg}</div>}
          <button className="btn" disabled={savingPassword}>{savingPassword ? 'Saving…' : 'Change password'}</button>
        </div>
      </form>
    </>
  );
}
