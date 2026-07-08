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
          <div className="brand-mark">D</div>
          <div className="brand-name">
            Devi Traders
            <small>Building Materials Supplier</small>
          </div>
        </div>
        <div>
          <h1>
            Run the yard,
            <br />
            not the paperwork.
          </h1>
          <p>
            Sales, purchases, stock, gate passes and ledgers — one register, updated the
            moment a load leaves the gate.
          </p>
        </div>
        <div className="bars" aria-hidden="true">
          <i style={{ height: '34%' }} />
          <i style={{ height: '52%' }} />
          <i style={{ height: '71%' }} />
          <i style={{ height: '100%' }} />
          <i style={{ height: '80%' }} />
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
          <p className="lead">Sign in to Devi Traders</p>
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
