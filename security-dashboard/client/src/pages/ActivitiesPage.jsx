import { useState, useEffect } from 'react';
import { WS, fmtDate, fmtShort, daysUntil, statusBadge, uid } from '../app.js';

const CATEGORIES = [
  { id: 'all', label: 'All Activities' },
  { id: 'classified-meeting', label: 'Classified Meeting' },
  { id: 'security-briefing', label: 'Security Briefing' },
  { id: 'debriefing', label: 'Debriefing' },
  { id: 'inspection', label: 'Inspection' },
  { id: 'access-coordination', label: 'Access Coordination' },
  { id: 'foreign-visit', label: 'Foreign Visit' },
  { id: 'support-issue', label: 'Support / Issue' },
];

const CAT_BADGE = {
  'classified-meeting': 'badge-purple',
  'security-briefing': 'badge-blue',
  'debriefing': 'badge-gray',
  'inspection': 'badge-green',
  'access-coordination': 'badge-amber',
  'foreign-visit': 'badge-red',
  'support-issue': 'badge-amber',
};

const STATUS_OPTIONS = ['Scheduled', 'Pending', 'Pending Approval', 'In Progress', 'Completed', 'Overdue', 'Cancelled'];
const CLASS_OPTIONS = ['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'SECRET // NOFORN', 'TOP SECRET', 'TOP SECRET // SCI'];

function catLabel(cat) {
  return CATEGORIES.find(c => c.id === cat)?.label || cat;
}

function isOverdue(a) {
  if (a.status === 'Overdue') return true;
  if (a.status === 'Completed' || a.status === 'Cancelled') return false;
  if (a.dueDate) return new Date(a.dueDate + 'T12:00:00Z') < new Date();
  if (a.date && a.status !== 'Completed') return new Date(a.date + 'T12:00:00Z') < new Date();
  return false;
}

function isUpcoming7(a) {
  if (a.status === 'Completed' || a.status === 'Cancelled' || a.status === 'Overdue') return false;
  const d = daysUntil(a.date || a.dueDate);
  return d != null && d >= 0 && d <= 7;
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ font: '500 0.72rem Inter, sans-serif', color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}

function ActivityForm({ activity, siteId, onSave, onClose }) {
  const isEdit = !!activity;
  const blank = {
    title: '', category: 'classified-meeting', status: 'Scheduled', owner: '',
    date: '', time: '', dueDate: '', program: '', classificationLevel: 'UNCLASSIFIED',
    location: '', visitorCount: '', clearanceVerified: false, description: '', notes: '',
    siteId: siteId || '',
  };
  const [form, setForm] = useState(isEdit ? {
    ...blank,
    title: activity.title || '',
    category: activity.category || 'classified-meeting',
    status: activity.status || 'Scheduled',
    owner: activity.owner || '',
    date: activity.date || '',
    time: activity.time || '',
    dueDate: activity.dueDate || '',
    program: activity.program || '',
    classificationLevel: activity.classificationLevel || activity.classification || 'UNCLASSIFIED',
    location: activity.location || '',
    visitorCount: activity.visitorCount ?? '',
    clearanceVerified: activity.clearanceVerified || false,
    description: activity.description || '',
    notes: activity.notes || '',
    siteId: activity.siteId || siteId || '',
  } : blank);

  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      classification: form.classificationLevel,
      visitorCount: form.visitorCount === '' ? 0 : Number(form.visitorCount),
    };
    if (isEdit) {
      await WS.patch('activities_security', activity.id, payload);
    } else {
      await WS.post('activities_security', { ...payload, id: uid() });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(680px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <h3>{isEdit ? 'Edit Activity' : 'Add Activity'}</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div className="ws-section-label">Activity Details</div>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Title *">
                <input className="ws-input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Activity title" />
              </FormField>
              <FormField label="Category">
                <select className="ws-input" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select className="ws-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Owner / POC">
                <input className="ws-input" value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="Responsible party" />
              </FormField>
              <FormField label="Activity Date">
                <input className="ws-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </FormField>
              <FormField label="Time">
                <input className="ws-input" type="time" value={form.time} onChange={e => set('time', e.target.value)} />
              </FormField>
              <FormField label="Due Date">
                <input className="ws-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </FormField>
              <FormField label="Location">
                <input className="ws-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Facility / room" />
              </FormField>
              <FormField label="Program">
                <input className="ws-input" value={form.program} onChange={e => set('program', e.target.value)} placeholder="Program name" />
              </FormField>
              <FormField label="Classification Level">
                <select className="ws-input" value={form.classificationLevel} onChange={e => set('classificationLevel', e.target.value)}>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Visitor Count">
                <input className="ws-input" type="number" min="0" value={form.visitorCount} onChange={e => set('visitorCount', e.target.value)} placeholder="0" />
              </FormField>
              <FormField label="Clearance Verified">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.4rem' }}>
                  <input type="checkbox" id="clearanceVer" checked={form.clearanceVerified} onChange={e => set('clearanceVerified', e.target.checked)} />
                  <label htmlFor="clearanceVer" style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Visitor clearances verified</label>
                </div>
              </FormField>
            </div>

            <FormField label="Description">
              <textarea className="ws-input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Activity description or purpose" />
            </FormField>
            <FormField label="Notes">
              <textarea className="ws-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes" />
            </FormField>

          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ws-action-btn primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Activity'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActivityDetail({ activity, onClose, onEdit, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm('Delete this activity? This cannot be undone.')) return;
    setDeleting(true);
    await WS.del('activities_security', activity.id);
    setDeleting(false);
    onDeleted();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(680px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <h3>{activity.title}</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
              {catLabel(activity.category)} · {fmtDate(activity.date)}{activity.time ? ` ${activity.time}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className={`badge ${CAT_BADGE[activity.category] || 'badge-gray'}`}>{catLabel(activity.category)}</span>
            <span className={`badge ${statusBadge(activity.status)}`}>{activity.status}</span>
            <button type="button" className="ws-action-btn primary" onClick={onEdit}>Edit</button>
            <button type="button" className="ws-action-btn" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="ws-grid-3" style={{ gap: '0.75rem' }}>
            {[
              { label: 'Owner / POC', value: activity.owner },
              { label: 'Location', value: activity.location },
              { label: 'Program', value: activity.program },
              { label: 'Classification', value: activity.classificationLevel || activity.classification },
              { label: 'Activity Date', value: fmtDate(activity.date) },
              { label: 'Due Date', value: fmtDate(activity.dueDate) },
              { label: 'Visitor Count', value: activity.visitorCount > 0 ? String(activity.visitorCount) : '—' },
              { label: 'Clearance Verified', value: activity.clearanceVerified ? 'Yes' : 'No' },
              { label: 'Status', value: activity.status },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.5rem 0.65rem' }}>
                <div style={{ font: '500 0.65rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{label}</div>
                <div style={{ font: '600 0.8rem Inter, sans-serif', color: 'var(--text)', marginTop: '0.15rem' }}>{value || '—'}</div>
              </div>
            ))}
          </div>

          {activity.description && (
            <div>
              <div className="ws-section-label">Description</div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text)', margin: '0.35rem 0 0', lineHeight: 1.6 }}>{activity.description}</p>
            </div>
          )}
          {activity.notes && (
            <div>
              <div className="ws-section-label">Notes</div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-2)', margin: '0.35rem 0 0', lineHeight: 1.6 }}>{activity.notes}</p>
            </div>
          )}

          <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={handleDelete} disabled={deleting} style={{ fontSize: '0.75rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {deleting ? 'Deleting…' : 'Delete Activity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesPage({ siteId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  function loadActivities() {
    const params = siteId ? { siteId } : {};
    return WS.get('activities_security', params).then(d => {
      if (d?._wsError) { setLoadError(d.message); setLoading(false); return; }
      setLoadError(null);
      setActivities(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }

  useEffect(() => {
    setLoading(true);
    loadActivities();
  }, [siteId]);

  function handleSaved() {
    loadActivities().then(() => { setAdding(false); setEditing(null); });
  }

  function handleDeleted() {
    loadActivities().then(() => setSelected(null));
  }

  function handleEditFromDetail() {
    const act = selected;
    setSelected(null);
    setEditing(act);
  }

  const overdueList = activities.filter(a => isOverdue(a));
  const upcoming7 = activities.filter(a => isUpcoming7(a));
  const openIssues = activities.filter(a => a.category === 'support-issue' && a.status !== 'Completed' && a.status !== 'Cancelled');

  const filtered = activities.filter(a => {
    const matchSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.owner?.toLowerCase().includes(search.toLowerCase()) ||
      a.location?.toLowerCase().includes(search.toLowerCase()) ||
      a.program?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || a.category === catFilter;
    const matchStatus = statusFilter === 'all' || a.status.toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchCat && matchStatus;
  });

  if (loading) return <div className="ws-empty">Loading activities…</div>;
  if (loadError) return <div className="ws-empty">Failed to load activities: {loadError}</div>;

  return (
    <div className="ws-page">
      {adding && (
        <ActivityForm siteId={siteId} onSave={handleSaved} onClose={() => setAdding(false)} />
      )}
      {editing && (
        <ActivityForm activity={editing} siteId={siteId} onSave={handleSaved} onClose={() => setEditing(null)} />
      )}
      {selected && !editing && (
        <ActivityDetail
          activity={selected}
          onClose={() => setSelected(null)}
          onEdit={handleEditFromDetail}
          onDeleted={handleDeleted}
        />
      )}

      <div className="ws-page-header">
        <div>
          <div className="ws-page-title">Activities Security</div>
          <div className="ws-page-sub">Classified meetings, briefings, debriefings, inspections, and access coordination.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {overdueList.length > 0 && (
            <span className="ws-count-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red-border)' }}>
              {overdueList.length} overdue
            </span>
          )}
          <span className="ws-count-badge">{activities.length} total</span>
          <button className="ws-action-btn primary" onClick={() => setAdding(true)}>+ Add Activity</button>
        </div>
      </div>

      {/* KPI strip */}
      <section className="ws-kpi-strip">
        <div className={`ws-kpi ${overdueList.length > 0 ? 'risk' : 'good'}`}>
          <div className="ws-kpi-label">Overdue</div>
          <div className="ws-kpi-value">{overdueList.length}</div>
          <div className="ws-kpi-hint">Require immediate action</div>
        </div>
        <div className="ws-kpi">
          <div className="ws-kpi-label">Upcoming (7 days)</div>
          <div className="ws-kpi-value">{upcoming7.length}</div>
          <div className="ws-kpi-hint">Scheduled activities</div>
        </div>
        <div className={`ws-kpi ${openIssues.length > 0 ? 'watch' : ''}`}>
          <div className="ws-kpi-label">Open Issues</div>
          <div className="ws-kpi-value">{openIssues.length}</div>
          <div className="ws-kpi-hint">Support / issue queue</div>
        </div>
        <div className="ws-kpi">
          <div className="ws-kpi-label">Total Activities</div>
          <div className="ws-kpi-value">{activities.length}</div>
          <div className="ws-kpi-hint">In register</div>
        </div>
      </section>

      <div className="ws-filter-bar">
        <input className="ws-search" placeholder="Search title, owner, location, program…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="ws-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="ws-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
        </select>
      </div>

      <div className="ws-card">
        <div className="ws-card-body" style={{ padding: 0 }}>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Category</th>
                  <th>Date / Due</th>
                  <th>Location</th>
                  <th>Classification</th>
                  <th>Owner</th>
                  <th>Visitors</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}><div className="ws-empty">No activities match the current filter.</div></td></tr>
                ) : filtered.map(a => {
                  const overdue = isOverdue(a);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelected(a)}
                      style={{
                        cursor: 'pointer',
                        background: overdue ? 'var(--red-bg)' : undefined,
                      }}
                    >
                      <td>
                        <strong>{a.title}</strong>
                        {a.description && (
                          <div className="cell-muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>
                        )}
                      </td>
                      <td><span className={`badge ${CAT_BADGE[a.category] || 'badge-gray'}`}>{catLabel(a.category)}</span></td>
                      <td className="cell-muted">
                        {a.date ? fmtShort(a.date) : '—'}
                        {a.dueDate && a.dueDate !== a.date && <div style={{ fontSize: '0.7rem' }}>Due {fmtShort(a.dueDate)}</div>}
                      </td>
                      <td className="cell-muted">{a.location || '—'}</td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: (a.classificationLevel || a.classification || '').includes('SECRET') ? 'var(--red)' : 'var(--text-2)' }}>
                          {a.classificationLevel || a.classification || '—'}
                        </span>
                      </td>
                      <td className="cell-muted">{a.owner || '—'}</td>
                      <td>
                        {a.visitorCount > 0 ? (
                          <div>
                            <span style={{ fontWeight: 600 }}>{a.visitorCount}</span>
                            <div className="cell-muted">{a.clearanceVerified ? 'Verified' : 'Uncleared'}</div>
                          </div>
                        ) : <span className="cell-muted">—</span>}
                      </td>
                      <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Click any row to view full activity record. Overdue rows are highlighted red.</div>
    </div>
  );
}
