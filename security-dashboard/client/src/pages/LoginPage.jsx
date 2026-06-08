import { useState } from 'react';
import { AUTH } from '../app.js';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Authentication failed'); return; }
      AUTH.setToken(d.token);
      AUTH.setUser(d.user);
      onLogin(d.user);
    } catch {
      setError('Unable to reach server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ws-login-shell">
      <div className="ws-login-card">
        <div className="ws-login-mark">S</div>
        <div className="ws-login-kicker">Security Managers Workspace</div>
        <h1>MASH</h1>
        <p>Sign in with your HUB credentials to continue.</p>

        {error && <div className="ws-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="ws-field">
            <label>Username</label>
            <input className="ws-input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="ws-field">
            <label>Password</label>
            <input className="ws-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <button type="submit" className="ws-btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in to MASH'}
          </button>
        </form>

        <div className="ws-login-note">
          HUB credentials and HUB SSO are both supported.
        </div>
      </div>
    </div>
  );
}
