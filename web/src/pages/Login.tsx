import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { Icon } from '../components/Icon';

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

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
        <img src="/brand/logo-full.png" alt="YardDesk" className="login-hero-logo" />
      </div>

      <div className="login-form-side">
        <div className="login-mobile-logo">
          <img src="/brand/logo-full.png" alt="YardDesk" />
        </div>
        <form className="login-card" onSubmit={submit}>
          <h2>Welcome back</h2>
          <p className="lead">Sign in to your account</p>

          <div style={{ marginBottom: 14 }}>
            <label>Phone</label>
            <div className="input-icon">
              <Icon name="phone" size={17} />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                autoFocus
              />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Password</label>
            <div className="input-icon">
              <Icon name="lock" size={17} />
              <input
                type={showPassword ? 'text' : 'password'}
                data-pw
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
              </button>
            </div>
          </div>

          <button
            type="button"
            className="forgot-link"
            onClick={() => setForgotMsg('Contact your administrator to reset your password.')}
          >
            Forgot password?
          </button>
          {forgotMsg && <div className="muted" style={{ fontSize: 12.5, marginTop: -12, marginBottom: 16 }}>{forgotMsg}</div>}

          {error && <div className="err">{error}</div>}
          <button className="btn" style={{ width: '100%', padding: '12px' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="login-secure">
            <Icon name="shield" size={14} /> Secure login
          </div>
        </form>
      </div>
    </div>
  );
}
