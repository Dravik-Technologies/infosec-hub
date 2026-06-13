import { useState, useEffect } from 'react';
import { WS, fmtDate, statusBadge } from '../app.js';

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ font: '500 0.72rem Inter, sans-serif', color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}

function scoreClass(score) {
  if (score == null) return '';
  if (score >= 90) return '';
  if (score >= 75) return 'watch';
  return 'risk';
}

function progTone(score) {
  if (score == null) return '';
  if (score >= 90) return 'green';
  if (score >= 75) return 'amber';
  return 'red';
}

function ProgressBar({ value = 0, label }) {
  return (
    <div className="ws-prog-wrap">
      <div className="ws-prog-header">
        <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>{label}</span>
        <span style={{ fontWeight: 600, fontSize: '0.72rem' }}>{value}%</span>
      </div>
      <div className="ws-prog-track">
        <div className={`ws-prog-fill ${progTone(value)}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function issueDot(severity) {
  const s = (severity || '').toLowerCase();
  if (s === 'high' || s === 'critical') return 'red';
  if (s === 'medium') return 'amber';
  return 'blue';
}

const FAC_TYPES = ['SCIF', 'SAPF', 'Closed Area', 'Open Storage Area', 'Other'];
const FCL_LEVELS = ['CONFIDENTIAL', 'SECRET', 'TOP SECRET'];
const FCL_STATUSES = ['Active', 'Pending', 'Suspended', 'Terminated'];
const ACC_TYPES = ['ICD 705', 'SAPF', 'DCID 6/9', 'None'];
const ACC_STATUSES = ['Active', 'Pending Reaccreditation', 'Expired', 'Suspended'];
const IDS_STATUSES = ['Operational', 'Degraded', 'Offline', 'Maintenance'];
const DCSA_RATINGS = ['Commendable', 'Satisfactory', 'Marginal', 'Unsatisfactory'];
const INSP_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Overdue'];

function FacilityForm({ fac, siteId, onSave, onClose }) {
  const isEdit = !!fac;
  const blank = {
    name: '', facilityType: 'SCIF', location: '', siteId: siteId || '',
    fclLevel: 'SECRET', fclStatus: 'Active', fclExpires: '',
    complianceScore: '',
    accreditation: { type: 'ICD 705', status: 'Active', expires: '', authority: '' },
    alarmIDS: { status: 'Operational', notes: '' },
    dcsaInspection: { rating: '', date: '' },
    internalInspection: { status: 'Scheduled', nextScheduled: '' },
    accessControl: { totalActive: '' },
  };
  const [form, setForm] = useState(isEdit ? {
    ...blank,
    name: fac.name || '',
    facilityType: fac.facilityType || 'SCIF',
    location: fac.location || '',
    siteId: fac.siteId || siteId || '',
    fclLevel: fac.fclLevel || 'SECRET',
    fclStatus: fac.fclStatus || 'Active',
    fclExpires: fac.fclExpires || '',
    complianceScore: fac.complianceScore ?? '',
    accreditation: { type: fac.accreditation?.type || 'ICD 705', status: fac.accreditation?.status || 'Active', expires: fac.accreditation?.expires || '', authority: fac.accreditation?.authority || '' },
    alarmIDS: { status: fac.alarmIDS?.status || 'Operational', notes: fac.alarmIDS?.notes || '' },
    dcsaInspection: { rating: fac.dcsaInspection?.rating || '', date: fac.dcsaInspection?.date || '' },
    internalInspection: { status: fac.internalInspection?.status || '', nextScheduled: fac.internalInspection?.nextScheduled || '' },
    accessControl: { totalActive: fac.accessControl?.totalActive ?? '' },
  } : blank);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const setN = (parent, f, v) => setForm(p => ({ ...p, [parent]: { ...(p[parent] || {}), [f]: v } }));

  async function handleDelete() {
    if (!window.confirm(`Delete facility "${form.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const result = await WS.del('facility_security', fac.id);
      if (result?._wsError) {
        alert(result.message || 'Delete failed');
      } else {
        onSave();
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete facility');
    } finally {
      setDeleting(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.siteId) {
      alert('Error: Site ID is required. Please select a site and try again.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const result = await WS.patch('facility_security', fac.id, form);
        if (result?._wsError) {
          alert(`Save failed: ${result.message}`);
          setSaving(false);
          return;
        }
      } else {
        const result = await WS.post('facility_security', form);
        if (result?._wsError) {
          alert(`Save failed: ${result.message}`);
          setSaving(false);
          return;
        }
      }
      onSave();
    } catch (err) {
      console.error('Form submission error:', err);
      alert(`Error: ${err.message}`);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg-strong)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(700px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <h3>{isEdit ? 'Edit Facility' : 'Add Facility'}</h3>
            {!isEdit && siteId && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Site: <strong>{siteId}</strong></div>}
          </div>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={submit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div>
              <div className="ws-section-label">Facility Details</div>
              <div className="ws-grid-2" style={{ gap: '0.75rem', marginTop: '0.65rem' }}>
                <FormField label="Facility Name *">
                  <input className="ws-input" required value={form.name} onChange={e => set('name', e.target.value)} />
                </FormField>
                <FormField label="Type">
                  <select className="ws-input" value={form.facilityType} onChange={e => set('facilityType', e.target.value)}>
                    {FAC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Location">
                  <input className="ws-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Building, address, or suite" />
                </FormField>
                <FormField label="Compliance Score (%)">
                  <input className="ws-input" type="number" min={0} max={100} value={form.complianceScore} onChange={e => set('complianceScore', e.target.value === '' ? '' : Number(e.target.value))} />
                </FormField>
              </div>
            </div>

            <div>
              <div className="ws-section-label">Facility Clearance (FCL)</div>
              <div className="ws-grid-3" style={{ gap: '0.75rem', marginTop: '0.65rem' }}>
                <FormField label="FCL Level">
                  <select className="ws-input" value={form.fclLevel} onChange={e => set('fclLevel', e.target.value)}>
                    {FCL_LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </FormField>
                <FormField label="FCL Status">
                  <select className="ws-input" value={form.fclStatus} onChange={e => set('fclStatus', e.target.value)}>
                    {FCL_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="FCL Expires">
                  <input className="ws-input" type="date" value={form.fclExpires} onChange={e => set('fclExpires', e.target.value)} />
                </FormField>
              </div>
            </div>

            <div>
              <div className="ws-section-label">Accreditation</div>
              <div className="ws-grid-2" style={{ gap: '0.75rem', marginTop: '0.65rem' }}>
                <FormField label="Type">
                  <select className="ws-input" value={form.accreditation.type} onChange={e => setN('accreditation', 'type', e.target.value)}>
                    {ACC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className="ws-input" value={form.accreditation.status} onChange={e => setN('accreditation', 'status', e.target.value)}>
                    {ACC_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Accreditation Expires">
                  <input className="ws-input" type="date" value={form.accreditation.expires} onChange={e => setN('accreditation', 'expires', e.target.value)} />
                </FormField>
                <FormField label="Accrediting Authority">
                  <input className="ws-input" value={form.accreditation.authority} onChange={e => setN('accreditation', 'authority', e.target.value)} placeholder="e.g. DCSA ISSM" />
                </FormField>
              </div>
            </div>

            <div>
              <div className="ws-section-label">IDS / Alarm Status</div>
              <div className="ws-grid-2" style={{ gap: '0.75rem', marginTop: '0.65rem' }}>
                <FormField label="IDS Status">
                  <select className="ws-input" value={form.alarmIDS.status} onChange={e => setN('alarmIDS', 'status', e.target.value)}>
                    {IDS_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="IDS Notes">
                  <input className="ws-input" value={form.alarmIDS.notes} onChange={e => setN('alarmIDS', 'notes', e.target.value)} placeholder="Describe any zones affected" />
                </FormField>
              </div>
            </div>

            <div>
              <div className="ws-section-label">Inspection Status</div>
              <div className="ws-grid-2" style={{ gap: '0.75rem', marginTop: '0.65rem' }}>
                <FormField label="DCSA Rating">
                  <select className="ws-input" value={form.dcsaInspection.rating} onChange={e => setN('dcsaInspection', 'rating', e.target.value)}>
                    <option value="">— Not yet inspected —</option>
                    {DCSA_RATINGS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </FormField>
                <FormField label="DCSA Inspection Date">
                  <input className="ws-input" type="date" value={form.dcsaInspection.date} onChange={e => setN('dcsaInspection', 'date', e.target.value)} />
                </FormField>
                <FormField label="Internal Inspection Status">
                  <select className="ws-input" value={form.internalInspection.status} onChange={e => setN('internalInspection', 'status', e.target.value)}>
                    {INSP_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Next Internal Inspection">
                  <input className="ws-input" type="date" value={form.internalInspection.nextScheduled} onChange={e => setN('internalInspection', 'nextScheduled', e.target.value)} />
                </FormField>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
              <div>
                {isEdit && (
                  <button type="button" className="ws-action-btn" style={{ color: 'var(--red)' }} disabled={deleting} onClick={handleDelete}>
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
                <button type="submit" disabled={saving || deleting} className="ws-action-btn primary" style={{ padding: '0.4rem 1.25rem', width: 'auto' }}>
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Facility'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddIssueForm({ fac, onSave, onClose }) {
  const [form, setForm] = useState({ title: '', severity: 'Medium', owner: '', dueDate: '', status: 'Open' });
  const [saving, setSaving] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const newIssue = { id: 'iss-' + Date.now(), ...form };
      await WS.patch('facility_security', fac.id, { openIssues: [...(fac.openIssues || []), newIssue] });
      onSave();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg-strong)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(480px, 100%)' }}>
        <div className="ws-card-header">
          <h3>Add Issue — {fac.name}</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={submit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <FormField label="Issue Title *">
              <input className="ws-input" required value={form.title} onChange={e => set('title', e.target.value)} />
            </FormField>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Severity">
                <select className="ws-input" value={form.severity} onChange={e => set('severity', e.target.value)}>
                  {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select className="ws-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {['Open', 'In Progress', 'Mitigated', 'Closed'].map(s => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Owner">
                <input className="ws-input" value={form.owner} onChange={e => set('owner', e.target.value)} />
              </FormField>
              <FormField label="Due Date">
                <input className="ws-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={saving} className="ws-action-btn primary">
                {saving ? 'Saving…' : 'Add Issue'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function FacilityCard({ fac, onEdit, onAddIssue }) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = (fac.openIssues?.length || 0) + (fac.waivers?.length || 0) + (fac.vulnerabilities?.length || 0) > 0;

  const today = new Date();
  const accExpiry = fac.accreditation?.expires ? new Date(fac.accreditation.expires + 'T12:00:00Z') : null;
  const accExpiringSoon = accExpiry && accExpiry > today && accExpiry <= new Date(today.getTime() + 90 * 86400000);
  const accExpired = accExpiry && accExpiry < today;

  return (
    <div className="facility-card">
      <div className="facility-card-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{fac.name}</h3>
          <div className="sub">{fac.facilityType} · {fac.location}</div>
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span className={`badge ${statusBadge(fac.fclStatus)}`}>FCL: {fac.fclLevel} {fac.fclStatus}</span>
            <span className={`badge ${statusBadge(fac.accreditation?.status)}`}>
              {fac.accreditation?.type || 'Accreditation'}: {fac.accreditation?.status}
            </span>
            {accExpiringSoon && <span className="badge badge-amber">Reaccreditation within 90 days</span>}
            {accExpired && <span className="badge badge-red">Accreditation Expired</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className={`facility-score ${scoreClass(fac.complianceScore)}`}>{fac.complianceScore ?? '—'}%</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>compliance</div>
          <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
            <button type="button" className="ws-action-btn" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => onAddIssue(fac)}>
              + Issue
            </button>
            <button type="button" className="ws-action-btn" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => onEdit(fac)}>
              Edit
            </button>
          </div>
        </div>
      </div>

      {fac.complianceScore != null && <ProgressBar value={fac.complianceScore} label="Compliance posture" />}

      <hr className="facility-divider" />

      <div className="facility-grid">
        <div className="facility-stat">
          <label>IDS Status</label>
          <span className={fac.alarmIDS?.status !== 'Operational' ? 'badge badge-red' : 'badge badge-green'} style={{ display: 'inline-flex' }}>
            {fac.alarmIDS?.status || '—'}
          </span>
        </div>
        <div className="facility-stat">
          <label>DCSA Inspection</label>
          <span>{fac.dcsaInspection?.rating || '—'}{fac.dcsaInspection?.date ? ` · ${fmtDate(fac.dcsaInspection.date)}` : ''}</span>
        </div>
        <div className="facility-stat">
          <label>Internal Inspection</label>
          <span>{fac.internalInspection?.status || '—'} · Next {fmtDate(fac.internalInspection?.nextScheduled)}</span>
        </div>
        <div className="facility-stat">
          <label>Access List</label>
          <span>{fac.accessControl?.totalActive ?? '—'} active</span>
        </div>
        <div className="facility-stat">
          <label>FCL Expires</label>
          <span>{fmtDate(fac.fclExpires)}</span>
        </div>
        <div className="facility-stat">
          <label>Accreditation Expires</label>
          <span>{fmtDate(fac.accreditation?.expires)}</span>
        </div>
      </div>

      {fac.accreditation?.milestones?.length > 0 && (
        <>
          <div className="ws-section-label" style={{ marginTop: '0.75rem' }}>Accreditation Milestones</div>
          <div className="issue-list">
            {fac.accreditation.milestones.map(m => (
              <div key={m.id} className="issue-item">
                <span className={`issue-dot ${m.status === 'pending' ? 'red' : m.status === 'upcoming' ? 'amber' : 'blue'}`} />
                <span style={{ flex: 1 }}>{m.title}</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>{fmtDate(m.date)}</span>
                <span className={`badge ${statusBadge(m.status)}`}>{m.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {fac.construction?.active && (
        <>
          <div className="ws-section-label" style={{ marginTop: '0.75rem' }}>Active Construction</div>
          <div className="issue-item">
            <span className="issue-dot amber" />
            <span style={{ flex: 1 }}>{fac.construction.project} — {fac.construction.phase}</span>
            {fac.construction.ssoRequired && <span className="badge badge-amber">SSO Required</span>}
          </div>
        </>
      )}

      {hasIssues && (
        <>
          <button
            type="button"
            style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--primary)', font: '600 0.75rem Inter, sans-serif', cursor: 'pointer', padding: 0 }}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? '▲ Hide' : '▼ Show'} issues &amp; waivers
            ({(fac.openIssues?.length || 0) + (fac.waivers?.length || 0) + (fac.vulnerabilities?.length || 0)})
          </button>
          {expanded && (
            <div className="issue-list">
              {(fac.openIssues || []).map(i => (
                <div key={i.id} className="issue-item">
                  <span className={`issue-dot ${issueDot(i.severity)}`} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '0.78rem' }}>{i.title}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Owner: {i.owner} · Due {fmtDate(i.dueDate)}</span>
                  </div>
                  <span className={`badge ${statusBadge(i.status)}`}>{i.status}</span>
                </div>
              ))}
              {(fac.waivers || []).map(w => (
                <div key={w.id} className="issue-item">
                  <span className="issue-dot blue" />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '0.78rem' }}>Waiver: {w.description}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Expires {fmtDate(w.expires)}</span>
                  </div>
                  <span className={`badge ${statusBadge(w.status)}`}>{w.status}</span>
                </div>
              ))}
              {(fac.vulnerabilities || []).map(v => (
                <div key={v.id} className="issue-item">
                  <span className={`issue-dot ${issueDot(v.severity)}`} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '0.78rem' }}>{v.title}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{v.mitigation}</span>
                  </div>
                  <span className={`badge ${statusBadge(v.status)}`}>{v.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FacilityPage({ siteId, user, sites }) {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingFac, setEditingFac] = useState(null);
  const [addingFac, setAddingFac] = useState(false);
  const [addingIssueTo, setAddingIssueTo] = useState(null);
  const [showSiteWarning, setShowSiteWarning] = useState(false);

  const requiresSiteSelection = Boolean(user?.canSeeAllSites || (user?.siteIds?.length > 1));
  const readSiteId = siteId || (!requiresSiteSelection ? (user?.primarySiteId || user?.siteIds?.[0] || '') : '');
  const createSiteId = siteId || user?.primarySiteId || user?.siteIds?.[0] || '';

  function load() {
    setLoading(true);
    setLoadError(null);
    const params = readSiteId ? { siteId: readSiteId } : {};
    WS.get('facility_security', params).then(d => {
      if (d?._wsError) { setLoadError(d.message); setLoading(false); return; }
      setFacilities(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, [readSiteId]);

  function handleSaved() {
    setEditingFac(null);
    setAddingFac(false);
    setAddingIssueTo(null);
    load();
  }

  function handleAddFacilityClick() {
    if (requiresSiteSelection && !siteId) {
      setShowSiteWarning(true);
      return;
    }
    setAddingFac(true);
  }

  const facilityTypes = [...new Set(facilities.map(f => f.facilityType).filter(Boolean))];
  const filtered = facilities.filter(f => {
    const matchSearch = !search ||
      f.name?.toLowerCase().includes(search.toLowerCase()) ||
      f.location?.toLowerCase().includes(search.toLowerCase()) ||
      f.facilityType?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || f.facilityType === typeFilter;
    return matchSearch && matchType;
  });

  const today = new Date();
  const idsIssues = facilities.filter(f => f.alarmIDS?.status && f.alarmIDS.status !== 'Operational');
  const accIssues = facilities.filter(f => {
    const exp = f.accreditation?.expires ? new Date(f.accreditation.expires + 'T12:00:00Z') : null;
    return exp && exp <= new Date(today.getTime() + 90 * 86400000);
  });

  if (loading) return <div className="ws-empty">Loading facilities…</div>;
  if (loadError) return <div className="ws-empty">Failed to load facilities: {loadError}</div>;

  return (
    <div className="ws-page">
      {showSiteWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg-strong)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="ws-card" style={{ width: 'min(420px, 100%)' }}>
            <div className="ws-card-header">
              <h3>⚠️ Site Required</h3>
            </div>
            <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Please select a site from the dropdown menu at the top before adding facilities. Each facility must be assigned to a specific site.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="ws-action-btn primary" onClick={() => setShowSiteWarning(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {(editingFac || addingFac) && (
        <FacilityForm
          fac={editingFac || null}
          siteId={createSiteId}
          onSave={handleSaved}
          onClose={() => { setEditingFac(null); setAddingFac(false); }}
        />
      )}
      {addingIssueTo && (
        <AddIssueForm fac={addingIssueTo} onSave={handleSaved} onClose={() => setAddingIssueTo(null)} />
      )}

      <div className="ws-page-header">
        <div>
          <div className="ws-page-title">Facility Security</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {idsIssues.length > 0 && (
            <span className="ws-count-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red-border)' }}>
              {idsIssues.length} IDS issue{idsIssues.length !== 1 ? 's' : ''}
            </span>
          )}
          {accIssues.length > 0 && (
            <span className="ws-count-badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: 'var(--amber-border)' }}>
              {accIssues.length} accreditation alert{accIssues.length !== 1 ? 's' : ''}
            </span>
          )}
          <button type="button" className="ws-action-btn primary" onClick={handleAddFacilityClick}>
            + Add Facility
          </button>
        </div>
      </div>

      <div className="ws-filter-bar">
        <input
          className="ws-search"
          placeholder="Search by name, location, or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="ws-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {facilityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="ws-empty">No facilities found.</div>
      ) : (
        <div className="ws-grid-2">
          {filtered.map(f => (
            <FacilityCard
              key={f.id}
              fac={f}
              onEdit={setEditingFac}
              onAddIssue={setAddingIssueTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}
