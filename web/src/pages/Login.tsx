import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(phone, password);
      nav('/');
    } catch (err) {
      setError(apiError(err));
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="brand">
          <div className="brand-mark">Y</div>
          <div className="brand-name">
            Yard<span>ERP</span>
          </div>
        </div>
        <div>
          <h1>
            Run your yard,
            <br />
            not your paperwork.
          </h1>
          <p>
            Sales, purchases, stock, passes and payments — one place, updated the moment
            a load leaves the gate.
          </p>
        </div>
        <div className="feats">
          <div className="feat"><span className="dot" /> Real-time stock &amp; day-close</div>
          <div className="feat"><span className="dot" /> Customer &amp; vendor ledgers</div>
          <div className="feat"><span className="dot" /> Payment follow-up reminders</div>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={submit}>
          <h2>Welcome back</h2>
          <p className="lead">Sign in to your yard account</p>
          <div style={{ marginBottom: 14 }}>
            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9999999999" autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <div className="err">{error}</div>}
          <button className="btn" style={{ width: '100%', padding: '12px' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
