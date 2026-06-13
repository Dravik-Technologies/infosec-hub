import { useEffect, useMemo, useState } from 'react';
import { WS, fmtDate, daysUntil, statusBadge, uid } from '../app.js';

const STATUS_OPTIONS = ['Draft', 'Pending Review', 'Active', 'Revision Required', 'Expired', 'Superseded', 'Closed'];
const PRIME_OPTIONS = ['Prime', 'Sub', 'Teaming', 'Other'];
const CLASS_OPTIONS = ['CUI', 'CONFIDENTIAL', 'SECRET', 'SECRET // NOFORN', 'TOP SECRET', 'TOP SECRET // SCI'];

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ font: '500 0.72rem Inter, sans-serif', color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}

function needsAttention(item) {
  return ['draft', 'pending review', 'revision required', 'expired'].includes(String(item.dd254Status || '').toLowerCase());
}

function isExpiringSoon(item) {
  const d = daysUntil(item.expirationDate);
  return d != null && d >= 0 && d <= 30;
}

function isReviewDueSoon(item) {
  const d = daysUntil(item.reviewDueDate);
  return d != null && d >= 0 && d <= 30;
}

function DD254Form({ record, siteId, onSave, onClose }) {
  const isEdit = !!record;
  const [form, setForm] = useState({
    contractNumber: record?.contractNumber || '',
    programName: record?.programName || '',
    customer: record?.customer || '',
    primeOrSub: record?.primeOrSub || 'Prime',
    dd254Status: record?.dd254Status || 'Draft',
    revision: record?.revision || '1',
    effectiveDate: record?.effectiveDate || '',
    expirationDate: record?.expirationDate || '',
    reviewDueDate: record?.reviewDueDate || '',
    classificationLevel: record?.classificationLevel || 'SECRET',
    hasSci: record?.hasSci || false,
    hasSap: record?.hasSap || false,
    cuiRequired: record?.cuiRequired || false,
    governmentActivity: record?.governmentActivity || '',
    owner: record?.owner || '',
    documentLink: record?.documentLink || '',
    securityRequirementsSummary: record?.securityRequirementsSummary || '',
    notes: record?.notes || '',
    siteId: record?.siteId || siteId || '',
  });
  const [saving, setSaving] = useState(false);

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.siteId) {
      alert('Error: Site ID is required. Please select a site and try again.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit) {
        const result = await WS.patch('dd254_register', record.id, payload);
        if (result?._wsError) {
          alert(`Save failed: ${result.message}`);
          setSaving(false);
          return;
        }
      } else {
        const result = await WS.post('dd254_register', { id: uid(), ...payload });
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(760px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <h3>{isEdit ? 'Edit DD254' : 'Add DD254'}</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ws-section-label">Contract Identity</div>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Contract Number *">
                <input className="ws-input" required value={form.contractNumber} onChange={e => set('contractNumber', e.target.value)} />
              </FormField>
              <FormField label="Program Name">
                <input className="ws-input" value={form.programName} onChange={e => set('programName', e.target.value)} />
              </FormField>
              <FormField label="Customer">
                <input className="ws-input" value={form.customer} onChange={e => set('customer', e.target.value)} />
              </FormField>
              <FormField label="Prime / Sub">
                <select className="ws-input" value={form.primeOrSub} onChange={e => set('primeOrSub', e.target.value)}>
                  {PRIME_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="DD254 Status">
                <select className="ws-input" value={form.dd254Status} onChange={e => set('dd254Status', e.target.value)}>
                  {STATUS_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Revision">
                <input className="ws-input" value={form.revision} onChange={e => set('revision', e.target.value)} />
              </FormField>
            </div>

            <div className="ws-section-label">Security Profile</div>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Classification Level">
                <select className="ws-input" value={form.classificationLevel} onChange={e => set('classificationLevel', e.target.value)}>
                  {CLASS_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Government Contracting Activity">
                <input className="ws-input" value={form.governmentActivity} onChange={e => set('governmentActivity', e.target.value)} />
              </FormField>
              <FormField label="Owner / POC">
                <input className="ws-input" value={form.owner} onChange={e => set('owner', e.target.value)} />
              </FormField>
              <FormField label="Document Link">
                <input className="ws-input" value={form.documentLink} onChange={e => set('documentLink', e.target.value)} placeholder="https://..." />
              </FormField>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem' }}><input type="checkbox" checked={form.hasSci} onChange={e => set('hasSci', e.target.checked)} /> SCI required</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem' }}><input type="checkbox" checked={form.hasSap} onChange={e => set('hasSap', e.target.checked)} /> SAP required</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem' }}><input type="checkbox" checked={form.cuiRequired} onChange={e => set('cuiRequired', e.target.checked)} /> CUI handling</label>
            </div>

            <div className="ws-section-label">Dates & Notes</div>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Effective Date">
                <input className="ws-input" type="date" value={form.effectiveDate} onChange={e => set('effectiveDate', e.target.value)} />
              </FormField>
              <FormField label="Expiration Date">
                <input className="ws-input" type="date" value={form.expirationDate} onChange={e => set('expirationDate', e.target.value)} />
              </FormField>
              <FormField label="Review Due Date">
                <input className="ws-input" type="date" value={form.reviewDueDate} onChange={e => set('reviewDueDate', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Security Requirements Summary">
              <textarea className="ws-input" rows={3} value={form.securityRequirementsSummary} onChange={e => set('securityRequirementsSummary', e.target.value)} />
            </FormField>
            <FormField label="Notes">
              <textarea className="ws-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </FormField>
          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ws-action-btn primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add DD254'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DD254Detail({ record, onClose, onEdit, onDelete }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(760px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <h3>{record.contractNumber}</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{record.programName || 'Program not set'}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className={`badge ${statusBadge(record.dd254Status)}`}>{record.dd254Status}</span>
            <button type="button" className="ws-action-btn primary" onClick={onEdit}>Edit</button>
            <button type="button" className="ws-action-btn" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="ws-grid-3" style={{ gap: '0.75rem' }}>
            {[
              ['Customer', record.customer],
              ['Prime / Sub', record.primeOrSub],
              ['Revision', record.revision],
              ['Classification', record.classificationLevel],
              ['Owner', record.owner],
              ['Gov Activity', record.governmentActivity],
              ['Effective', fmtDate(record.effectiveDate)],
              ['Expiration', fmtDate(record.expirationDate)],
              ['Review Due', fmtDate(record.reviewDueDate)],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.5rem 0.65rem' }}>
                <div style={{ font: '500 0.65rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{label}</div>
                <div style={{ font: '600 0.8rem Inter, sans-serif', color: 'var(--text)', marginTop: '0.15rem' }}>{value || '—'}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {record.hasSci && <span className="badge badge-purple">SCI</span>}
            {record.hasSap && <span className="badge badge-red">SAP</span>}
            {record.cuiRequired && <span className="badge badge-blue">CUI</span>}
            {isExpiringSoon(record) && <span className="badge badge-amber">Expiring soon</span>}
            {isReviewDueSoon(record) && <span className="badge badge-amber">Review due</span>}
            {needsAttention(record) && <span className="badge badge-red">Action required</span>}
          </div>

          {record.securityRequirementsSummary && (
            <div>
              <div className="ws-section-label">Security Requirements</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.6 }}>{record.securityRequirementsSummary}</div>
            </div>
          )}

          {record.documentLink && (
            <div>
              <div className="ws-section-label">Document Link</div>
              <a href={record.documentLink} target="_blank" rel="noreferrer" style={{ marginTop: '0.45rem', display: 'inline-block' }}>{record.documentLink}</a>
            </div>
          )}

          {record.notes && (
            <div>
              <div className="ws-section-label">Notes</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.6 }}>{record.notes}</div>
            </div>
          )}

          <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="ws-action-btn danger" onClick={onDelete}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DD254Page({ siteId, user, sites }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showSiteWarning, setShowSiteWarning] = useState(false);

  const requiresSiteSelection = Boolean(user?.canSeeAllSites || (user?.siteIds?.length > 1));
  const readSiteId = siteId || (!requiresSiteSelection ? (user?.primarySiteId || user?.siteIds?.[0] || '') : '');
  const createSiteId = siteId || user?.primarySiteId || user?.siteIds?.[0] || '';

  async function load() {
    setLoading(true);
    const result = await WS.get('dd254_register', readSiteId ? { siteId: readSiteId } : {});
    setRecords(Array.isArray(result) ? result : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [readSiteId]);

  const filtered = useMemo(() => {
    return records.filter(item => {
      const hay = `${item.contractNumber || ''} ${item.programName || ''} ${item.customer || ''} ${item.owner || ''}`.toLowerCase();
      if (search && !hay.includes(search.toLowerCase())) return false;
      if (status !== 'all' && item.dd254Status !== status) return false;
      return true;
    });
  }, [records, search, status]);

  const summary = useMemo(() => ({
    total: records.length,
    active: records.filter(r => String(r.dd254Status).toLowerCase() === 'active').length,
    attention: records.filter(needsAttention).length,
    expiring: records.filter(isExpiringSoon).length,
    reviewDue: records.filter(isReviewDueSoon).length,
  }), [records]);

  async function handleDelete(record) {
    if (!window.confirm(`Delete DD254 ${record.contractNumber}?`)) return;
    await WS.del('dd254_register', record.id);
    setSelected(null);
    load();
  }

  function handleAddDD254Click() {
    if (requiresSiteSelection && !siteId) {
      setShowSiteWarning(true);
      return;
    }
    setEditing({});
  }

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
                Please select a site from the dropdown menu at the top before adding DD254 records. Each record must be assigned to a specific site.
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
      <div className="ws-page-header">
        <div><div className="ws-page-title">DD254 Register</div></div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="ws-hero-tag">{summary.total} contracts tracked</span>
          <span className="ws-count-badge">{summary.attention} attention items</span>
          <button type="button" className="ws-action-btn primary" onClick={handleAddDD254Click}>+ Add DD254</button>
        </div>
      </div>

      <section className="ws-kpi-strip">
        <div className="ws-kpi"><div className="ws-kpi-label">Active</div><div className="ws-kpi-value">{summary.active}</div><div className="ws-kpi-hint">Current DD254s</div></div>
        <div className={`ws-kpi${summary.attention > 0 ? ' risk' : ' good'}`}><div className="ws-kpi-label">Action Required</div><div className="ws-kpi-value">{summary.attention}</div><div className="ws-kpi-hint">Draft, review, revision, expired</div></div>
        <div className={`ws-kpi${summary.expiring > 0 ? ' watch' : ''}`}><div className="ws-kpi-label">Expiring 30d</div><div className="ws-kpi-value">{summary.expiring}</div><div className="ws-kpi-hint">Renewal window</div></div>
        <div className={`ws-kpi${summary.reviewDue > 0 ? ' watch' : ''}`}><div className="ws-kpi-label">Review Due 30d</div><div className="ws-kpi-value">{summary.reviewDue}</div><div className="ws-kpi-hint">Scheduled review actions</div></div>
      </section>

      <div className="ws-card">
        <div className="ws-card-header">
          <h3>Contract Security Register</h3>
          <span>{filtered.length} shown</span>
        </div>
        <div className="ws-card-body">
          <div className="ws-grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
            <input className="ws-input" placeholder="Search contract, program, customer, owner..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="ws-input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="ws-empty">Loading DD254 register…</div>
          ) : filtered.length === 0 ? (
            <div className="ws-empty">No DD254 records match the current filter.</div>
          ) : (
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Program / Customer</th>
                    <th>Status</th>
                    <th>Classification</th>
                    <th>Expiration</th>
                    <th>Review Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} onClick={() => setSelected(item)} style={{ cursor: 'pointer' }}>
                      <td>
                        <strong>{item.contractNumber || '—'}</strong>
                        <div className="cell-muted">Rev {item.revision || '—'} · {item.primeOrSub || '—'}</div>
                      </td>
                      <td>
                        <strong>{item.programName || '—'}</strong>
                        <div className="cell-muted">{item.customer || 'No customer listed'}</div>
                      </td>
                      <td><span className={`badge ${statusBadge(item.dd254Status)}`}>{item.dd254Status}</span></td>
                      <td>
                        <strong>{item.classificationLevel || '—'}</strong>
                        <div className="cell-muted">
                          {[item.hasSci ? 'SCI' : null, item.hasSap ? 'SAP' : null, item.cuiRequired ? 'CUI' : null].filter(Boolean).join(' · ') || 'Standard'}
                        </div>
                      </td>
                      <td>
                        <strong>{fmtDate(item.expirationDate)}</strong>
                        <div className="cell-muted">{isExpiringSoon(item) ? 'Expiring soon' : ' '}</div>
                      </td>
                      <td>
                        <strong>{fmtDate(item.reviewDueDate)}</strong>
                        <div className="cell-muted">{isReviewDueSoon(item) ? 'Review due' : ' '}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <DD254Form
          record={editing.id ? editing : null}
          siteId={createSiteId}
          onSave={() => { setEditing(null); load(); }}
          onClose={() => setEditing(null)}
        />
      )}

      {selected && (
        <DD254Detail
          record={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setSelected(null); }}
          onDelete={() => handleDelete(selected)}
        />
      )}
    </div>
  );
}
