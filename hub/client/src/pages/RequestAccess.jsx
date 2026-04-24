import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
const APPS = [
  { id: 'scorva', label: 'SCORVA' },
  { id: 'crater', label: 'CRATER' },
  { id: 'mash', label: 'MASH' },
  { id: 'lava', label: 'LAVA' },
];

export default function RequestAccess() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialApp = String(searchParams.get('app') || '').toLowerCase();
  const defaultApp = APPS.some(app => app.id === initialApp) ? initialApp : 'scorva';
  const [form, setForm] = useState({
    appId: defaultApp,
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    justification: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedApp = useMemo(
    () => APPS.find(app => app.id === form.appId) || APPS[0],
    [form.appId],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${BASE}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to submit request');
      setMessage(data.message || `Request submitted for ${selectedApp.label}.`);
      setForm(current => ({ ...current, justification: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-scorva-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 cyber-grid pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-scorva-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-scorva-accent/10 border border-scorva-accent/20 mb-5">
            <Shield size={30} className="text-scorva-accent" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-widest text-scorva-text uppercase">
            Request Access
          </h1>
          <p className="text-sm text-scorva-muted mt-1">HUB routes these requests to app administrators for review.</p>
        </div>

        <div className="card p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Application</label>
              <select
                className="input-base"
                value={form.appId}
                onChange={e => setForm(current => ({ ...current, appId: e.target.value }))}
              >
                {APPS.map(app => <option key={app.id} value={app.id}>{app.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-scorva-muted mb-1.5">Name</label>
                <input className="input-base" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-scorva-muted mb-1.5">Username</label>
                <input className="input-base" value={form.username} onChange={e => setForm(current => ({ ...current, username: e.target.value.toLowerCase() }))} required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Email</label>
              <input className="input-base" type="email" value={form.email} onChange={e => setForm(current => ({ ...current, email: e.target.value.toLowerCase() }))} required />
            </div>

            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Business Justification</label>
              <textarea
                className="input-base min-h-28"
                value={form.justification}
                onChange={e => setForm(current => ({ ...current, justification: e.target.value }))}
                placeholder={`Tell us why you need ${selectedApp.label} access and what team or mission this supports.`}
              />
            </div>

            {message && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{message}</p>}
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? 'Submitting...' : `Request ${selectedApp.label} Access`}
            </button>
          </form>
        </div>

        <div className="mt-6 space-y-2 text-center">
          <p className="text-xs text-scorva-muted font-mono">Need to check existing access first? Sign in to HUB.</p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/login" className="text-xs text-scorva-muted hover:text-scorva-accent transition-colors">Sign in</Link>
            <Link to="/" className="text-xs text-scorva-muted hover:text-scorva-accent transition-colors">Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
