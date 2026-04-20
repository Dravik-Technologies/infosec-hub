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
      setError('Connection failed — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="text-center mb-10">
          <div className="font-head font-bold glow-gold mb-2" style={{ fontSize: '3rem', color: 'var(--gold)', letterSpacing: '.2em' }}>MASH</div>
          <div className="uppercase tracking-widest mb-1" style={{ color: 'rgba(143,163,192,.45)', fontSize: '.65rem', letterSpacing: '.15em' }}>MTSI Advanced Sentinel Hub</div>
          <div className="uppercase tracking-widest" style={{ color: 'rgba(201,168,76,.35)', fontSize: '.58rem', letterSpacing: '.12em' }}>Authorized Personnel Only</div>
        </div>

        {/* Login card */}
        <div className="card card-gold p-8">
          <div className="sec-heading mb-6 text-center">Secure Sign-In</div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="inp-lbl">Username</label>
              <input className="inp" type="text" value={username}
                onChange={e => setUsername(e.target.value)}
                required autoFocus autoComplete="username" placeholder="v.kilika" />
            </div>
            <div>
              <label className="inp-lbl">Password</label>
              <input className="inp" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" placeholder="••••••••••" />
            </div>

            {error && (
              <div className="text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2"
                style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#FCA5A5' }}>
                <i className="fa-solid fa-circle-xmark shrink-0" />{error}
              </div>
            )}

            <button type="submit" className="btn-gold w-full justify-center h-11" disabled={loading}>
              {loading
                ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Authenticating…</>
                : <><i className="fa-solid fa-shield-halved mr-2" />Sign In</>}
            </button>
          </form>

          <div className="mt-5 text-center" style={{ fontSize: '.6rem', color: 'rgba(143,163,192,.25)' }}>
            All access is monitored and logged per NISPOM requirements.
          </div>
        </div>

        {/* SSO / direct login note */}
        <div className="mt-5 card p-4">
          <div className="sec-heading mb-3" style={{ fontSize: '.55rem' }}>Sign-In Options</div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)' }}>
              <i className="fa-solid fa-arrow-right-to-bracket mt-0.5 text-emerald-400" style={{ fontSize: '.7rem' }} />
              <div>
                <div className="text-xs font-semibold text-emerald-400">From the Hub (recommended)</div>
                <div style={{ fontSize: '.62rem', color: 'rgba(143,163,192,.5)', marginTop: '2px' }}>Log in to the MTSI Hub on port 3010 and click <strong style={{ color: 'rgba(201,168,76,.6)' }}>Launch</strong> on the MASH card for one-click SSO.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.1)' }}>
              <i className="fa-solid fa-keyboard mt-0.5" style={{ fontSize: '.7rem', color: 'var(--gold)' }} />
              <div>
                <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>Direct login</div>
                <div style={{ fontSize: '.62rem', color: 'rgba(143,163,192,.5)', marginTop: '2px' }}>Use your Hub credentials. Dev: <span className="font-mono" style={{ color: 'rgba(201,168,76,.7)' }}>admin / admin</span></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
