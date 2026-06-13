import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Shield, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';

const SECURITY_ROLES = [
  'Executive',
  'Program Manager',
  'Facility Security',
  'Personnel Security',
  'Activities Security',
  'Document Control',
  'Media Control',
  'Information Security',
  'Information Technology',
  'Corporate Security Admin',
];

const SECURITY_ROLE_TITLES = {
  'Executive':               'Executive',
  'Program Manager':         'Program Manager',
  'Facility Security':       'Facility Security Officer',
  'Personnel Security':      'Personnel Security Officer',
  'Activities Security':     'Activities Security Officer',
  'Document Control':        'Document Control Officer',
  'Media Control':           'Media Control Officer',
  'Information Security':    'Information Security',
  'Information Technology':  'Information Technology',
  'Corporate Security Admin':'Corporate Security Administrator',
};

const APPS = [
  { id: 'scorva', label: 'SCORVA' },
  { id: 'crater', label: 'CRATER' },
  { id: 'sentinel', label: 'Sentinel' },
  { id: 'lava', label: 'LAVA' },
  { id: 'nexus', label: 'NEXUS' },
];

export default function RequestAccess() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [sites, setSites] = useState([]);

  useEffect(() => {
    fetch(`${BASE}/api/admin/identity-meta`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.sites) setSites(data.sites);
      })
      .catch(() => {});
  }, []);

  const initialApp = String(searchParams.get('app') || '').toLowerCase();
  const [form, setForm] = useState({
    jobRole: '',
    firstName: user?.firstName || user?.name?.split(' ')[0] || '',
    lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    position: '',
    requestedApps: initialApp && APPS.some(app => app.id === initialApp) ? [initialApp] : [],
    requestedSites: [],
    organization: '',
    phone: '',
    justification: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedPosition = form.jobRole ? SECURITY_ROLE_TITLES[form.jobRole] : '';

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.requestedApps.length) {
      setError('Please select at least one application');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    // Submit a request for each selected app
    const requests = form.requestedApps.map(appId => ({
      appId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      position: selectedPosition,
      organization: form.organization.trim(),
      phone: form.phone.trim(),
      justification: form.justification.trim(),
      username: `${form.firstName.trim().toLowerCase()}.${form.lastName.trim().toLowerCase()}`,
      name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    }));

    const results = [];
    for (const payload of requests) {
      try {
        const res = await fetch(`${BASE}/api/access-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          results.push({ appId: payload.appId, success: false, error: data.error });
        } else {
          results.push({ appId: payload.appId, success: true });
        }
      } catch (err) {
        results.push({ appId: payload.appId, success: false, error: err.message });
      }
    }

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    if (successes.length) {
      const appLabels = successes.map(r => APPS.find(a => a.id === r.appId)?.label).join(', ');
      setMessage(`Request submitted for ${appLabels}.`);
      setForm(current => ({
        ...current,
        firstName: '',
        lastName: '',
        jobRole: '',
        position: '',
        organization: '',
        phone: '',
        justification: '',
        requestedApps: [],
        requestedSites: [],
      }));
    }

    if (failures.length) {
      setError(`Failed: ${failures.map(r => r.error || r.appId).join('; ')}`);
    }

    setLoading(false);
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
            {/* Job Role */}
            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Job Role / Security Role</label>
              <select
                className="input-base"
                value={form.jobRole}
                onChange={e => setForm(current => ({ ...current, jobRole: e.target.value }))}
                required
              >
                <option value="">Select your role...</option>
                {SECURITY_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Position (auto-filled from job role) */}
            {form.jobRole && (
              <div>
                <label className="block text-xs font-medium text-scorva-muted mb-1.5">Position / Title</label>
                <input
                  className="input-base bg-scorva-surface/50 cursor-not-allowed"
                  type="text"
                  value={selectedPosition}
                  disabled
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-scorva-muted mb-1.5">First Name</label>
                <input className="input-base" type="text" value={form.firstName} onChange={e => setForm(current => ({ ...current, firstName: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-scorva-muted mb-1.5">Last Name</label>
                <input className="input-base" type="text" value={form.lastName} onChange={e => setForm(current => ({ ...current, lastName: e.target.value }))} required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Email</label>
              <input className="input-base" type="email" value={form.email} onChange={e => setForm(current => ({ ...current, email: e.target.value }))} required />
            </div>

            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Organization</label>
              <input className="input-base" type="text" placeholder="e.g., Cybersecurity Division" value={form.organization} onChange={e => setForm(current => ({ ...current, organization: e.target.value }))} />
            </div>

            {/* Applications - Checkboxes */}
            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-2">Applications Needed</label>
              <div className="space-y-2 bg-scorva-surface/30 p-3 rounded-lg border border-scorva-border/30">
                {APPS.map(app => (
                  <label key={app.id} className="flex items-center gap-2 cursor-pointer hover:text-scorva-accent transition-colors">
                    <input
                      type="checkbox"
                      checked={form.requestedApps.includes(app.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setForm(current => ({
                            ...current,
                            requestedApps: [...current.requestedApps, app.id],
                          }));
                        } else {
                          setForm(current => ({
                            ...current,
                            requestedApps: current.requestedApps.filter(id => id !== app.id),
                          }));
                        }
                      }}
                      className="w-4 h-4 rounded border-scorva-accent/50 bg-scorva-surface cursor-pointer"
                    />
                    <span className="text-xs text-scorva-text">{app.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sites - Checkboxes */}
            {sites.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-scorva-muted mb-2">Sites / Facilities (Optional)</label>
                <div className="space-y-2 bg-scorva-surface/30 p-3 rounded-lg border border-scorva-border/30 max-h-40 overflow-y-auto">
                  {sites.map(site => (
                    <label key={site.id} className="flex items-center gap-2 cursor-pointer hover:text-scorva-accent transition-colors">
                      <input
                        type="checkbox"
                        checked={form.requestedSites.includes(site.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setForm(current => ({
                              ...current,
                              requestedSites: [...current.requestedSites, site.id],
                            }));
                          } else {
                            setForm(current => ({
                              ...current,
                              requestedSites: current.requestedSites.filter(id => id !== site.id),
                            }));
                          }
                        }}
                        className="w-4 h-4 rounded border-scorva-accent/50 bg-scorva-surface cursor-pointer"
                      />
                      <span className="text-xs text-scorva-text">{site.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Phone (Optional)</label>
              <input className="input-base" type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => setForm(current => ({ ...current, phone: e.target.value }))} />
            </div>

            <div>
              <label className="block text-xs font-medium text-scorva-muted mb-1.5">Business Justification</label>
              <textarea
                className="input-base min-h-28"
                value={form.justification}
                onChange={e => setForm(current => ({ ...current, justification: e.target.value }))}
                placeholder="Tell us why you need access to these applications and what team or mission this supports."
                required
              />
            </div>

            {message && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{message}</p>}
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading || !form.requestedApps.length} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Submitting...' : `Submit Access Request (${form.requestedApps.length} app${form.requestedApps.length !== 1 ? 's' : ''})`}
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
