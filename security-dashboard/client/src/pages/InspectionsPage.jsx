import { useEffect, useState } from 'react';
import { AUTH, fmtDate, statusBadge, sevBadge } from '../app.js';

const INSPECTION_TYPES = ['Self', 'DCSA', 'Internal', 'Pre-Accreditation', 'Follow-Up'];
const STANDARDS = ['NISPOM', '32 CFR Part 117', 'Local SOP', 'Custom'];
const modalShellStyle = {
  position: 'fixed',
  inset: 0,
  background: 'var(--overlay-bg)',
  zIndex: 300,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '7.5rem 1.5rem 2rem',
  overflowY: 'auto',
};

function fmtInspectionDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return fmtDate(value);
}

async function api(path, options = {}) {
  const r = await fetch(path, {
    credentials: 'include',
    headers: AUTH.hdrs(),
    ...options,
  });
  if (r.status === 401) {
    AUTH.clearAll();
    window.location.reload();
    return null;
  }
  const body = await r.json();
  if (!r.ok) return { _apiError: true, status: r.status, message: body?.message || body?.error || 'Request failed' };
  return body;
}

function ProgressBar({ value = 0 }) {
  const tone = value >= 80 ? 'green' : value >= 50 ? 'amber' : 'red';
  return (
    <div className="ws-prog-wrap" style={{ minWidth: 120 }}>
      <div className="ws-prog-header">
        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Progress</span>
        <span style={{ fontWeight: 600, fontSize: '0.72rem' }}>{value}%</span>
      </div>
      <div className="ws-prog-track">
        <div className={`ws-prog-fill ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ font: '500 0.72rem Inter, sans-serif', color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}

function mergeCampaignItemUpdate(campaign, payload) {
  if (!campaign || !payload?.campaign) return payload?.campaign || campaign;
  return payload.campaign;
}

function FindingModal({ campaignId, item, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: item?.questionText || '',
    description: item?.inspectorComment || '',
    severity: item?.severity || 'Medium',
    requirementRef: item?.requirementRef || item?.controlRef || item?.nispomRef || '',
    responsibleOrg: '',
    responsibleUser: '',
    dueDate: '',
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      alert('Finding title and description are required.');
      return;
    }
    setSaving(true);
    try {
      const result = await api('/api/inspection-findings', {
        method: 'POST',
        body: JSON.stringify({
          campaignId,
          itemId: item.id,
          ...form,
        }),
      });
      if (!result || result._apiError) {
        alert(result?.message || 'Failed to create finding');
        return;
      }
      onSaved?.(result);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={modalShellStyle}>
      <div className="ws-card" style={{ width: 'min(720px, 100%)' }}>
        <div className="ws-card-header">
          <h3>Create Finding</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Finding Title *">
                <input className="ws-input" value={form.title} onChange={e => set('title', e.target.value)} />
              </FormField>
              <FormField label="Severity">
                <select className="ws-input" value={form.severity} onChange={e => set('severity', e.target.value)}>
                  {['Low', 'Medium', 'High', 'Critical'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Requirement Reference">
                <input className="ws-input" value={form.requirementRef} onChange={e => set('requirementRef', e.target.value)} />
              </FormField>
              <FormField label="Responsible User">
                <input className="ws-input" value={form.responsibleUser} onChange={e => set('responsibleUser', e.target.value)} />
              </FormField>
              <FormField label="Responsible Org">
                <input className="ws-input" value={form.responsibleOrg} onChange={e => set('responsibleOrg', e.target.value)} />
              </FormField>
              <FormField label="Due Date">
                <input className="ws-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Description *">
              <textarea className="ws-input" rows={4} value={form.description} onChange={e => set('description', e.target.value)} />
            </FormField>
          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ws-action-btn primary" disabled={saving}>{saving ? 'Saving…' : 'Create Finding'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CorrectiveActionModal({ findingId, action = null, onClose, onSaved }) {
  const [form, setForm] = useState({
    actionText: action?.actionText || '',
    assignedTo: action?.assignedTo || '',
    assignedOrg: action?.assignedOrg || '',
    targetDate: action?.targetDate ? String(action.targetDate).slice(0, 10) : '',
    status: action?.status || 'Open',
    verificationBy: action?.verificationBy || '',
    verificationNotes: action?.verificationNotes || '',
    completedDate: action?.completedDate ? String(action.completedDate).slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(action?.id);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.actionText.trim()) {
      alert('Corrective action text is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        actionText: form.actionText,
        assignedTo: form.assignedTo || null,
        assignedOrg: form.assignedOrg || null,
        targetDate: form.targetDate || null,
        status: form.status,
        verificationBy: form.verificationBy || null,
        verificationNotes: form.verificationNotes || null,
        completedDate: form.completedDate || null,
        ...(isEditing ? {} : { findingId }),
      };
      const result = await api(isEditing ? `/api/inspection-corrective-actions/${action.id}` : '/api/inspection-corrective-actions', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!result || result._apiError) {
        alert(result?.message || `Failed to ${isEditing ? 'update' : 'create'} corrective action`);
        return;
      }
      onSaved?.(result);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ ...modalShellStyle, zIndex: 350 }}>
      <div className="ws-card" style={{ width: 'min(760px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="ws-card-header">
          <h3>{isEditing ? 'Edit Corrective Action' : 'Add Corrective Action'}</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FormField label="Action *">
              <textarea className="ws-input" rows={3} value={form.actionText} onChange={e => set('actionText', e.target.value)} />
            </FormField>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Assigned To">
                <input className="ws-input" value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} />
              </FormField>
              <FormField label="Assigned Org">
                <input className="ws-input" value={form.assignedOrg} onChange={e => set('assignedOrg', e.target.value)} />
              </FormField>
              <FormField label="Target Date">
                <input className="ws-input" type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
              </FormField>
              <FormField label="Status">
                <select className="ws-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {['Open', 'In Progress', 'Pending Verification', 'Closed'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Completed Date">
                <input className="ws-input" type="date" value={form.completedDate} onChange={e => set('completedDate', e.target.value)} />
              </FormField>
              <FormField label="Verification By">
                <input className="ws-input" value={form.verificationBy} onChange={e => set('verificationBy', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Verification Notes">
              <textarea className="ws-input" rows={3} value={form.verificationNotes} onChange={e => set('verificationNotes', e.target.value)} />
            </FormField>
          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ws-action-btn primary" disabled={saving}>{saving ? 'Saving…' : (isEditing ? 'Save Action' : 'Create Action')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FindingDetailModal({ finding, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: finding?.title || '',
    description: finding?.description || '',
    severity: finding?.severity || 'Medium',
    requirementRef: finding?.requirementRef || '',
    responsibleOrg: finding?.responsibleOrg || '',
    responsibleUser: finding?.responsibleUser || '',
    dueDate: finding?.dueDate ? String(finding.dueDate).slice(0, 10) : '',
    status: finding?.status || 'Open',
    rootCause: finding?.rootCause || '',
    notes: finding?.notes || '',
    closedDate: finding?.closedDate ? String(finding.closedDate).slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      alert('Finding title and description are required.');
      return;
    }
    setSaving(true);
    try {
      const result = await api(`/api/inspection-findings/${finding.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          severity: form.severity,
          requirementRef: form.requirementRef || null,
          responsibleOrg: form.responsibleOrg || null,
          responsibleUser: form.responsibleUser || null,
          dueDate: form.dueDate || null,
          status: form.status,
          rootCause: form.rootCause || null,
          notes: form.notes || null,
          closedDate: form.closedDate || null,
        }),
      });
      if (!result || result._apiError) {
        alert(result?.message || 'Failed to update finding');
        return;
      }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const correctiveActions = finding?.correctiveActions || [];

  return (
    <div style={{ ...modalShellStyle, zIndex: 320 }}>
      <div className="ws-card" style={{ width: 'min(980px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="ws-card-header">
          <h3>Finding Workspace</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Close</button>
        </div>
        {actionModal && (
          <CorrectiveActionModal
            findingId={finding.id}
            action={actionModal === true ? null : actionModal}
            onClose={() => setActionModal(null)}
            onSaved={() => {
              setActionModal(null);
              onSaved?.();
            }}
          />
        )}
        <form onSubmit={handleSubmit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Finding Title *">
                <input className="ws-input" value={form.title} onChange={e => set('title', e.target.value)} />
              </FormField>
              <FormField label="Severity">
                <select className="ws-input" value={form.severity} onChange={e => set('severity', e.target.value)}>
                  {['Low', 'Medium', 'High', 'Critical'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Requirement Reference">
                <input className="ws-input" value={form.requirementRef} onChange={e => set('requirementRef', e.target.value)} />
              </FormField>
              <FormField label="Status">
                <select className="ws-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {['Open', 'In Progress', 'Pending Verification', 'Closed'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Responsible User">
                <input className="ws-input" value={form.responsibleUser} onChange={e => set('responsibleUser', e.target.value)} />
              </FormField>
              <FormField label="Responsible Org">
                <input className="ws-input" value={form.responsibleOrg} onChange={e => set('responsibleOrg', e.target.value)} />
              </FormField>
              <FormField label="Due Date">
                <input className="ws-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </FormField>
              <FormField label="Closed Date">
                <input className="ws-input" type="date" value={form.closedDate} onChange={e => set('closedDate', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Description *">
              <textarea className="ws-input" rows={4} value={form.description} onChange={e => set('description', e.target.value)} />
            </FormField>
            <FormField label="Root Cause">
              <textarea className="ws-input" rows={3} value={form.rootCause} onChange={e => set('rootCause', e.target.value)} />
            </FormField>
            <FormField label="Notes">
              <textarea className="ws-input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </FormField>

            <div>
              <div className="ws-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Corrective Actions</span>
                <button type="button" className="ws-action-btn primary" onClick={() => setActionModal(true)}>+ Add Action</button>
              </div>
              {correctiveActions.length === 0 ? (
                <div className="ws-empty" style={{ marginTop: '0.5rem' }}>No corrective actions assigned yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {correctiveActions.map(action => (
                    <div key={action.id} style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{action.actionText}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                            {[action.assignedTo, action.assignedOrg].filter(Boolean).join(' · ') || 'Unassigned'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className={`badge ${statusBadge(action.status)}`}>{action.status}</span>
                          <span className="badge badge-blue">{fmtInspectionDate(action.targetDate)}</span>
                          <button type="button" className="ws-action-btn" onClick={() => setActionModal(action)}>Edit</button>
                        </div>
                      </div>
                      {action.verificationNotes && (
                        <div style={{ marginTop: '0.55rem', color: 'var(--text-2)', fontSize: '0.78rem' }}>
                          Verification: {action.verificationNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="ws-action-btn" onClick={onClose}>Close</button>
            <button type="submit" className="ws-action-btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save Finding'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChecklistItemRow({ campaignId, item, onUpdated, onCreateFinding }) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(item.result || '');
  const [severity, setSeverity] = useState(item.severity || 'Medium');
  const [evidenceNotes, setEvidenceNotes] = useState(item.evidenceNotes || '');
  const [inspectorComment, setInspectorComment] = useState(item.inspectorComment || '');

  async function saveItem(next = {}) {
    setSaving(true);
    try {
      const payload = {
        result,
        severity,
        evidenceNotes,
        inspectorComment,
        ...next,
      };
      const response = await api(`/api/inspection-campaigns/${campaignId}/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!response || response._apiError) {
        alert(response?.message || 'Failed to save checklist item');
        return false;
      }
      onUpdated?.(response);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleResultChange(nextResult) {
    setResult(nextResult);
    await saveItem({ result: nextResult });
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '0.85rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{item.itemCode || item.nispomRef || item.requirementRef || 'Check'}</div>
          <div style={{ color: 'var(--text)', marginTop: '0.2rem', lineHeight: 1.55 }}>{item.questionText}</div>
          <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
            {[item.requirementRef, item.nispomRef, item.riskCategory].filter(Boolean).join(' · ') || 'No reference metadata'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
          {item.findings?.length > 0 && <span className="badge badge-red">{item.findings.length} finding{item.findings.length > 1 ? 's' : ''}</span>}
          <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {['Compliant', 'Non-Compliant', 'Observation', 'N/A'].map(option => (
          <button
            key={option}
            type="button"
            className={`ws-action-btn${result === option ? ' primary' : ''}`}
            onClick={() => handleResultChange(option)}
            disabled={saving}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
        <FormField label="Severity">
          <select className="ws-input" value={severity} onChange={e => setSeverity(e.target.value)} onBlur={() => saveItem()}>
            {['Low', 'Medium', 'High', 'Critical'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </FormField>
        <FormField label="Evidence Notes">
          <input className="ws-input" value={evidenceNotes} onChange={e => setEvidenceNotes(e.target.value)} onBlur={() => saveItem()} placeholder="Badge logs, alarm test sheet, photo evidence…" />
        </FormField>
      </div>

      <FormField label="Inspector Comment">
        <textarea className="ws-input" rows={2} value={inspectorComment} onChange={e => setInspectorComment(e.target.value)} onBlur={() => saveItem()} placeholder="Observed condition, discrepancy, or note…" />
      </FormField>

      {(result === 'Non-Compliant' || result === 'Observation') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="ws-action-btn primary" onClick={() => onCreateFinding?.(item)} disabled={saving}>
            Create Finding
          </button>
        </div>
      )}
    </div>
  );
}

function CampaignCreateModal({ siteId, initialData = null, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    siteId: initialData?.siteId || siteId || '',
    name: initialData?.name || '',
    inspectionType: initialData?.inspectionType || 'Self',
    facilityArea: initialData?.facilityArea || '',
    standard: initialData?.standard || 'NISPOM',
    leadInspector: initialData?.leadInspector || '',
    startDate: initialData?.startDate ? String(initialData.startDate).slice(0, 10) : '',
    targetDate: initialData?.targetDate ? String(initialData.targetDate).slice(0, 10) : '',
    notes: initialData?.notes || '',
    status: initialData?.status || 'Draft',
    overallRating: initialData?.overallRating || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isEditing = Boolean(initialData?.id);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.siteId || !form.name.trim()) {
      alert('Site and inspection name are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        inspectionType: form.inspectionType,
        facilityArea: form.facilityArea,
        standard: form.standard,
        leadInspector: form.leadInspector,
        startDate: form.startDate || null,
        targetDate: form.targetDate || null,
        notes: form.notes,
        status: form.status,
        overallRating: form.overallRating || null,
        ...(isEditing ? {} : { siteId: form.siteId }),
      };
      const result = await api(isEditing ? `/api/inspection-campaigns/${initialData.id}` : '/api/inspection-campaigns', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!result || result._apiError) {
        alert(result?.message || `Failed to ${isEditing ? 'update' : 'create'} inspection campaign`);
        return;
      }
      onSaved(result);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialData?.id) return;
    if (!window.confirm(`Delete inspection campaign "${initialData.name}"?`)) return;
    setDeleting(true);
    try {
      const result = await api(`/api/inspection-campaigns/${initialData.id}`, {
        method: 'DELETE',
      });
      if (!result || result._apiError) {
        alert(result?.message || 'Failed to delete inspection campaign');
        return;
      }
      onDeleted?.(initialData.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ ...modalShellStyle, zIndex: 200 }}>
      <div className="ws-card" style={{ width: 'min(760px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <h3>{isEditing ? 'Edit Inspection Campaign' : 'Add Inspection Campaign'}</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Site">
                <input className="ws-input" value={form.siteId} readOnly />
              </FormField>
              <FormField label="Inspection Type">
                <select className="ws-input" value={form.inspectionType} onChange={e => set('inspectionType', e.target.value)}>
                  {INSPECTION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </FormField>
              <FormField label="Inspection Name *">
                <input className="ws-input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Physical Security Review - Q3" />
              </FormField>
              <FormField label="Standard">
                <select className="ws-input" value={form.standard} onChange={e => set('standard', e.target.value)}>
                  {STANDARDS.map(std => <option key={std} value={std}>{std}</option>)}
                </select>
              </FormField>
              <FormField label="Facility / Area">
                <input className="ws-input" value={form.facilityArea} onChange={e => set('facilityArea', e.target.value)} placeholder="Vault, SCIF, Front Entrance" />
              </FormField>
              <FormField label="Lead Inspector">
                <input className="ws-input" value={form.leadInspector} onChange={e => set('leadInspector', e.target.value)} placeholder="Inspector name" />
              </FormField>
              <FormField label="Start Date">
                <input className="ws-input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
              </FormField>
              <FormField label="Target Date">
                <input className="ws-input" type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
              </FormField>
              <FormField label="Status">
                <select className="ws-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {['Draft', 'Planned', 'In Progress', 'Completed', 'Closed'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </FormField>
              <FormField label="Overall Rating">
                <select className="ws-input" value={form.overallRating} onChange={e => set('overallRating', e.target.value)}>
                  <option value="">Pending</option>
                  {['Compliant', 'Marginal', 'Unsatisfactory', 'Observation Only'].map(rating => <option key={rating} value={rating}>{rating}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea className="ws-input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Scope, objectives, or prep notes" />
            </FormField>
          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            {isEditing && (
              <button type="button" className="ws-action-btn" style={{ borderColor: 'var(--red-border)', color: 'var(--red)' }} onClick={handleDelete} disabled={deleting || saving}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
            <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ws-action-btn primary" disabled={saving || deleting}>{saving ? (isEditing ? 'Saving…' : 'Creating…') : (isEditing ? 'Save Changes' : 'Create Campaign')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InspectionCard({ campaign, summary, onSelect }) {
  const openFindings = summary?.openFindings || 0;
  const totalItems = summary?.totalItems || 0;
  const reviewedItems = summary?.reviewedItems || 0;
  const progress = totalItems > 0 ? Math.round((reviewedItems / totalItems) * 100) : 0;

  return (
    <div className="ws-card" style={{ cursor: 'pointer' }} onClick={() => onSelect(campaign.id)}>
      <div className="ws-card-header">
        <div>
          <h3>{campaign.name}</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            {campaign.inspectionType || 'Inspection'}{campaign.facilityArea ? ` · ${campaign.facilityArea}` : ''}{campaign.leadInspector ? ` · ${campaign.leadInspector}` : ''}
          </div>
        </div>
        <span className={`badge ${statusBadge(campaign.status)}`}>{campaign.status}</span>
      </div>
      <div className="ws-card-body">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <ProgressBar value={progress} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Standard</div>
              <div style={{ fontWeight: 600 }}>{campaign.standard || '—'}</div>
            </div>
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Checklist</div>
              <div style={{ fontWeight: 600 }}>{reviewedItems} / {totalItems} reviewed</div>
            </div>
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Findings</div>
              <div style={{ fontWeight: 600, color: openFindings > 0 ? 'var(--red-val)' : 'var(--green)' }}>
                {openFindings} open
              </div>
            </div>
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target</div>
              <div style={{ fontWeight: 600 }}>{fmtInspectionDate(campaign.targetDate)}</div>
            </div>
          </div>
        </div>
        {campaign.notes && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-2)', background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.5rem 0.65rem' }}>
            {campaign.notes}
          </div>
        )}
        {campaign.templateName && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
            Template: {campaign.templateName}
          </div>
        )}
      </div>
    </div>
  );
}

function InspectionDetail({ detail, onClose, onEdit, onRefresh }) {
  const [localCampaign, setLocalCampaign] = useState(detail?.campaign || null);
  const [localSummary, setLocalSummary] = useState(detail?.summary || {});
  const [findingItem, setFindingItem] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  useEffect(() => {
    setLocalCampaign(detail?.campaign || null);
    setLocalSummary(detail?.summary || {});
  }, [detail]);
  const campaign = localCampaign;
  const summary = localSummary || {};
  if (!campaign) return null;
  const isDcsaAligned = (campaign.templateName || '').includes('DCSA Self-Inspection Handbook');

  function handleInlineItemUpdated(payload) {
    if (payload?.campaign) {
      setLocalCampaign(current => mergeCampaignItemUpdate(current, payload));
    }
    if (payload?.summary) {
      setLocalSummary(payload.summary);
    }
  }

  async function handleBootstrapChecklist() {
    setBootstrapping(true);
    try {
      const result = await api(`/api/inspection-campaigns/${campaign.id}/bootstrap`, {
        method: 'POST',
      });
      if (!result || result._apiError) {
        alert(result?.message || 'Failed to attach baseline checklist');
        return;
      }
      onRefresh?.();
    } finally {
      setBootstrapping(false);
    }
  }

  return (
    <div style={{ ...modalShellStyle, zIndex: 150 }}>
      <div className="ws-card" style={{ width: 'min(1120px, 100%)', maxHeight: 'calc(100vh - 4rem)', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <h3>{campaign.name}</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
              {campaign.inspectionType || 'Inspection'}{campaign.facilityArea ? ` · ${campaign.facilityArea}` : ''}{campaign.leadInspector ? ` · ${campaign.leadInspector}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className={`badge ${statusBadge(campaign.status)}`}>{campaign.status}</span>
            <button type="button" className="ws-action-btn" onClick={() => onEdit(campaign)}>Edit</button>
            <button type="button" className="ws-action-btn" onClick={onClose}>Close</button>
          </div>
        </div>
        {findingItem && (
          <FindingModal
            campaignId={campaign.id}
            item={findingItem}
            onClose={() => setFindingItem(null)}
            onSaved={() => {
              setFindingItem(null);
              onRefresh?.();
            }}
          />
        )}
        {selectedFinding && (
          <FindingDetailModal
            finding={selectedFinding}
            onClose={() => setSelectedFinding(null)}
            onSaved={() => {
              setSelectedFinding(null);
              onRefresh?.();
            }}
          />
        )}
        <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="ws-grid-3" style={{ gap: '0.75rem' }}>
            {[
              { label: 'Standard', value: campaign.standard },
              { label: 'Lead Inspector', value: campaign.leadInspector },
              { label: 'Overall Rating', value: campaign.overallRating || 'Pending' },
              { label: 'Start Date', value: fmtInspectionDate(campaign.startDate) },
              { label: 'Target Date', value: fmtInspectionDate(campaign.targetDate) },
              { label: 'Completed', value: fmtInspectionDate(campaign.completedAt) },
              { label: 'Sections', value: (campaign.sections || []).length },
              { label: 'Reviewed Items', value: `${summary.reviewedItems || 0} / ${summary.totalItems || 0}` },
              { label: 'Open Findings', value: summary.openFindings || 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.5rem 0.65rem' }}>
                <div style={{ font: '500 0.65rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{label}</div>
                <div style={{ font: '600 0.8rem Inter, sans-serif', color: 'var(--text)', marginTop: '0.15rem' }}>{value || '—'}</div>
              </div>
            ))}
          </div>

          {campaign.notes && (
            <div>
              <div className="ws-section-label">Notes</div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-2)', margin: '0.35rem 0 0', lineHeight: 1.6 }}>{campaign.notes}</p>
            </div>
          )}

          <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: '0.5rem', padding: '0.75rem 0.9rem', color: 'var(--text)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--amber)' }}>
              Checklist Source
            </div>
            <div style={{ marginTop: '0.3rem', fontSize: '0.82rem', lineHeight: 1.55 }}>
              {isDcsaAligned ? (
                <>
                  This campaign uses a <strong>DCSA Self-Inspection Handbook aligned template</strong> based on the published DCSA handbook structure for NISP contractors. It is adapted into Sentinel’s workflow and should be treated as a <strong>system implementation of the handbook</strong>, not a verbatim official government form package.
                </>
              ) : (
                <>
                  This campaign currently uses the <strong>Sentinel built-in baseline checklist</strong>. It is a pre-filled internal starter aligned to your workflow and references like NISPOM / ICD 705, but it is <strong>not an official DCSA self-inspection checklist package</strong>.
                </>
              )}
            </div>
          </div>

          <div>
            <div className="ws-section-label">Checklist Sections</div>
            {(campaign.sections || []).length === 0 ? (
              <div className="ws-empty" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'center' }}>
                <div>No checklist sections have been attached yet.</div>
                <button type="button" className="ws-action-btn primary" onClick={handleBootstrapChecklist} disabled={bootstrapping}>
                  {bootstrapping ? 'Attaching…' : 'Attach Baseline Checklist'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                {campaign.sections.map(section => (
                  <div key={section.id} style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{section.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                          {(section.items || []).length} checklist item{(section.items || []).length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span className={`badge ${statusBadge(section.status)}`}>{section.status}</span>
                        {section.scorePercent != null && <span className="badge badge-blue">{section.scorePercent}%</span>}
                      </div>
                    </div>
                    {(section.items || []).length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        {section.items.map(item => (
                          <ChecklistItemRow
                            key={item.id}
                            campaignId={campaign.id}
                            item={item}
                            onUpdated={handleInlineItemUpdated}
                            onCreateFinding={setFindingItem}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="ws-section-label">Findings</div>
            {(campaign.findings || []).length === 0 ? (
              <div className="ws-empty" style={{ marginTop: '0.5rem' }}>No findings recorded yet.</div>
            ) : (
              <div className="ws-table-wrap" style={{ marginTop: '0.5rem' }}>
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Owner</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.findings.map(finding => (
                      <tr key={finding.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedFinding(finding)}>
                        <td>
                          <strong>{finding.title}</strong>
                          {finding.requirementRef && <div className="cell-muted">{finding.requirementRef}</div>}
                        </td>
                        <td><span className={`badge ${sevBadge(finding.severity)}`}>{finding.severity}</span></td>
                        <td className="cell-muted">{finding.responsibleUser || finding.responsibleOrg || '—'}</td>
                        <td className="cell-muted">{fmtDate(finding.dueDate)}</td>
                        <td><span className={`badge ${statusBadge(finding.status)}`}>{finding.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InspectionsPage({ siteId, user }) {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignDetails, setCampaignDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('campaigns');
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [showSiteWarning, setShowSiteWarning] = useState(false);

  const requiresSiteSelection = Boolean(user?.canSeeAllSites || (user?.siteIds?.length > 1));
  const readSiteId = siteId || (!requiresSiteSelection ? (user?.primarySiteId || user?.siteIds?.[0] || '') : '');
  const createSiteId = siteId || user?.primarySiteId || user?.siteIds?.[0] || '';

  async function load() {
    setLoading(true);
    setLoadError(null);
    const qs = new URLSearchParams(readSiteId ? { siteId: readSiteId } : {}).toString();
    const list = await api(`/api/inspection-campaigns${qs ? `?${qs}` : ''}`);
    if (!list || list._apiError) {
      setLoadError(list?.message || 'Failed to load inspection campaigns');
      setLoading(false);
      return;
    }
    setCampaigns(Array.isArray(list) ? list : []);
    const detailsEntries = await Promise.all(
      (Array.isArray(list) ? list : []).map(async (campaign) => {
        const detail = await api(`/api/inspection-campaigns/${campaign.id}`);
        return [campaign.id, detail && !detail._apiError ? detail : null];
      })
    );
    setCampaignDetails(Object.fromEntries(detailsEntries.filter(([, detail]) => detail)));
    setLoading(false);
  }

  useEffect(() => { load(); }, [readSiteId]);

  function handleAddInspectionClick() {
    if (requiresSiteSelection && !siteId) {
      setShowSiteWarning(true);
      return;
    }
    setAdding(true);
  }

  function handleSaved(campaign) {
    setAdding(false);
    setEditingCampaign(null);
    load().then(() => setSelectedCampaignId(campaign.id));
  }

  function handleDeleted(deletedId) {
    setEditingCampaign(null);
    setSelectedCampaignId(current => (current === deletedId ? null : current));
    load();
  }

  const selectedDetail = selectedCampaignId ? campaignDetails[selectedCampaignId] : null;
  const findings = Object.values(campaignDetails).flatMap(detail => detail?.campaign?.findings || []);
  const openFindings = findings.filter(f => f.status !== 'Closed');
  const highFindings = openFindings.filter(f => f.severity === 'High' || f.severity === 'Critical');
  const inProgressCount = campaigns.filter(c => c.status === 'In Progress').length;

  if (loading) return <div className="ws-empty">Loading inspection data…</div>;
  if (loadError) return <div className="ws-empty">Failed to load inspection data: {loadError}</div>;

  return (
    <div className="ws-page">
      {showSiteWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg-strong)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="ws-card" style={{ width: 'min(420px, 100%)' }}>
            <div className="ws-card-header"><h3>⚠️ Site Required</h3></div>
            <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Please select a site from the dropdown menu at the top before creating an inspection campaign.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="ws-action-btn primary" onClick={() => setShowSiteWarning(false)}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {adding && <CampaignCreateModal siteId={createSiteId} onClose={() => setAdding(false)} onSaved={handleSaved} />}
      {editingCampaign && (
        <CampaignCreateModal
          siteId={editingCampaign.siteId}
          initialData={editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
      {selectedDetail && (
        <InspectionDetail
          detail={selectedDetail}
          onClose={() => setSelectedCampaignId(null)}
          onEdit={campaign => setEditingCampaign(campaign)}
          onRefresh={load}
        />
      )}

      <div className="ws-page-header">
        <div>
          <div className="ws-page-title">Self-Inspection &amp; Compliance Operations</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {highFindings.length > 0 && <span className="ws-count-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red-border)' }}>{highFindings.length} high findings</span>}
          {openFindings.length > 0 && <span className="ws-count-badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: 'var(--amber-border)' }}>{openFindings.length} open findings</span>}
          <span className="ws-count-badge">{inProgressCount} in progress</span>
          <button className="ws-action-btn primary" onClick={handleAddInspectionClick}>+ Add Inspection Campaign</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'campaigns', label: `Inspection Campaigns (${campaigns.length})` },
          { id: 'findings', label: `Findings (${findings.length})` },
        ].map(entry => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            style={{
              padding: '0.55rem 1rem',
              border: 'none',
              background: 'transparent',
              font: '500 0.82rem Inter, sans-serif',
              cursor: 'pointer',
              color: tab === entry.id ? 'var(--primary)' : 'var(--muted)',
              borderBottom: tab === entry.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {campaigns.length === 0 ? (
            <div className="ws-empty">No inspection campaigns found.</div>
          ) : (
            campaigns.map(campaign => (
              <InspectionCard
                key={campaign.id}
                campaign={campaign}
                summary={campaignDetails[campaign.id]?.summary}
                onSelect={setSelectedCampaignId}
              />
            ))
          )}
        </div>
      )}

      {tab === 'findings' && (
        <div className="ws-card">
          <div className="ws-card-header">
            <h3>Findings Register</h3>
          </div>
          <div className="ws-card-body" style={{ padding: 0 }}>
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Requirement</th>
                    <th>Severity</th>
                    <th>Owner</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.length === 0 ? (
                    <tr><td colSpan={6}><div className="ws-empty">No findings recorded yet.</div></td></tr>
                  ) : findings.map(finding => (
                    <tr key={finding.id}>
                      <td>
                        <strong>{finding.title}</strong>
                        {finding.description && <div className="cell-muted">{finding.description}</div>}
                      </td>
                      <td className="cell-muted">{finding.requirementRef || '—'}</td>
                      <td><span className={`badge ${sevBadge(finding.severity)}`}>{finding.severity}</span></td>
                      <td className="cell-muted">{finding.responsibleUser || finding.responsibleOrg || '—'}</td>
                      <td className="cell-muted">{fmtDate(finding.dueDate)}</td>
                      <td><span className={`badge ${statusBadge(finding.status)}`}>{finding.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
