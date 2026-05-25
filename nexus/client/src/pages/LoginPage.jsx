import { useState } from 'react';
import { AUTH } from '../app.js';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      AUTH.setToken(data.token);
      AUTH.setUser(data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Unable to connect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-logo">N</div>
        <h1>NEXUS</h1>
        <p>Program command surface for construction, security posture, and cyber delivery. Sign in to continue.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in to NEXUS'}
          </button>
        </form>

        <div className="login-note">
          Use your HUB credentials, or sign in through HUB for the SSO path.
        </div>
      </div>
    </div>
  );
}
