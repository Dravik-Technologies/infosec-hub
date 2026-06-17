import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, ArrowLeft, LockKeyhole } from 'lucide-react';

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
    <div className="min-h-screen bg-scorva-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="sc-landing-grid absolute inset-0 pointer-events-none" />
      <div className="sc-landing-glow-a absolute pointer-events-none" />
      <div className="sc-landing-glow-b absolute pointer-events-none" />

      <div className="relative w-full max-w-[26rem]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/scorva-logo.png" alt="SCORVA" className="h-20 w-auto" />
          </div>
          <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-scorva-accent mb-2">Secure Access</div>
          <p className="text-sm text-scorva-muted mt-2">Mission access portal</p>
        </div>

        {/* Card */}
        <div className="sc-auth-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-xl bg-scorva-accent/10 border border-scorva-accent/20">
              <LockKeyhole size={14} className="text-scorva-accent" />
            </div>
            <div>
              <div className="text-xs font-mono font-semibold uppercase tracking-[0.16em] text-scorva-muted">Authentication</div>
              <div className="text-sm font-semibold text-scorva-text">Sign in to continue</div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Username</label>
              <input
                className="input-base"
                type="text"
                placeholder="e.g. jsmith or john.smith"
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
                  placeholder="Enter your password"
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
          NIST SP 800-53 Rev 5
        </p>
        <p className="text-center text-xs text-scorva-muted mt-2">
          Need access first? <a href={hubRequestUrl} className="text-scorva-accent hover:underline">Request it through HUB</a>
        </p>
        <p className="text-center mt-3">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-scorva-muted hover:text-scorva-accent transition-colors"
          >
            <span className="inline-flex items-center gap-1"><ArrowLeft size={12} /> Back to home</span>
          </button>
        </p>
      </div>
    </div>
  );
}
