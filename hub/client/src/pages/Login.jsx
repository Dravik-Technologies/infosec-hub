import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff } from 'lucide-react';

const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
const ENTRA_ERRORS = {
  entra_init_failed:             'Microsoft sign-in could not be initialized.',
  entra_not_configured:          'Microsoft Entra ID is not configured on the hub yet.',
  entra_state_invalid:           'Microsoft sign-in session expired or state validation failed.',
  entra_nonce_invalid:           'Microsoft sign-in validation failed. Please try again.',
  entra_account_not_provisioned: 'Microsoft sign-in succeeded, but no HUB account is provisioned for this user yet.',
  entra_hub_access_denied:       'Your Microsoft account authenticated successfully, but HUB access has not been granted.',
  entra_callback_failed:         'Microsoft sign-in failed during callback processing.',
};

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [entraEnabled, setEntraEnabled] = useState(false);

  useEffect(() => {
    if (user) navigate('/portal', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('error');
    if (code && ENTRA_ERRORS[code]) setError(ENTRA_ERRORS[code]);
  }, [location.search]);

  useEffect(() => {
    fetch(`${BASE}/auth/providers`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { entra: false })
      .then(data => setEntraEnabled(Boolean(data.entra)))
      .catch(() => setEntraEnabled(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/portal', { replace: true });
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the hub server — make sure it is running on port 3010.');
      } else {
        setError(err.response.data?.error || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleMicrosoftLogin() {
    window.location.href = `${BASE}/auth/entra/login`;
  }

  return (
    <div className="min-h-screen bg-scorva-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Layered background */}
      <div className="absolute inset-0 cyber-grid-dense pointer-events-none opacity-70" />
      <div className="absolute inset-0 scanlines pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-scorva-accent/6 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-indigo-500/4 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo block */}
        <div className="text-center mb-8">
          {/* Pulse-ring shield */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-scorva-accent/10 border border-scorva-accent/30 flex items-center justify-center animate-pulse-ring">
              <Shield size={36} className="text-scorva-accent" />
            </div>
          </div>
          {/* Tactical badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-scorva-accent/10 border border-scorva-accent/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-scorva-accent tracking-[0.35em] uppercase">Secure Channel Active</span>
          </div>
          <h1 className="text-2xl font-black font-mono tracking-[0.15em] text-scorva-text uppercase text-glow">
            MTSI Hub
          </h1>
          <p className="text-xs text-scorva-muted mt-1 font-mono tracking-widest uppercase">Authentication Required</p>
        </div>

        {/* Card with HUD corner brackets */}
        <div className="relative">
          <div className="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-2 border-l-2 border-scorva-accent/60 pointer-events-none" />
          <div className="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-2 border-r-2 border-scorva-accent/60 pointer-events-none" />
          <div className="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-2 border-l-2 border-scorva-accent/60 pointer-events-none" />
          <div className="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-2 border-r-2 border-scorva-accent/60 pointer-events-none" />
        <div className="glass border border-scorva-accent/20 rounded-xl p-6 glow-border">
          {entraEnabled && (
            <div className="mb-5">
              <button
                type="button"
                onClick={handleMicrosoftLogin}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-scorva-border bg-white text-slate-900 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                <span className="inline-block w-4 h-4 rounded-sm bg-[linear-gradient(90deg,#f25022_0_50%,#7fba00_50_100%),linear-gradient(90deg,#00a4ef_0_50%,#ffb900_50_100%)] bg-[length:100%_50%,100%_50%] bg-[position:0_0,0_100%] bg-no-repeat" />
                Sign in with Microsoft
              </button>
            </div>
          )}

          {entraEnabled && (
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-scorva-border" />
              <span className="text-[10px] font-mono tracking-[0.3em] text-scorva-muted uppercase">or</span>
              <div className="h-px flex-1 bg-scorva-border" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono font-medium text-scorva-muted mb-1.5 tracking-widest uppercase">Username</label>
              <input
                className="input-base font-mono"
                type="text"
                autoComplete="username"
                placeholder="username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-medium text-scorva-muted mb-1.5 tracking-widest uppercase">Password</label>
              <div className="relative">
                <input
                  className="input-base pr-10 font-mono"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-scorva-muted hover:text-scorva-text transition-colors"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2 glow-border font-mono tracking-wider"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating…
                </>
              ) : 'Sign In to Hub'}
            </button>
          </form>
        </div>
        </div>{/* end corner-bracket wrapper */}

        <div className="mt-8 space-y-3">
          {/* Sys-connection data */}
          <div className="glass border border-scorva-border/50 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-px bg-scorva-accent/50" />
              <span className="text-[9px] font-mono text-scorva-muted/70 uppercase tracking-[0.3em]">Connection Parameters</span>
            </div>
            {[
              { key: 'Protocol',  val: 'HTTPS / TLS 1.3',       accent: false },
              { key: 'Auth Mode', val: 'Session Token + SSO',    accent: false },
              { key: 'Status',    val: 'Secure Channel Active',  accent: true  },
            ].map(({ key, val, accent }) => (
              <div key={key} className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-scorva-muted uppercase tracking-widest">{key}</span>
                {accent ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    {val}
                  </span>
                ) : (
                  <span className="text-scorva-text">{val}</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="text-xs text-scorva-muted hover:text-scorva-accent transition-colors font-mono"
            >
              ← Return to main terminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
