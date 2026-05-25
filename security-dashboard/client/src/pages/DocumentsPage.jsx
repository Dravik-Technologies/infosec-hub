import { useState, useEffect } from 'react';
import { WS, fmtDate, fmtShort, daysUntil, statusBadge, uid, AUTH } from '../app.js';

const CLASS_OPTIONS = ['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'SECRET // NOFORN', 'TOP SECRET', 'TOP SECRET // SCI'];
const STATUS_OPTIONS = ['Active', 'Pending Receipt', 'Issued', 'Dispatched', 'Pending Destruction', 'Destroyed', 'Superseded'];
const DISPATCH_METHODS = ['Hand Carry', 'USPS', 'FedEx', 'DCS', 'JWICS', 'SIPRNet', 'Other'];

const CLASS_BADGE = {
  'TOP SECRET // SCI': 'badge-red',
  'TOP SECRET': 'badge-red',
  'SECRET // NOFORN': 'badge-purple',
  'SECRET': 'badge-purple',
  'CONFIDENTIAL': 'badge-amber',
  'UNCLASSIFIED': 'badge-gray',
};

function classBadge(cls) { return CLASS_BADGE[cls] || 'badge-gray'; }

function isInventoryOverdue(doc) {
  if (!doc.nextInventory) return false;
  return new Date(doc.nextInventory + 'T12:00:00Z') <= new Date();
}

function isInventorySoon(doc) {
  if (!doc.nextInventory) return false;
  const d = daysUntil(doc.nextInventory);
  return d != null && d >= 0 && d <= 30;
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ font: '500 0.72rem Inter, sans-serif', color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}

function DocumentForm({ doc, siteId, onSave, onClose }) {
  const isEdit = !!doc;
  const blank = {
    docNumber: '', title: '', classification: 'UNCLASSIFIED', program: '',
    status: 'Active', custodian: '', currentLocation: '', accountable: false,
    version: '1.0', copyCount: 1, dateReceived: '', nextInventory: '',
    reproductionControls: '', notes: '', siteId: siteId || '',
  };
  const [form, setForm] = useState(isEdit ? {
    ...blank,
    docNumber: doc.docNumber || '',
    title: doc.title || '',
    classification: doc.classification || 'UNCLASSIFIED',
    program: doc.program || '',
    status: doc.status || 'Active',
    custodian: doc.custodian || '',
    currentLocation: doc.currentLocation || '',
    accountable: doc.accountable || false,
    version: doc.version || '1.0',
    copyCount: doc.copyCount ?? 1,
    dateReceived: doc.dateReceived || '',
    nextInventory: doc.nextInventory || '',
    reproductionControls: doc.reproductionControls || '',
    notes: doc.notes || '',
    siteId: doc.siteId || siteId || '',
  } : blank);

  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, copyCount: Number(form.copyCount) };
    if (isEdit) {
      await WS.patch('document_control', doc.id, payload);
    } else {
      await WS.post('document_control', { ...payload, id: uid(), receipts: [], dispatches: [], destructions: [] });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(700px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <h3>{isEdit ? 'Edit Document' : 'Register Document'}</h3>
          <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div className="ws-section-label">Document Identity</div>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Document Number *">
                <input className="ws-input" required value={form.docNumber} onChange={e => set('docNumber', e.target.value)} placeholder="e.g. TS-2024-001" />
              </FormField>
              <FormField label="Classification">
                <select className="ws-input" value={form.classification} onChange={e => set('classification', e.target.value)}>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Title *">
                <input className="ws-input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Document title" />
              </FormField>
              <FormField label="Program">
                <input className="ws-input" value={form.program} onChange={e => set('program', e.target.value)} placeholder="Program name" />
              </FormField>
              <FormField label="Version">
                <input className="ws-input" value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0" />
              </FormField>
              <FormField label="Copy Count">
                <input className="ws-input" type="number" min="0" value={form.copyCount} onChange={e => set('copyCount', e.target.value)} />
              </FormField>
              <FormField label="Status">
                <select className="ws-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Accountable Document">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.4rem' }}>
                  <input type="checkbox" id="accDoc" checked={form.accountable} onChange={e => set('accountable', e.target.checked)} />
                  <label htmlFor="accDoc" style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Requires accountability tracking</label>
                </div>
              </FormField>
            </div>

            <div className="ws-section-label">Custody & Location</div>
            <div className="ws-grid-2" style={{ gap: '0.75rem' }}>
              <FormField label="Custodian">
                <input className="ws-input" value={form.custodian} onChange={e => set('custodian', e.target.value)} placeholder="Document custodian name" />
              </FormField>
              <FormField label="Current Location">
                <input className="ws-input" value={form.currentLocation} onChange={e => set('currentLocation', e.target.value)} placeholder="Safe, vault, container #" />
              </FormField>
              <FormField label="Date Received">
                <input className="ws-input" type="date" value={form.dateReceived} onChange={e => set('dateReceived', e.target.value)} />
              </FormField>
              <FormField label="Next Inventory Date">
                <input className="ws-input" type="date" value={form.nextInventory} onChange={e => set('nextInventory', e.target.value)} />
              </FormField>
            </div>

            <FormField label="Reproduction Controls">
              <input className="ws-input" value={form.reproductionControls} onChange={e => set('reproductionControls', e.target.value)} placeholder="e.g. No reproduction authorized" />
            </FormField>
            <FormField label="Notes">
              <textarea className="ws-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes" />
            </FormField>

          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="ws-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ws-action-btn primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Register Document'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentDetail({ doc, onClose, onEdit, onSubSaved }) {
  const [subPanel, setSubPanel] = useState(null);
  const [subForm, setSubForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function setSF(k, v) { setSubForm(f => ({ ...f, [k]: v })); }

  function openPanel(panel) {
    setSubPanel(panel);
    setSubForm({});
  }

  async function savePanel() {
    setSaving(true);
    const user = AUTH.getUser();
    const by = user?.name || user?.email || 'Unknown';
    const now = new Date().toISOString().slice(0, 10);

    let patch = {};
    if (subPanel === 'receipt') {
      patch = { receipts: [...(doc.receipts || []), { date: subForm.date || now, from: subForm.from, by: subForm.by || by, copyNum: subForm.copyNum, notes: subForm.notes }] };
    } else if (subPanel === 'issue') {
      patch = { custodian: subForm.issuedTo || doc.custodian, status: 'Issued', currentLocation: subForm.location || doc.currentLocation, dispatches: [...(doc.dispatches || []), { date: subForm.date || now, to: subForm.issuedTo, by: subForm.issuedBy || by, method: 'Issue', receiptConfirmed: false, notes: subForm.notes }] };
    } else if (subPanel === 'dispatch') {
      patch = { status: 'Dispatched', dispatches: [...(doc.dispatches || []), { date: subForm.date || now, to: subForm.to, by: subForm.by || by, method: subForm.method, receiptConfirmed: subForm.receiptConfirmed || false, trackingNum: subForm.trackingNum, notes: subForm.notes }] };
    } else if (subPanel === 'destruction') {
      patch = { status: 'Destroyed', destructions: [...(doc.destructions || []), { date: subForm.date || now, method: subForm.method, witness: subForm.witness, certNum: subForm.certNum, by: subForm.by || by, notes: subForm.notes }] };
    }

    await WS.patch('document_control', doc.id, patch);
    setSaving(false);
    setSubPanel(null);
    onSubSaved(doc.id);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this document record? This cannot be undone.')) return;
    setDeleting(true);
    await WS.del('document_control', doc.id);
    setDeleting(false);
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="ws-card" style={{ width: 'min(760px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="ws-card-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <h3>{doc.docNumber}</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{doc.title}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className={`badge ${classBadge(doc.classification)}`}>{doc.classification}</span>
            <span className={`badge ${statusBadge(doc.status)}`}>{doc.status}</span>
            <button type="button" className="ws-action-btn primary" onClick={onEdit}>Edit</button>
            <button type="button" className="ws-action-btn" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="ws-grid-3" style={{ gap: '0.75rem' }}>
            {[
              { label: 'Program', value: doc.program },
              { label: 'Version', value: `v${doc.version}` },
              { label: 'Copy Count', value: String(doc.copyCount) },
              { label: 'Custodian', value: doc.custodian },
              { label: 'Location', value: doc.currentLocation },
              { label: 'Accountable', value: doc.accountable ? 'Yes' : 'No' },
              { label: 'Date Received', value: fmtDate(doc.dateReceived) },
              { label: 'Next Inventory', value: fmtDate(doc.nextInventory) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.5rem 0.65rem' }}>
                <div style={{ font: '500 0.65rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{label}</div>
                <div style={{ font: '600 0.8rem Inter, sans-serif', color: 'var(--text)', marginTop: '0.15rem' }}>{value || '—'}</div>
              </div>
            ))}
          </div>

          {doc.reproductionControls && (
            <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--amber)' }}>
              <strong>Reproduction: </strong>{doc.reproductionControls}
            </div>
          )}

          {isInventoryOverdue(doc) && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--red)' }}>
              <strong>Inventory Overdue</strong> — scheduled {fmtDate(doc.nextInventory)}
            </div>
          )}

          {/* Lifecycle action toolbar */}
          <div>
            <div className="ws-section-label">Lifecycle Actions</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button type="button" className={`ws-action-btn${subPanel === 'receipt' ? ' primary' : ''}`} onClick={() => openPanel(subPanel === 'receipt' ? null : 'receipt')}>Record Receipt</button>
              <button type="button" className={`ws-action-btn${subPanel === 'issue' ? ' primary' : ''}`} onClick={() => openPanel(subPanel === 'issue' ? null : 'issue')}>Issue / Reassign</button>
              <button type="button" className={`ws-action-btn${subPanel === 'dispatch' ? ' primary' : ''}`} onClick={() => openPanel(subPanel === 'dispatch' ? null : 'dispatch')}>Dispatch</button>
              <button type="button" className={`ws-action-btn${subPanel === 'destruction' ? ' primary' : ''}`} onClick={() => openPanel(subPanel === 'destruction' ? null : 'destruction')}>Record Destruction</button>
            </div>
          </div>

          {/* Sub-panels */}
          {subPanel === 'receipt' && (
            <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
              <div className="ws-section-label" style={{ marginBottom: '0.75rem' }}>Record Receipt</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Date Received">
                  <input className="ws-input" type="date" value={subForm.date || ''} onChange={e => setSF('date', e.target.value)} />
                </FormField>
                <FormField label="Copy Number">
                  <input className="ws-input" value={subForm.copyNum || ''} onChange={e => setSF('copyNum', e.target.value)} placeholder="Copy # or serial" />
                </FormField>
                <FormField label="Received From">
                  <input className="ws-input" value={subForm.from || ''} onChange={e => setSF('from', e.target.value)} placeholder="Originator / sender" />
                </FormField>
                <FormField label="Received By">
                  <input className="ws-input" value={subForm.by || ''} onChange={e => setSF('by', e.target.value)} placeholder="Your name" />
                </FormField>
                <FormField label="Notes">
                  <input className="ws-input" value={subForm.notes || ''} onChange={e => setSF('notes', e.target.value)} placeholder="Optional notes" />
                </FormField>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn primary" disabled={saving} onClick={savePanel}>{saving ? 'Saving…' : 'Record Receipt'}</button>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
              </div>
            </div>
          )}

          {subPanel === 'issue' && (
            <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
              <div className="ws-section-label" style={{ marginBottom: '0.75rem' }}>Issue / Reassign Document</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Issue Date">
                  <input className="ws-input" type="date" value={subForm.date || ''} onChange={e => setSF('date', e.target.value)} />
                </FormField>
                <FormField label="Issued To">
                  <input className="ws-input" value={subForm.issuedTo || ''} onChange={e => setSF('issuedTo', e.target.value)} placeholder="Recipient name" />
                </FormField>
                <FormField label="Issued By">
                  <input className="ws-input" value={subForm.issuedBy || ''} onChange={e => setSF('issuedBy', e.target.value)} placeholder="Your name" />
                </FormField>
                <FormField label="New Location">
                  <input className="ws-input" value={subForm.location || ''} onChange={e => setSF('location', e.target.value)} placeholder="Location / container" />
                </FormField>
                <FormField label="Notes">
                  <input className="ws-input" value={subForm.notes || ''} onChange={e => setSF('notes', e.target.value)} />
                </FormField>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn primary" disabled={saving} onClick={savePanel}>{saving ? 'Saving…' : 'Issue Document'}</button>
                <button type="button" className="ws-action-btn" onClick={() => setSubPanel(null)}>Cancel</button>
              </div>
            </div>
          )}

          {subPanel === 'dispatch' && (
            <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
              <div className="ws-section-label" style={{ marginBottom: '0.75rem' }}>Dispatch Document</div>
              <div className="ws-grid-2" style={{ gap: '0.65rem' }}>
                <FormField label="Dispatch Date">
                  <input className="ws-input" type="date" value={subForm.date || ''} onChange={e => setSF('date', e.target.value)} />
                </FormField>
                <FormField label="Dispatched To">
                  <input className="ws-input" value={subForm.to || ''} onChange={e => setSF('to', e.target.value)} placeholder="Recipient / org" />
                </FormField>
                <FormField label="Dispatched By">
                  <input className="ws-input" value={subForm.by || ''} onChange={e => setSF('by', e.target.value)} placeholder="Your name" />
                </FormField>
                <FormField label="Method">
                  <select className="ws-input" value={subForm.method || ''} onChange={e => setSF('method', e.target.value)}>
                    <option value="">Select method</option>
                    {DISPATCH_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </FormField>
                <FormField label="Tracking Number">
                  <input className="ws-input" value={subForm.trackingNum || ''} onChange={e => setSF('trackingNum', e.target.value)} placeholder="Optional" />
                </FormField>
                <FormField label="Receipt Confirmed">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.4rem' }}>
                    <input type="checkbox" id="rcptConf" checked={subForm.receiptConfirmed || false} onChange={e => setSF('receiptConfirmed', e.target.checked)} />
                    <label htmlFor="rcptConf" style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Recipient confirmed receipt</label>
                  </div>
                </FormField>
                <FormField label="Notes">
                  <input className="ws-input" value={subForm.notes || ''} onChange={e => setSF('notes', e.target.value)} />
                </FormField>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ws-action-btn primary" disabled={saving} onClick={savePanel}>{saving ? 'Saving…' : 'Record Dispatch'}</button>
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
                    <option value="Shredding">Shredding</option>
                    <option value="Burning">Burning</option>
                    <option value="Pulping">Pulping</option>
                    <option value="Disintegration">Disintegration</option>
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

          {/* Receipt history */}
          {(doc.receipts || []).length > 0 && (
            <div>
              <div className="ws-section-label">Receipt History</div>
              <table className="ws-table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Date</th><th>From</th><th>Received By</th><th>Copy #</th><th>Notes</th></tr></thead>
                <tbody>
                  {doc.receipts.map((r, i) => (
                    <tr key={i}>
                      <td className="cell-muted">{fmtDate(r.date)}</td>
                      <td className="cell-muted">{r.from || '—'}</td>
                      <td className="cell-muted">{r.by || '—'}</td>
                      <td className="cell-muted">{r.copyNum || '—'}</td>
                      <td className="cell-muted">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dispatch history */}
          {(doc.dispatches || []).length > 0 && (
            <div>
              <div className="ws-section-label">Dispatch / Issue History</div>
              <table className="ws-table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Date</th><th>To</th><th>By</th><th>Method</th><th>Receipt</th></tr></thead>
                <tbody>
                  {doc.dispatches.map((d, i) => (
                    <tr key={i}>
                      <td className="cell-muted">{fmtDate(d.date)}</td>
                      <td className="cell-muted">{d.to || '—'}</td>
                      <td className="cell-muted">{d.by || '—'}</td>
                      <td className="cell-muted">{d.method || '—'}</td>
                      <td>{d.receiptConfirmed ? <span className="badge badge-green">Confirmed</span> : <span className="badge badge-amber">Pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Destruction history */}
          {(doc.destructions || []).length > 0 && (
            <div>
              <div className="ws-section-label">Destruction Records</div>
              <table className="ws-table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Date</th><th>Method</th><th>Witness</th><th>Cert #</th><th>By</th></tr></thead>
                <tbody>
                  {doc.destructions.map((d, i) => (
                    <tr key={i}>
                      <td className="cell-muted">{fmtDate(d.date)}</td>
                      <td className="cell-muted">{d.method || '—'}</td>
                      <td className="cell-muted">{d.witness || '—'}</td>
                      <td className="cell-muted">{d.certNum || '—'}</td>
                      <td className="cell-muted">{d.by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={handleDelete} disabled={deleting} style={{ fontSize: '0.75rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {deleting ? 'Deleting…' : 'Delete Document Record'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage({ siteId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [accountableFilter, setAccountableFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  function loadDocs() {
    const params = siteId ? { siteId } : {};
    return WS.get('document_control', params).then(d => {
      if (d?._wsError) { setLoadError(d.message); setLoading(false); return; }
      setLoadError(null);
      setDocs(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }

  useEffect(() => {
    setLoading(true);
    loadDocs();
  }, [siteId]);

  function handleSaved() {
    loadDocs().then(() => { setAdding(false); setEditing(null); });
  }

  function handleSubSaved(docId) {
    loadDocs().then(d => {
      const fresh = (Array.isArray(d) ? d : docs).find(x => x.id === docId);
      if (fresh) setSelected(fresh);
    });
  }

  function handleEditFromDetail() {
    const doc = selected;
    setSelected(null);
    setEditing(doc);
  }

  const allPrograms = [...new Set(docs.map(d => d.program).filter(Boolean))].sort();
  const inventoryOverdueCount = docs.filter(isInventoryOverdue).length;
  const inventorySoonCount = docs.filter(d => !isInventoryOverdue(d) && isInventorySoon(d)).length;

  const filtered = docs.filter(d => {
    const matchSearch = !search ||
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.docNumber?.toLowerCase().includes(search.toLowerCase()) ||
      d.custodian?.toLowerCase().includes(search.toLowerCase()) ||
      d.program?.toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === 'all' || d.classification === classFilter;
    const matchProgram = programFilter === 'all' || d.program === programFilter;
    const matchAcc = accountableFilter === 'all' || (accountableFilter === 'yes' ? d.accountable : !d.accountable);
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchClass && matchProgram && matchAcc && matchStatus;
  });

  if (loading) return <div className="ws-empty">Loading document register…</div>;
  if (loadError) return <div className="ws-empty">Failed to load documents: {loadError}</div>;

  return (
    <div className="ws-page">
      {adding && <DocumentForm siteId={siteId} onSave={handleSaved} onClose={() => setAdding(false)} />}
      {editing && <DocumentForm doc={editing} siteId={siteId} onSave={handleSaved} onClose={() => setEditing(null)} />}
      {selected && !editing && (
        <DocumentDetail
          doc={selected}
          onClose={() => setSelected(null)}
          onEdit={handleEditFromDetail}
          onSubSaved={handleSubSaved}
        />
      )}

      <div className="ws-page-header">
        <div>
          <div className="ws-page-title">Document Control</div>
          <div className="ws-page-sub">Controlled document register — receipts, dispatches, destructions, and inventory accountability.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {inventoryOverdueCount > 0 && (
            <span className="ws-count-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red-border)' }}>
              {inventoryOverdueCount} inventory overdue
            </span>
          )}
          {inventorySoonCount > 0 && (
            <span className="ws-count-badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: 'var(--amber-border)' }}>
              {inventorySoonCount} inventory due soon
            </span>
          )}
          <span className="ws-count-badge">{docs.filter(d => d.accountable).length} accountable / {docs.length} total</span>
          <button className="ws-action-btn primary" onClick={() => setAdding(true)}>+ Add Document</button>
        </div>
      </div>

      <div className="ws-filter-bar">
        <input className="ws-search" placeholder="Search title, number, custodian, program…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="ws-select" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="all">All Classifications</option>
          {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="ws-select" value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
          <option value="all">All Programs</option>
          {allPrograms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="ws-select" value={accountableFilter} onChange={e => setAccountableFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="yes">Accountable</option>
          <option value="no">Non-accountable</option>
        </select>
        <select className="ws-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="ws-card">
        <div className="ws-card-body" style={{ padding: 0 }}>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Doc Number</th>
                  <th>Title / Program</th>
                  <th>Classification</th>
                  <th>Custodian</th>
                  <th>Location</th>
                  <th>Version</th>
                  <th>Accountability</th>
                  <th>Next Inventory</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}><div className="ws-empty">No documents match the current filter.</div></td></tr>
                ) : filtered.map(d => {
                  const overdueInv = isInventoryOverdue(d);
                  const soonInv = !overdueInv && isInventorySoon(d);
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setSelected(d)}
                      style={{ cursor: 'pointer', background: overdueInv ? 'var(--red-bg)' : soonInv ? 'var(--amber-bg)' : undefined }}
                    >
                      <td><strong>{d.docNumber}</strong></td>
                      <td>
                        <strong>{d.title}</strong>
                        {d.program && <div className="cell-muted">{d.program}</div>}
                      </td>
                      <td><span className={`badge ${classBadge(d.classification)}`}>{d.classification}</span></td>
                      <td className="cell-muted">{d.custodian || '—'}</td>
                      <td className="cell-muted">{d.currentLocation || '—'}</td>
                      <td className="cell-muted">v{d.version}</td>
                      <td>
                        <span className={d.accountable ? 'badge badge-blue' : 'badge badge-gray'}>
                          {d.accountable ? 'Accountable' : 'Non-accountable'}
                        </span>
                        {d.copyCount > 0 && <div className="cell-muted">{d.copyCount} {d.copyCount === 1 ? 'copy' : 'copies'}</div>}
                      </td>
                      <td>
                        {d.nextInventory ? (
                          <div>
                            <div className="cell-muted">{fmtShort(d.nextInventory)}</div>
                            {overdueInv && <span className="badge badge-red">Overdue</span>}
                            {soonInv && <span className="badge badge-amber">Due soon</span>}
                          </div>
                        ) : <span className="cell-muted">—</span>}
                      </td>
                      <td><span className={`badge ${statusBadge(d.status)}`}>{d.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Click any row to view the full document record and record lifecycle actions (receipt, issue, dispatch, destruction).</div>
    </div>
  );
}
