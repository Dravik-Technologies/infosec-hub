import { useState, useEffect } from 'react';
import { WS, fmtDate, fmtShort, daysUntil, statusBadge, uid, AUTH } from '../app.js';

const MEDIA_TYPES = ['USB Drive', 'External HDD', 'CD/DVD', 'Laptop', 'Tablet', 'Hard Drive', 'Flash Card', 'Tape', 'Other'];
const STATUS_OPTIONS = ['Available', 'Assigned', 'Overdue Return', 'Pending Destruction', 'In Transfer', 'Destroyed', 'Lost'];
const CLASS_OPTIONS = ['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'SECRET // NOFORN', 'TOP SECRET', 'TOP SECRET // SCI'];

const STATUS_TONE = {
  'Assigned': 'badge-blue',
  'Available': 'badge-green',
  'Overdue Return': 'badge-red',
  'Pending Destruction': 'badge-amber',
  'In Transfer': 'badge-amber',
  'Destroyed': 'badge-gray',
  'Lost': 'badge-red',
};

const CLASS_BADGE = {
  'TOP SECRET // SCI': 'badge-red',
  'TOP SECRET': 'badge-red',
  'SECRET // NOFORN': 'badge-purple',
  'SECRET': 'badge-purple',
  'CONFIDENTIAL': 'badge-amber',
};

function classBadge(cls) { return CLASS_BADGE[cls] || 'badge-gray'; }

function isReturnOverdue(item) {
  if (item.status !== 'Assigned' && item.status !== 'Overdue Return') return false;
  if (!item.returnDue) return false;
  return new Date(item.returnDue + 'T12:00:00Z') < new Date();
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ font: '500 0.72rem Inter, sans-serif', color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}

function MediaForm({ item, siteId, onSave, onClose }) {
  const isEdit = !!item;
  const blank = {
    mediaId: '', type: 'USB Drive', classification: 'UNCLASSIFIED', label: '',
    program: '', assignedTo: '', currentLocation: '', associatedSystem: '',
    status: 'Available', returnDue: '', make: '', model: '', serialNumber: '',
    capacityGB: '', notes: '', siteId: siteId || '',
  };
  const [form, setForm] = useState(isEdit ? {
    ...blank,
    mediaId: item.mediaId || '',
    type: item.type || 'USB Drive',
    classification: item.classification || 'UNCLASSIFIED',
    label: item.label || '',
    program: item.program || '',
    assignedTo: item.assignedTo || '',
    currentLocation: item.currentLocation || item.location || '',
    associatedSystem: item.associatedSystem || item.system || '',
    status: item.status || 'Available',
    returnDue: item.returnDue || '',
    make: item.make || '',
    model: item.model || '',
    serialNumber: item.serialNumber || '',
    capacityGB: item.capacityGB ?? '',
    notes: item.notes || '',
    siteId: item.siteId || siteId || '',
  } : blank);

  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, capacityGB: form.capacityGB === '' ? null : Number(form.capacityGB), location: form.currentLocation, system: form.associatedSystem };
    if (isEdit) {
      await WS.patch('media_control', item.id, payload);
    } else {
      await WS.post('media_control', { ...payload, id: uid(), history: [], flags: [] });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(680px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <h3>{isEdit ? 'Edit Media Item' : 'Register Media'}</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div className="ws-section-label">Media Identity</div>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Media ID *">
                <input className="ws-input" required value={form.mediaId} onChange={e => set('mediaId', e.target.value)} placeholder="e.g. USB-001" />
              </FormField>
              <FormField label="Type">
                <select className="ws-input" value={form.type} onChange={e => set('type', e.target.value)}>
                  {MEDIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Classification">
                <select className="ws-input" value={form.classification} onChange={e => set('classification', e.target.value)}>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Label / Marking">
                <input className="ws-input" value={form.label} onChange={e => set('label', e.target.value)} placeholder="Physical label text" />
              </FormField>
              <FormField label="Make">
                <input className="ws-input" value={form.make} onChange={e => set('make', e.target.value)} placeholder="Manufacturer" />
              </FormField>
              <FormField label="Model">
                <input className="ws-input" value={form.model} onChange={e => set('model', e.target.value)} placeholder="Model" />
              </FormField>
              <FormField label="Serial Number">
                <input className="ws-input" value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} placeholder="Device serial #" />
              </FormField>
              <FormField label="Capacity (GB)">
                <input className="ws-input" type="number" min="0" value={form.capacityGB} onChange={e => set('capacityGB', e.target.value)} placeholder="Optional" />
              </FormField>
            </div>

            <div className="ws-section-label">Assignment & Status</div>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Program">
                <input className="ws-input" value={form.program} onChange={e => set('program', e.target.value)} placeholder="Program name" />
              </FormField>
              <FormField label="Status">
                <select className="ws-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Assigned To">
                <input className="ws-input" value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} placeholder="Person / system" />
              </FormField>
              <FormField label="Return Due">
                <input className="ws-input" type="date" value={form.returnDue} onChange={e => set('returnDue', e.target.value)} />
              </FormField>
              <FormField label="Current Location">
                <input className="ws-input" value={form.currentLocation} onChange={e => set('currentLocation', e.target.value)} placeholder="Safe, room, container" />
              </FormField>
              <FormField label="Associated System">
                <input className="ws-input" value={form.associatedSystem} onChange={e => set('associatedSystem', e.target.value)} placeholder="IS name" />
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea className="ws-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes" />
            </FormField>

          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ws-action-btn primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Register Media'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MediaDetail({ item, onClose, onEdit, onSubSaved }) {
  const [subPanel, setSubPanel] = useState(null);
  const [subForm, setSubForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function setSF(k, v) { setSubForm(f => ({ ...f, [k]: v })); }
  function openPanel(p) { setSubPanel(p === subPanel ? null : p); setSubForm({}); }

  async function savePanel() {
    setSaving(true);
    const user = AUTH.getUser();
    const by = user?.name || user?.email || 'Unknown';
    const now = new Date().toISOString().slice(0, 10);

    let patch = {};
    const entry = { date: subForm.date || now, by: subForm.by || by, notes: subForm.notes };

    if (subPanel === 'issue') {
      patch = {
        status: 'Assigned',
        assignedTo: subForm.assignedTo,
        returnDue: subForm.returnDue,
        history: [...(item.history || []), { action: 'Issued', ...entry, to: subForm.assignedTo, returnDue: subForm.returnDue }],
      };
    } else if (subPanel === 'return') {
      patch = {
        status: 'Available',
        assignedTo: '',
        returnDue: '',
        history: [...(item.history || []), { action: 'Returned', ...entry, from: subForm.from || item.assignedTo }],
      };
    } else if (subPanel === 'transfer') {
      patch = {
        status: 'In Transfer',
        currentLocation: subForm.newLocation || item.currentLocation,
        location: subForm.newLocation || item.currentLocation,
        history: [...(item.history || []), { action: 'Transfer', ...entry, to: subForm.transferTo, newLocation: subForm.newLocation }],
      };
    } else if (subPanel === 'pendingDestruction') {
      patch = {
        status: 'Pending Destruction',
        destructionScheduled: subForm.scheduledDate,
        destructionMethod: subForm.method,
        history: [...(item.history || []), { action: 'Marked for Destruction', ...entry, scheduledDate: subForm.scheduledDate, method: subForm.method }],
      };
    } else if (subPanel === 'destruction') {
      patch = {
        status: 'Destroyed',
        destructionScheduled: null,
        history: [...(item.history || []), {
          action: 'Destroyed', ...entry,
          method: subForm.method, witness: subForm.witness, certNum: subForm.certNum,
        }],
      };
    }

    await WS.patch('media_control', item.id, patch);
    setSaving(false);
    setSubPanel(null);
    onSubSaved(item.id);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this media record? This cannot be undone.')) return;
    setDeleting(true);
    await WS.del('media_control', item.id);
    setDeleting(false);
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(740px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <h3>{item.mediaId}</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.type} · {item.classification}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className={`badge ${STATUS_TONE[item.status] || 'badge-gray'}`}>{item.status}</span>
            <button type="button" className="ws-action-btn primary" onClick={onEdit}>Edit</button>
            <button type="button" className="ws-action-btn" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="ws-grid-3" style={{ gap: '0.75rem' }}>
            {[
              { label: 'Type', value: item.type },
              { label: 'Classification', value: item.classification },
              { label: 'Program', value: item.program },
              { label: 'Make / Model', value: [item.make, item.model].filter(Boolean).join(' ') || '—' },
              { label: 'Serial Number', value: item.serialNumber },
              { label: 'Capacity', value: item.capacityGB ? `${item.capacityGB} GB` : '—' },
              { label: 'Assigned To', value: item.assignedTo },
              { label: 'Return Due', value: fmtDate(item.returnDue) },
              { label: 'Location', value: item.currentLocation || item.location },
              { label: 'Associated System', value: item.associatedSystem || item.system },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.5rem 0.65rem' }}>
                <div style={{ font: '500 0.65rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{label}</div>
                <div style={{ font: '600 0.8rem Inter, sans-serif', color: 'var(--text)', marginTop: '0.15rem' }}>{value || '—'}</div>
              </div>
            ))}
          </div>

          {(item.flags || []).length > 0 && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '0.375rem', padding: '0.5rem 0.75rem' }}>
              {item.flags.map((f, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--red)', fontWeight: 600 }}>⚠ {f}</div>
              ))}
            </div>
          )}

          {item.destructionScheduled && (
            <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--amber)' }}>
              <strong>Destruction Scheduled: </strong>{fmtDate(item.destructionScheduled)}
              {item.destructionMethod && <span style={{ marginLeft: '0.5rem' }}>— Method: {item.destructionMethod}</span>}
            </div>
          )}

          {/* Lifecycle action toolbar */}
          <div>
            <div className="ws-section-label">Lifecycle Actions</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button type="button" className={`ws-action-btn${subPanel === 'issue' ? ' primary' : ''}`} onClick={() => openPanel('issue')}>Issue</button>
              <button type="button" className={`ws-action-btn${subPanel === 'return' ? ' primary' : ''}`} onClick={() => openPanel('return')}>Return</button>
              <button type="button" className={`ws-action-btn${subPanel === 'transfer' ? ' primary' : ''}`} onClick={() => openPanel('transfer')}>Transfer</button>
              <button type="button" className={`ws-action-btn${subPanel === 'pendingDestruction' ? ' primary' : ''}`} onClick={() => openPanel('pendingDestruction')}>Mark for Destruction</button>
              <button type="button" className={`ws-action-btn${subPanel === 'destruction' ? ' primary' : ''}`} onClick={() => openPanel('destruction')} style={{ color: 'var(--red)' }}>Record Destruction</button>
            </div>
          </div>

          {subPanel === 'issue' && (
            <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
              <div className="ws-section-label" style={{ marginBottom: '0.75rem' }}>Issue Media</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Issue Date">
                  <input className="ws-input" type="date" value={subForm.date || ''} onChange={e => setSF('date', e.target.value)} />
                </FormField>
                <FormField label="Issued To">
                  <input className="ws-input" value={subForm.assignedTo || ''} onChange={e => setSF('assignedTo', e.target.value)} placeholder="Person / system" />
                </FormField>
                <FormField label="Return Due">
                  <input className="ws-input" type="date" value={subForm.returnDue || ''} onChange={e => setSF('returnDue', e.target.value)} />
                </FormField>
                <FormField label="Issued By">
                  <input className="ws-input" value={subForm.by || ''} onChange={e => setSF('by', e.target.value)} placeholder="Your name" />
                </FormField>
                <FormField label="Notes">
                  <input className="ws-input" value={subForm.notes || ''} onChange={e => setSF('notes', e.target.value)} />
                </FormField>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn primary" disabled={saving} onClick={savePanel}>{saving ? 'Saving…' : 'Issue Media'}</button>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
              </div>
            </div>
          )}

          {subPanel === 'return' && (
            <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
              <div className="ws-section-label" style={{ marginBottom: '0.75rem' }}>Record Return</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Return Date">
                  <input className="ws-input" type="date" value={subForm.date || ''} onChange={e => setSF('date', e.target.value)} />
                </FormField>
                <FormField label="Returned By">
                  <input className="ws-input" value={subForm.from || item.assignedTo || ''} onChange={e => setSF('from', e.target.value)} placeholder="Person returning" />
                </FormField>
                <FormField label="Received By">
                  <input className="ws-input" value={subForm.by || ''} onChange={e => setSF('by', e.target.value)} placeholder="Your name" />
                </FormField>
                <FormField label="Notes">
                  <input className="ws-input" value={subForm.notes || ''} onChange={e => setSF('notes', e.target.value)} />
                </FormField>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn primary" disabled={saving} onClick={savePanel}>{saving ? 'Saving…' : 'Record Return'}</button>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
              </div>
            </div>
          )}

          {subPanel === 'transfer' && (
            <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
              <div className="ws-section-label" style={{ marginBottom: '0.75rem' }}>Transfer Media</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Transfer Date">
                  <input className="ws-input" type="date" value={subForm.date || ''} onChange={e => setSF('date', e.target.value)} />
                </FormField>
                <FormField label="Transfer To">
                  <input className="ws-input" value={subForm.transferTo || ''} onChange={e => setSF('transferTo', e.target.value)} placeholder="Destination / org" />
                </FormField>
                <FormField label="New Location">
                  <input className="ws-input" value={subForm.newLocation || ''} onChange={e => setSF('newLocation', e.target.value)} placeholder="New physical location" />
                </FormField>
                <FormField label="Authorized By">
                  <input className="ws-input" value={subForm.by || ''} onChange={e => setSF('by', e.target.value)} placeholder="Your name" />
                </FormField>
                <FormField label="Notes">
                  <input className="ws-input" value={subForm.notes || ''} onChange={e => setSF('notes', e.target.value)} />
                </FormField>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn primary" disabled={saving} onClick={savePanel}>{saving ? 'Saving…' : 'Record Transfer'}</button>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
              </div>
            </div>
          )}

          {subPanel === 'pendingDestruction' && (
            <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: '0.5rem', padding: '1rem' }}>
              <div className="ws-section-label" style={{ marginBottom: '0.75rem', color: 'var(--amber)' }}>Mark for Destruction</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Scheduled Date">
                  <input className="ws-input" type="date" value={subForm.scheduledDate || ''} onChange={e => setSF('scheduledDate', e.target.value)} />
                </FormField>
                <FormField label="Destruction Method">
                  <select className="ws-input" value={subForm.method || ''} onChange={e => setSF('method', e.target.value)}>
                    <option value="">Select method</option>
                    <option value="Degauss">Degauss</option>
                    <option value="Physical Destruction">Physical Destruction</option>
                    <option value="Shredding">Shredding</option>
                    <option value="Overwrite + Verify">Overwrite + Verify</option>
                    <option value="Incineration">Incineration</option>
                    <option value="Other">Other</option>
                  </select>
                </FormField>
                <FormField label="Authorized By">
                  <input className="ws-input" value={subForm.by || ''} onChange={e => setSF('by', e.target.value)} placeholder="Your name" />
                </FormField>
                <FormField label="Notes">
                  <input className="ws-input" value={subForm.notes || ''} onChange={e => setSF('notes', e.target.value)} />
                </FormField>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn primary" disabled={saving} onClick={savePanel}>{saving ? 'Saving…' : 'Mark for Destruction'}</button>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
              </div>
            </div>
          )}

          {subPanel === 'destruction' && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '0.5rem', padding: '1rem' }}>
              <div className="ws-section-label" style={{ marginBottom: '0.75rem', color: 'var(--red)' }}>Record Destruction</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Destruction Date">
                  <input className="ws-input" type="date" value={subForm.date || ''} onChange={e => setSF('date', e.target.value)} />
                </FormField>
                <FormField label="Method">
                  <select className="ws-input" value={subForm.method || ''} onChange={e => setSF('method', e.target.value)}>
                    <option value="">Select method</option>
                    <option value="Degauss">Degauss</option>
                    <option value="Physical Destruction">Physical Destruction</option>
                    <option value="Shredding">Shredding</option>
                    <option value="Overwrite + Verify">Overwrite + Verify</option>
                    <option value="Incineration">Incineration</option>
                    <option value="Other">Other</option>
                  </select>
                </FormField>
                <FormField label="Witness">
                  <input className="ws-input" value={subForm.witness || ''} onChange={e => setSF('witness', e.target.value)} placeholder="Witness name" />
                </FormField>
                <FormField label="Certificate Number">
                  <input className="ws-input" value={subForm.certNum || ''} onChange={e => setSF('certNum', e.target.value)} placeholder="Destruction cert #" />
                </FormField>
                <FormField label="Performed By">
                  <input className="ws-input" value={subForm.by || ''} onChange={e => setSF('by', e.target.value)} placeholder="Your name" />
                </FormField>
                <FormField label="Notes">
                  <input className="ws-input" value={subForm.notes || ''} onChange={e => setSF('notes', e.target.value)} />
                </FormField>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn primary" disabled={saving} onClick={savePanel}>{saving ? 'Saving…' : 'Record Destruction'}</button>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Custody history */}
          {(item.history || []).length > 0 && (
            <div>
              <div className="ws-section-label">Custody / Audit History</div>
              <table className="ws-table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Action</th><th>Date</th><th>By</th><th>Notes</th></tr></thead>
                <tbody>
                  {[...item.history].reverse().map((h, i) => (
                    <tr key={i}>
                      <td><span className={`badge ${statusBadge(h.action)}`}>{h.action}</span></td>
                      <td className="cell-muted">{fmtDate(h.date)}</td>
                      <td className="cell-muted">{h.by || '—'}</td>
                      <td className="cell-muted">{h.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={handleDelete} disabled={deleting} style={{ fontSize: '0.75rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {deleting ? 'Deleting…' : 'Delete Media Record'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function MediaPage({ siteId }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  function loadMedia() {
    const params = siteId ? { siteId } : {};
    return WS.get('media_control', params).then(d => {
      if (d?._wsError) { setLoadError(d.message); setLoading(false); return; }
      setLoadError(null);
      setMedia(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }

  useEffect(() => {
    setLoading(true);
    loadMedia();
  }, [siteId]);

  function handleSaved() {
    loadMedia().then(() => { setAdding(false); setEditing(null); });
  }

  function handleSubSaved(itemId) {
    loadMedia().then(d => {
      const list = Array.isArray(d) ? d : media;
      const fresh = list.find(x => x.id === itemId);
      if (fresh) setSelected(fresh);
    });
  }

  function handleEditFromDetail() {
    const it = selected;
    setSelected(null);
    setEditing(it);
  }

  const overdueCount = media.filter(isReturnOverdue).length;
  const pendingDestCount = media.filter(m => m.status === 'Pending Destruction').length;
  const assignedCount = media.filter(m => m.status === 'Assigned').length;
  const flaggedCount = media.filter(m => (m.flags || []).length > 0).length;

  const allTypes = [...new Set(media.map(m => m.type).filter(Boolean))].sort();

  const filtered = media.filter(m => {
    const matchSearch = !search ||
      m.mediaId?.toLowerCase().includes(search.toLowerCase()) ||
      m.type?.toLowerCase().includes(search.toLowerCase()) ||
      m.assignedTo?.toLowerCase().includes(search.toLowerCase()) ||
      m.program?.toLowerCase().includes(search.toLowerCase()) ||
      m.serialNumber?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || m.type === typeFilter;
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchClass = classFilter === 'all' || m.classification === classFilter;
    return matchSearch && matchType && matchStatus && matchClass;
  });

  if (loading) return <div className="ws-empty">Loading media register…</div>;
  if (loadError) return <div className="ws-empty">Failed to load media: {loadError}</div>;

  return (
    <div className="ws-page">
      {adding && <MediaForm siteId={siteId} onSave={handleSaved} onClose={() => setAdding(false)} />}
      {editing && <MediaForm item={editing} siteId={siteId} onSave={handleSaved} onClose={() => setEditing(null)} />}
      {selected && !editing && (
        <MediaDetail
          item={selected}
          onClose={() => setSelected(null)}
          onEdit={handleEditFromDetail}
          onSubSaved={handleSubSaved}
        />
      )}

      <div className="ws-page-header">
        <div>
          <div className="ws-page-title">Media Control</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {overdueCount > 0 && <span className="ws-count-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red-border)' }}>{overdueCount} overdue return</span>}
          {pendingDestCount > 0 && <span className="ws-count-badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: 'var(--amber-border)' }}>{pendingDestCount} pending destruction</span>}
          {flaggedCount > 0 && <span className="ws-count-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red-border)' }}>{flaggedCount} flagged</span>}
          <span className="ws-count-badge">{media.length} total</span>
          <button className="ws-action-btn primary" onClick={() => setAdding(true)}>+ Add Media</button>
        </div>
      </div>

      {/* KPI strip */}
      <section className="ws-kpi-strip">
        <div className="ws-kpi">
          <div className="ws-kpi-label">Total Items</div>
          <div className="ws-kpi-value">{media.length}</div>
          <div className="ws-kpi-hint">In register</div>
        </div>
        <div className="ws-kpi">
          <div className="ws-kpi-label">Assigned</div>
          <div className="ws-kpi-value">{assignedCount}</div>
          <div className="ws-kpi-hint">Currently issued</div>
        </div>
        <div className={`ws-kpi ${overdueCount > 0 ? 'risk' : 'good'}`}>
          <div className="ws-kpi-label">Overdue Returns</div>
          <div className="ws-kpi-value">{overdueCount}</div>
          <div className="ws-kpi-hint">Past return due date</div>
        </div>
        <div className={`ws-kpi ${pendingDestCount > 0 ? 'watch' : ''}`}>
          <div className="ws-kpi-label">Pending Destruction</div>
          <div className="ws-kpi-value">{pendingDestCount}</div>
          <div className="ws-kpi-hint">Awaiting destruction</div>
        </div>
      </section>

      <div className="ws-filter-bar">
        <input className="ws-search" placeholder="Search media ID, type, assignee, program, serial…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="ws-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="ws-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="ws-select" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="all">All Classifications</option>
          {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="ws-card">
        <div className="ws-card-body" style={{ padding: 0 }}>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Media ID</th>
                  <th>Type</th>
                  <th>Label / Class</th>
                  <th>Program</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>System</th>
                  <th>Return Due</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}><div className="ws-empty">No media items match the current filter.</div></td></tr>
                ) : filtered.map(m => {
                  const overdue = isReturnOverdue(m);
                  const hasFlags = (m.flags || []).length > 0;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelected(m)}
                      style={{ cursor: 'pointer', background: hasFlags || overdue ? 'var(--red-bg)' : undefined }}
                    >
                      <td>
                        <strong>{m.mediaId}</strong>
                        {(m.make || m.model) && <div className="cell-muted">{[m.make, m.model].filter(Boolean).join(' ')}</div>}
                      </td>
                      <td className="cell-muted">{m.type}</td>
                      <td>
                        <span className={`badge ${classBadge(m.classification)}`}>{m.label || m.classification}</span>
                      </td>
                      <td className="cell-muted">{m.program || '—'}</td>
                      <td><span className={`badge ${STATUS_TONE[m.status] || 'badge-gray'}`}>{m.status}</span></td>
                      <td className="cell-muted">{m.assignedTo || '—'}</td>
                      <td className="cell-muted">{m.associatedSystem || m.system || '—'}</td>
                      <td>
                        {m.returnDue ? (
                          <div>
                            <div className="cell-muted">{fmtShort(m.returnDue)}</div>
                            {overdue && <span className="badge badge-red">Overdue</span>}
                          </div>
                        ) : <span className="cell-muted">—</span>}
                      </td>
                      <td>
                        {hasFlags ? (
                          <div>{m.flags.map((f, i) => <div key={i}><span className="badge badge-red">{f}</span></div>)}</div>
                        ) : <span className="badge badge-green">OK</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Click any row to view the full custody history and perform lifecycle actions (issue, return, transfer, destruction).</div>
    </div>
  );
}
