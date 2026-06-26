import { useState, useEffect } from 'react';
import { WS, fmtDate, daysUntil, trainingBadge, statusBadge } from '../app.js';

const TRAINING_KEYS = [
  { key: 'annualBriefing',      label: 'Annual',  fullLabel: 'Annual Security Briefing' },
  { key: 'insiderThreat',       label: 'Insider Threat', fullLabel: 'Insider Threat (CDSE INT101)' },
  { key: 'counterIntelligence', label: 'CI',      fullLabel: 'Counterintelligence (CI)' },
  { key: 'cybersecurity',       label: 'Cyber',   fullLabel: 'Cybersecurity Awareness' },
];

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ font: '500 0.72rem Inter, sans-serif', color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}

function prdWarning(prd) {
  const days = daysUntil(prd);
  if (days === null) return null;
  if (days < 0) return { tone: 'red', label: 'PRD Expired' };
  if (days <= 90) return { tone: 'red', label: `PRD in ${days}d` };
  if (days <= 180) return { tone: 'amber', label: `PRD in ${Math.round(days / 30)}mo` };
  return null;
}

function PersonnelForm({ person, siteId, onSave, onClose }) {
  const isEdit = !!person;
  const blank = {
    name: '', position: '', org: '', siteId: siteId || '',
    clearanceLevel: 'SECRET', clearanceStatus: 'Active',
    clearanceGrantDate: '', clearancePRD: '', indocDate: '',
    cvStatus: '', nbisEappStatus: '',
  };
  const [form, setForm] = useState(isEdit ? {
    name: person.name || '',
    position: person.position || '',
    org: person.org || '',
    siteId: person.siteId || siteId || '',
    clearanceLevel: person.clearanceLevel || 'SECRET',
    clearanceStatus: person.clearanceStatus || 'Active',
    clearanceGrantDate: person.clearanceGrantDate || '',
    clearancePRD: person.clearancePRD || '',
    indocDate: person.indocDate || '',
    cvStatus: person.cvStatus || '',
    nbisEappStatus: person.nbisEappStatus || '',
  } : blank);
  const [saving, setSaving] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.siteId) {
      alert('Error: Site ID is required. Please select a site and try again.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const result = await WS.patch('personnel_security', person.id, form);
        if (result?._wsError) {
          throw new Error(result.message || 'Failed to update personnel');
        }
        onSave(person.id);
      } else {
        const rec = await WS.post('personnel_security', {
          ...form, training: {}, visitAccessRequests: [], foreignTravel: [], adverseInfo: [],
        });
        if (rec?._wsError) {
          throw new Error(rec.message || 'Failed to create personnel');
        }
        onSave(rec?.id);
      }
    } catch (err) {
      console.error('Form submission error:', err);
      alert(`Error: ${err.message}`);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg-strong)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7.25rem 1.5rem 2.25rem', overflowY: 'auto' }}>
      <div className="ws-card" style={{ width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 9.5rem)', overflowY: 'auto', borderRadius: '24px', border: '1px solid rgba(148, 163, 184, 0.28)', boxShadow: '0 32px 90px rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(18px)' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <h3>{isEdit ? `Edit — ${person.name}` : 'Add Personnel'}</h3>
            {!isEdit && siteId && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Site: <strong>{siteId}</strong></div>}
          </div>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={submit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div>
              <div className="ws-section-label">Personnel Information</div>
              <div className="ws-grid-2" style={{ gap: '0.75rem', marginTop: '0.65rem' }}>
                <FormField label="Full Name *">
                  <input className="ws-input" required value={form.name} onChange={e => set('name', e.target.value)} />
                </FormField>
                <FormField label="Position / Title">
                  <input className="ws-input" value={form.position} onChange={e => set('position', e.target.value)} />
                </FormField>
                <FormField label="Organization">
                  <input className="ws-input" value={form.org} onChange={e => set('org', e.target.value)} />
                </FormField>
                <FormField label="Site ID">
                  <input className="ws-input" value={form.siteId} onChange={e => isEdit && set('siteId', e.target.value)} readOnly={!isEdit} placeholder={isEdit ? 'e.g. MTSI-VA' : ''} style={!isEdit ? { backgroundColor: 'var(--bg-alt)', cursor: 'not-allowed' } : {}} />
                </FormField>
              </div>
            </div>

            <div>
              <div className="ws-section-label">Clearance</div>
              <div className="ws-grid-2" style={{ gap: '0.75rem', marginTop: '0.65rem' }}>
                <FormField label="Clearance Level">
                  <select className="ws-input" value={form.clearanceLevel} onChange={e => set('clearanceLevel', e.target.value)}>
                    {['CONFIDENTIAL', 'SECRET', 'TOP SECRET', 'TOP SECRET / SCI'].map(l => <option key={l}>{l}</option>)}
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className="ws-input" value={form.clearanceStatus} onChange={e => set('clearanceStatus', e.target.value)}>
                    {['Active', 'Pending', 'Interim', 'Suspended', 'Revoked'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Grant Date">
                  <input className="ws-input" type="date" value={form.clearanceGrantDate} onChange={e => set('clearanceGrantDate', e.target.value)} />
                </FormField>
                <FormField label="PRD (Reinvestigation Due)">
                  <input className="ws-input" type="date" value={form.clearancePRD} onChange={e => set('clearancePRD', e.target.value)} />
                </FormField>
                <FormField label="Indoc Date">
                  <input className="ws-input" type="date" value={form.indocDate} onChange={e => set('indocDate', e.target.value)} />
                </FormField>
                <FormField label="CV Status">
                  <select className="ws-input" value={form.cvStatus} onChange={e => set('cvStatus', e.target.value)}>
                    <option value="">— N/A —</option>
                    {['Current', 'Overdue', 'Pending', 'Exempt'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
              </div>
            </div>

            <div>
              <div className="ws-section-label">NBIS / eApp</div>
              <div style={{ marginTop: '0.65rem', maxWidth: 280 }}>
                <FormField label="NBIS / eApp Status">
                  <select className="ws-input" value={form.nbisEappStatus} onChange={e => set('nbisEappStatus', e.target.value)}>
                    <option value="">— N/A —</option>
                    {['Enrolled', 'Not Enrolled', 'Pending Enrollment', 'Deactivated'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={saving} className="ws-action-btn primary" style={{ padding: '0.4rem 1.25rem', width: 'auto' }}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Personnel'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PersonnelDetail({ person, onClose, onEdit, onSubSaved, onDelete }) {
  const training = person.training || {};
  const [subPanel, setSubPanel] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await WS.del('personnel_security', person.id);
      if (result?._wsError) {
        alert(result.message || 'Failed to delete personnel');
      } else {
        onDelete(person.id);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete personnel');
    } finally {
      setDeleting(false);
    }
  }

  const [trainingForm, setTrainingForm] = useState({ key: 'annualBriefing', completed: '', due: '', status: 'Current' });
  const [tSaving, setTSaving] = useState(false);
  async function submitTraining(e) {
    e.preventDefault();
    setTSaving(true);
    try {
      const updated = { ...training, [trainingForm.key]: { completed: trainingForm.completed, due: trainingForm.due, status: trainingForm.status } };
      await WS.patch('personnel_security', person.id, { training: updated });
      setSubPanel(null);
      onSubSaved(person.id);
    } finally { setTSaving(false); }
  }

  const [travelForm, setTravelForm] = useState({ country: '', dates: '', purpose: '', preBriefed: false, debriefed: false });
  const [tvSaving, setTvSaving] = useState(false);
  async function submitTravel(e) {
    e.preventDefault();
    setTvSaving(true);
    try {
      const newRec = { id: 'ft-' + Date.now(), ...travelForm };
      await WS.patch('personnel_security', person.id, { foreignTravel: [...(person.foreignTravel || []), newRec] });
      setTravelForm({ country: '', dates: '', purpose: '', preBriefed: false, debriefed: false });
      setSubPanel(null);
      onSubSaved(person.id);
    } finally { setTvSaving(false); }
  }

  const [varForm, setVarForm] = useState({ visitorName: '', clearance: '', purpose: '', visitDate: '', status: 'Pending' });
  const [vSaving, setVSaving] = useState(false);
  async function submitVar(e) {
    e.preventDefault();
    setVSaving(true);
    try {
      const newRec = { id: 'var-' + Date.now(), ...varForm };
      await WS.patch('personnel_security', person.id, { visitAccessRequests: [...(person.visitAccessRequests || []), newRec] });
      setVarForm({ visitorName: '', clearance: '', purpose: '', visitDate: '', status: 'Pending' });
      setSubPanel(null);
      onSubSaved(person.id);
    } finally { setVSaving(false); }
  }

  const [adverseForm, setAdverseForm] = useState({ type: '', reportedDate: '', disposition: '', status: 'Open' });
  const [aSaving, setASaving] = useState(false);
  async function submitAdverse(e) {
    e.preventDefault();
    setASaving(true);
    try {
      const newRec = { id: 'adv-' + Date.now(), ...adverseForm };
      await WS.patch('personnel_security', person.id, { adverseInfo: [...(person.adverseInfo || []), newRec] });
      setAdverseForm({ type: '', reportedDate: '', disposition: '', status: 'Open' });
      setSubPanel(null);
      onSubSaved(person.id);
    } finally { setASaving(false); }
  }

  const subPanelStyle = { background: 'var(--bg-alt)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid var(--border)' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7.25rem 1.5rem 2.25rem', overflowY: 'auto' }}>
      <div className="ws-card" style={{ width: 'min(720px, 100%)', maxHeight: 'calc(100vh - 9.5rem)', overflowY: 'auto', borderRadius: '24px', border: '1px solid rgba(148, 163, 184, 0.28)', boxShadow: '0 32px 90px rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(18px)' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <h3>{person.name}</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{person.position} · {person.org}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className={`badge ${statusBadge(person.clearanceStatus)}`}>{person.clearanceLevel}</span>
            <button type="button" className="ws-action-btn" onClick={() => onEdit(person)}>Edit</button>
            <button type="button" className="ws-action-btn" style={{ color: 'var(--red)' }} onClick={() => setShowDeleteConfirm(true)}>Delete</button>
            <button type="button" className="ws-action-btn" onClick={onClose}>Close</button>
          </div>
        </div>
        {showDeleteConfirm && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--overlay-bg-strong)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', borderRadius: 'inherit' }}>
            <div className="ws-card" style={{ width: 'min(380px, 100%)' }}>
              <div className="ws-card-header">
                <h3>⚠️ Delete Personnel</h3>
              </div>
              <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>
                  Are you sure you want to delete <strong>{person.name}</strong>? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="ws-action-btn" disabled={deleting} onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </button>
                  <button type="button" className="ws-action-btn" style={{ background: 'var(--red)', color: 'white' }} disabled={deleting} onClick={handleDelete}>
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Info grid */}
          <div className="ws-grid-3" style={{ gap: '0.75rem' }}>
            {[
              { label: 'Position',         value: person.position },
              { label: 'Organization',     value: person.org },
              { label: 'Site',             value: person.siteId },
              { label: 'Clearance Level',  value: person.clearanceLevel },
              { label: 'Clearance Status', value: person.clearanceStatus },
              { label: 'Grant Date',       value: fmtDate(person.clearanceGrantDate) },
              { label: 'PRD',              value: fmtDate(person.clearancePRD) },
              { label: 'Indoc Date',       value: fmtDate(person.indocDate) },
              { label: 'CV Status',        value: person.cvStatus || '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.5rem 0.65rem' }}>
                <div style={{ font: '500 0.65rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{label}</div>
                <div style={{ font: '600 0.8rem Inter, sans-serif', color: 'var(--text)', marginTop: '0.15rem' }}>{value || '—'}</div>
              </div>
            ))}
          </div>

          {/* Action toolbar */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.25rem', borderTop: '1px solid var(--border)' }}>
            {[
              { id: 'training', label: 'Update Training' },
              { id: 'travel',   label: '+ Foreign Travel' },
              { id: 'var',      label: '+ Visit Request (VAR)' },
              { id: 'adverse',  label: '+ Adverse Info' },
            ].map(btn => (
              <button
                key={btn.id}
                type="button"
                className={`ws-action-btn${subPanel === btn.id ? ' primary' : ''}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setSubPanel(subPanel === btn.id ? null : btn.id)}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Training update sub-panel */}
          {subPanel === 'training' && (
            <form onSubmit={submitTraining} style={subPanelStyle}>
              <div className="ws-section-label" style={{ marginBottom: '0.65rem' }}>Update Training Record</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Training Type">
                  <select className="ws-input" value={trainingForm.key} onChange={e => setTrainingForm(f => ({ ...f, key: e.target.value }))}>
                    {TRAINING_KEYS.map(t => <option key={t.key} value={t.key}>{t.fullLabel}</option>)}
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className="ws-input" value={trainingForm.status} onChange={e => setTrainingForm(f => ({ ...f, status: e.target.value }))}>
                    {['Current', 'Due Soon', 'Overdue'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Completed Date">
                  <input className="ws-input" type="date" value={trainingForm.completed} onChange={e => setTrainingForm(f => ({ ...f, completed: e.target.value }))} />
                </FormField>
                <FormField label="Due Date">
                  <input className="ws-input" type="date" value={trainingForm.due} onChange={e => setTrainingForm(f => ({ ...f, due: e.target.value }))} />
                </FormField>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.65rem' }}>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
                <button type="submit" disabled={tSaving} className="ws-action-btn primary">
                  {tSaving ? 'Saving…' : 'Update Training'}
                </button>
              </div>
            </form>
          )}

          {/* Foreign travel sub-panel */}
          {subPanel === 'travel' && (
            <form onSubmit={submitTravel} style={subPanelStyle}>
              <div className="ws-section-label" style={{ marginBottom: '0.65rem' }}>Add Foreign Travel Record</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Country *">
                  <input className="ws-input" required value={travelForm.country} onChange={e => setTravelForm(f => ({ ...f, country: e.target.value }))} />
                </FormField>
                <FormField label="Travel Dates">
                  <input className="ws-input" value={travelForm.dates} onChange={e => setTravelForm(f => ({ ...f, dates: e.target.value }))} placeholder="e.g. Jun 10–17, 2025" />
                </FormField>
                <FormField label="Purpose">
                  <input className="ws-input" value={travelForm.purpose} onChange={e => setTravelForm(f => ({ ...f, purpose: e.target.value }))} />
                </FormField>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', paddingTop: '1.25rem' }}>
                  {[['preBriefed', 'Pre-Briefed'], ['debriefed', 'Debriefed']].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', font: '500 0.78rem Inter, sans-serif', cursor: 'pointer' }}>
                      <input type="checkbox" checked={travelForm[key]} onChange={e => setTravelForm(f => ({ ...f, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.65rem' }}>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
                <button type="submit" disabled={tvSaving} className="ws-action-btn primary">
                  {tvSaving ? 'Saving…' : 'Add Travel Record'}
                </button>
              </div>
            </form>
          )}

          {/* VAR sub-panel */}
          {subPanel === 'var' && (
            <form onSubmit={submitVar} style={subPanelStyle}>
              <div className="ws-section-label" style={{ marginBottom: '0.65rem' }}>Add Visit Access Request (VAR)</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Visitor Name *">
                  <input className="ws-input" required value={varForm.visitorName} onChange={e => setVarForm(f => ({ ...f, visitorName: e.target.value }))} />
                </FormField>
                <FormField label="Clearance Level">
                  <input className="ws-input" value={varForm.clearance} onChange={e => setVarForm(f => ({ ...f, clearance: e.target.value }))} placeholder="e.g. TOP SECRET" />
                </FormField>
                <FormField label="Purpose">
                  <input className="ws-input" value={varForm.purpose} onChange={e => setVarForm(f => ({ ...f, purpose: e.target.value }))} />
                </FormField>
                <FormField label="Visit Date">
                  <input className="ws-input" type="date" value={varForm.visitDate} onChange={e => setVarForm(f => ({ ...f, visitDate: e.target.value }))} />
                </FormField>
                <FormField label="Status">
                  <select className="ws-input" value={varForm.status} onChange={e => setVarForm(f => ({ ...f, status: e.target.value }))}>
                    {['Pending', 'Approved', 'Denied', 'Completed'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.65rem' }}>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
                <button type="submit" disabled={vSaving} className="ws-action-btn primary">
                  {vSaving ? 'Saving…' : 'Submit VAR'}
                </button>
              </div>
            </form>
          )}

          {/* Adverse info sub-panel */}
          {subPanel === 'adverse' && (
            <form onSubmit={submitAdverse} style={subPanelStyle}>
              <div className="ws-section-label" style={{ marginBottom: '0.65rem' }}>Log Adverse Information</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Type *">
                  <select className="ws-input" required value={adverseForm.type} onChange={e => setAdverseForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="">— Select Type —</option>
                    {['Financial', 'Criminal', 'Alcohol / Drug', 'Foreign Contact', 'Personal Conduct', 'Psychological', 'Technology'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Reported Date">
                  <input className="ws-input" type="date" value={adverseForm.reportedDate} onChange={e => setAdverseForm(f => ({ ...f, reportedDate: e.target.value }))} />
                </FormField>
                <FormField label="Disposition">
                  <input className="ws-input" value={adverseForm.disposition} onChange={e => setAdverseForm(f => ({ ...f, disposition: e.target.value }))} placeholder="Brief description" />
                </FormField>
                <FormField label="Status">
                  <select className="ws-input" value={adverseForm.status} onChange={e => setAdverseForm(f => ({ ...f, status: e.target.value }))}>
                    {['Open', 'Under Review', 'Closed', 'Referred to DCSA'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.65rem' }}>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
                <button type="submit" disabled={aSaving} className="ws-action-btn primary">
                  {aSaving ? 'Saving…' : 'Log Adverse Info'}
                </button>
              </div>
            </form>
          )}

          {/* Training status */}
          <div>
            <div className="ws-section-label">Training Status</div>
            <table className="ws-table" style={{ marginTop: '0.5rem' }}>
              <thead><tr><th>Training</th><th>Completed</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {TRAINING_KEYS.map(({ key, fullLabel }) => {
                  const t = training[key];
                  if (!t) return <tr key={key}><td>{fullLabel}</td><td colSpan={3} className="cell-muted">Not required</td></tr>;
                  return (
                    <tr key={key}>
                      <td><strong>{fullLabel}</strong>{t.course && <div className="cell-muted">{t.course}</div>}</td>
                      <td className="cell-muted">{fmtDate(t.completed)}</td>
                      <td className="cell-muted">{fmtDate(t.due)}</td>
                      <td><span className={`badge ${trainingBadge(t.status)}`}>{t.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(person.formalAccess || []).length > 0 && (
            <div>
              <div className="ws-section-label">Formal Program Access</div>
              <table className="ws-table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Program</th><th>Indoc Date</th><th>Status</th></tr></thead>
                <tbody>
                  {person.formalAccess.map((a, i) => (
                    <tr key={i}>
                      <td><strong>{a.program}</strong></td>
                      <td className="cell-muted">{fmtDate(a.indocDate)}</td>
                      <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(person.visitAccessRequests || []).length > 0 && (
            <div>
              <div className="ws-section-label">Visit Access Requests</div>
              <table className="ws-table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Visitor</th><th>Clearance</th><th>Purpose</th><th>Visit Date</th><th>Status</th></tr></thead>
                <tbody>
                  {person.visitAccessRequests.map(v => (
                    <tr key={v.id}>
                      <td><strong>{v.visitorName}</strong></td>
                      <td className="cell-muted">{v.clearance}</td>
                      <td className="cell-muted">{v.purpose}</td>
                      <td className="cell-muted">{fmtDate(v.visitDate)}</td>
                      <td><span className={`badge ${statusBadge(v.status)}`}>{v.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(person.foreignTravel || []).length > 0 && (
            <div>
              <div className="ws-section-label">Foreign Travel</div>
              <table className="ws-table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Country</th><th>Dates</th><th>Purpose</th><th>Pre-Briefed</th><th>Debriefed</th></tr></thead>
                <tbody>
                  {person.foreignTravel.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.country}</strong></td>
                      <td className="cell-muted">{t.dates}</td>
                      <td className="cell-muted">{t.purpose}</td>
                      <td>{t.preBriefed ? <span className="badge badge-green">Yes</span> : <span className="badge badge-red">No</span>}</td>
                      <td>{t.debriefed ? <span className="badge badge-green">Yes</span> : <span className="badge badge-red">Pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(person.adverseInfo || []).length > 0 && (
            <div>
              <div className="ws-section-label">Adverse Information</div>
              <table className="ws-table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Type</th><th>Reported</th><th>Disposition</th><th>Status</th></tr></thead>
                <tbody>
                  {person.adverseInfo.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.type}</strong></td>
                      <td className="cell-muted">{fmtDate(a.reportedDate)}</td>
                      <td className="cell-muted">{a.disposition || '—'}</td>
                      <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {person.notes && (
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.65rem', fontSize: '0.8rem', color: 'var(--text-2)' }}>
              <strong>Notes: </strong>{person.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonnelRow({ person, onSelect }) {
  const training = person.training || {};
  const hasOverdue = Object.values(training).some(t => t && t.status === 'Overdue');
  const hasDueSoon = Object.values(training).some(t => t && t.status === 'Due Soon');
  const hasForeignTravel = (person.foreignTravel || []).some(t => !t.debriefed);
  const prd = prdWarning(person.clearancePRD);

  return (
    <tr onClick={() => onSelect(person)} style={{ cursor: 'pointer' }}>
      <td>
        <strong>{person.name}</strong>
        <div className="cell-muted">{person.position}</div>
      </td>
      <td className="cell-muted">{person.org}</td>
      <td>
        <span className={`badge ${statusBadge(person.clearanceStatus)}`}>
          {person.clearanceLevel} · {person.clearanceStatus}
        </span>
      </td>
      <td>
        <span className="cell-muted">{fmtDate(person.clearancePRD)}</span>
        {prd && <div><span className={`badge badge-${prd.tone}`}>{prd.label}</span></div>}
      </td>
      <td>
        {TRAINING_KEYS.map(({ key, label }) => {
          const t = training[key];
          if (!t) return <span key={key} className="badge badge-gray" style={{ marginRight: '0.2rem', marginBottom: '0.2rem' }}>{label}: N/A</span>;
          return (
            <span key={key} className={`badge ${trainingBadge(t.status)}`} style={{ marginRight: '0.2rem', marginBottom: '0.2rem' }}>
              {label}
            </span>
          );
        })}
      </td>
      <td>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {hasOverdue && <span className="badge badge-red">Training Overdue</span>}
          {hasDueSoon && !hasOverdue && <span className="badge badge-amber">Due Soon</span>}
          {hasForeignTravel && <span className="badge badge-amber">Travel Debrief Pending</span>}
          {(person.adverseInfo || []).some(a => a.status !== 'Closed') && <span className="badge badge-amber">Adverse Info</span>}
          {!hasOverdue && !hasDueSoon && !hasForeignTravel && !(person.adverseInfo || []).some(a => a.status !== 'Closed') && (
            <span className="badge badge-green">Current</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function PersonnelPage({ siteId, user, sites }) {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [showSiteWarning, setShowSiteWarning] = useState(false);

  const requiresSiteSelection = Boolean(user?.canSeeAllSites || (user?.siteIds?.length > 1));
  const readSiteId = siteId || (!requiresSiteSelection ? (user?.primarySiteId || user?.siteIds?.[0] || '') : '');
  const createSiteId = siteId || user?.primarySiteId || user?.siteIds?.[0] || '';

  function load() {
    setLoading(true);
    setLoadError(null);
    const params = readSiteId ? { siteId: readSiteId } : {};
    WS.get('personnel_security', params).then(d => {
      if (d?._wsError) { setLoadError(d.message); setLoading(false); return; }
      setPersonnel(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, [readSiteId]);

  async function handleSubSaved(personId) {
    const d = await WS.get('personnel_security', readSiteId ? { siteId: readSiteId } : {});
    const list = Array.isArray(d) ? d : [];
    setPersonnel(list);
    if (personId) {
      const fresh = list.find(p => p.id === personId);
      if (fresh) setSelected(fresh);
    }
  }

  function handleFormSaved() {
    setEditingPerson(null);
    setAddingPerson(false);
    // Immediately reload to show updated list
    load();
  }

  function handleEditFromDetail(person) {
    setSelected(null);
    setEditingPerson(person);
  }

  function handleDeletePerson(personId) {
    setSelected(null);
    setPersonnel(prev => prev.filter(p => p.id !== personId));
    load();
  }

  function handleAddPersonnelClick() {
    if (requiresSiteSelection && !siteId) {
      setShowSiteWarning(true);
      return;
    }
    setAddingPerson(true);
  }

  const filtered = personnel.filter(p => {
    const matchSearch = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.position?.toLowerCase().includes(search.toLowerCase()) ||
      p.org?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
      filter === 'overdue' ? Object.values(p.training || {}).some(t => t && t.status === 'Overdue') :
      filter === 'due-soon' ? Object.values(p.training || {}).some(t => t && t.status === 'Due Soon') :
      filter === 'travel' ? (p.foreignTravel || []).some(t => !t.debriefed) :
      true;
    return matchSearch && matchFilter;
  });

  const overdueList = personnel.filter(p => Object.values(p.training || {}).some(t => t && t.status === 'Overdue'));
  const dueSoonCount = personnel.filter(p => Object.values(p.training || {}).some(t => t && t.status === 'Due Soon')).length;
  const debriefPending = personnel.filter(p => (p.foreignTravel || []).some(t => !t.debriefed)).length;

  if (loading) return <div className="ws-empty">Loading personnel…</div>;
  if (loadError) return <div className="ws-empty">Failed to load personnel: {loadError}</div>;

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
                Please select a site from the dropdown menu at the top before adding personnel. Each personnel record must be assigned to a specific site.
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
      {selected && (
        <PersonnelDetail
          person={selected}
          onClose={() => setSelected(null)}
          onEdit={handleEditFromDetail}
          onSubSaved={handleSubSaved}
          onDelete={handleDeletePerson}
        />
      )}
      {(editingPerson || addingPerson) && (
        <PersonnelForm
          person={editingPerson || null}
          siteId={createSiteId}
          onSave={handleFormSaved}
          onClose={() => { setEditingPerson(null); setAddingPerson(false); }}
        />
      )}

      {overdueList.length > 0 && (
        <div className="ws-banner red">
          <strong>{overdueList.length} personnel with overdue training</strong>
          {overdueList.map(p => p.name).join(', ')}
        </div>
      )}

      <div className="ws-page-header">
        <div>
          <div className="ws-page-title">Personnel Security</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {overdueList.length > 0 && (
            <span className="ws-count-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red-border)' }}>
              {overdueList.length} overdue
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="ws-count-badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: 'var(--amber-border)' }}>
              {dueSoonCount} due soon
            </span>
          )}
          {debriefPending > 0 && (
            <span className="ws-count-badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: 'var(--amber-border)' }}>
              {debriefPending} debrief pending
            </span>
          )}
          <button type="button" className="ws-action-btn primary" onClick={handleAddPersonnelClick}>
            + Add Personnel
          </button>
        </div>
      </div>

      <div className="ws-filter-bar">
        <input className="ws-search" placeholder="Search name, position, org…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="ws-select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Personnel</option>
          <option value="overdue">Training Overdue</option>
          <option value="due-soon">Due Soon</option>
          <option value="travel">Travel Debrief Pending</option>
        </select>
      </div>

      <div className="ws-card">
        <div className="ws-card-body" style={{ padding: 0 }}>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Name / Position</th>
                  <th>Org</th>
                  <th>Clearance</th>
                  <th>PRD</th>
                  <th>Training</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="ws-empty">No personnel match the current filter.</td></tr>
                ) : filtered.map(p => (
                  <PersonnelRow key={p.id} person={p} onSelect={setSelected} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Click any row to view full record, update training, log travel, or submit a VAR.</div>
    </div>
  );
}
