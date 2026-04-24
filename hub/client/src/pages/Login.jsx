import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, Lock } from 'lucide-react';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  useEffect(() => {
    if (user) navigate('/portal', { replace: true });
  }, [user, navigate]);

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

  return (
    <div className="min-h-screen bg-scorva-bg flex items-center justify-center p-4">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid pointer-events-none" />
      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-scorva-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo block */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-scorva-accent/10 border border-scorva-accent/20 mb-5">
            <Shield size={30} className="text-scorva-accent" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-widest text-scorva-text uppercase">
            MTSI Hub
          </h1>
          <p className="text-sm text-scorva-muted mt-1">Security App Factory</p>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-5">
            <Lock size={13} className="text-scorva-accent" />
            <span className="text-xs font-mono text-scorva-muted tracking-widest uppercase">Secure Sign-In</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Username</label>
              <input
                className="input-base"
                type="text"
                autoComplete="username"
                placeholder="username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Password</label>
              <div className="relative">
                <input
                  className="input-base pr-10"
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
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : 'Sign In to Hub'}
            </button>
          </form>
        </div>

        <div className="mt-6 space-y-2 text-center">
          <p className="text-xs text-scorva-muted font-mono">
            Single sign-on · All apps · One session
          </p>
          <p className="text-xs text-scorva-muted">
            Need access first? <Link to="/request-access" className="text-scorva-accent hover:underline">Submit a request</Link>
          </p>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-scorva-muted hover:text-scorva-accent transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
