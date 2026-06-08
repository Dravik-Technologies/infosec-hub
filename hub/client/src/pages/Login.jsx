import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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

      <div className="relative w-full max-w-sm animate-fade-in-up">
        {/* Logo block */}
        <div className="text-center mb-8 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          {/* Pulse-ring shield */}
          <div className="relative inline-flex items-center justify-center mb-6 animate-float">
            <div className="absolute inset-0 rounded-2xl bg-scorva-accent/10 blur-xl animate-pulse" />
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-scorva-accent/20 to-scorva-accent/5 border border-scorva-accent/40 flex items-center justify-center animate-pulse-ring relative z-10">
              <Shield size={36} className="text-scorva-accent text-glow" />
            </div>
          </div>
          {/* Tactical badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-scorva-accent/10 border border-scorva-accent/25 mb-4 animate-glow-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-scorva-accent tracking-[0.35em] uppercase">Secure Channel Active</span>
          </div>
          <h1 className="text-3xl font-black font-mono tracking-[0.15em] text-scorva-text uppercase text-glow-strong">
            MTSI Hub
          </h1>
          <p className="text-xs text-scorva-muted mt-1 font-mono tracking-widest uppercase">Authentication Required</p>
        </div>

        {/* Card with HUD corner brackets */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-2 border-l-2 border-scorva-accent/60 pointer-events-none transition-all duration-500 hover:border-scorva-accent" />
          <div className="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-2 border-r-2 border-scorva-accent/60 pointer-events-none transition-all duration-500 hover:border-scorva-accent" />
          <div className="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-2 border-l-2 border-scorva-accent/60 pointer-events-none transition-all duration-500 hover:border-scorva-accent" />
          <div className="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-2 border-r-2 border-scorva-accent/60 pointer-events-none transition-all duration-500 hover:border-scorva-accent" />
        <div className="glass border border-scorva-accent/25 rounded-xl p-6 glow-border-strong hover:glow-border-strong transition-all duration-500 group">
          {entraEnabled && (
            <div className="mb-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <button
                type="button"
                onClick={handleMicrosoftLogin}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-scorva-border bg-white text-slate-900 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:translate-y-0"
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

          <form onSubmit={handleSubmit} className="space-y-4" style={{ animationDelay: '0.4s' }}>
            <div className="animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
              <label className="block text-[10px] font-mono font-medium text-scorva-muted mb-1.5 tracking-widest uppercase">Username</label>
              <input
                className="input-base font-mono hover:border-scorva-accent/50 focus:glow-border-strong"
                type="text"
                autoComplete="username"
                placeholder="username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
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
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 font-mono animate-fade-in-up backdrop-blur-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2 glow-border font-mono tracking-wider animate-fade-in-up"
              style={{ animationDelay: '0.7s' }}
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

        <div className="mt-8 space-y-3 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
          {/* Sys-connection data */}
          <div className="glass border border-scorva-border/50 rounded-xl p-3.5 space-y-2 hover:border-scorva-accent/30 hover:glow-border transition-all duration-300">
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
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 text-xs font-mono">
              <button
                onClick={() => navigate('/')}
                className="text-scorva-muted hover:text-scorva-accent transition-colors"
              >
                ← Return to main terminal
              </button>
              <span className="text-scorva-muted/50">•</span>
              <Link
                to="/request-access"
                className="text-scorva-muted hover:text-scorva-accent transition-colors"
              >
                Request Access
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
