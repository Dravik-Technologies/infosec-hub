import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const hubRequestUrl = `${import.meta.env.VITE_HUB_URL || 'http://localhost:3010'}/request-access?app=scorva`;
  const [form, setForm]     = useState({ username: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-scorva-bg flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-scorva-accent/10 border border-scorva-accent/20 mb-4">
            <Shield size={26} className="text-scorva-accent" />
          </div>
          <h1 className="text-2xl font-bold text-scorva-text font-mono tracking-widest">SCORVA</h1>
          <p className="text-sm text-scorva-muted mt-1">Cyber Command Center</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Username</label>
              <input
                className="input-base"
                type="text"
                autoComplete="username"
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
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-scorva-muted hover:text-scorva-text"
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
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-scorva-muted mt-6">
          NIST SP 800-53 Rev 5 Compliance Management
        </p>
        <p className="text-center text-xs text-scorva-muted mt-2">
          Need access first? <a href={hubRequestUrl} className="text-scorva-accent hover:underline">Request it through HUB</a>
        </p>
        <p className="text-center mt-3">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-scorva-muted hover:text-scorva-accent transition-colors"
          >
            ← Back to home
          </button>
        </p>
      </div>
    </div>
  );
}
