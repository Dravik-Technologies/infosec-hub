import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import PageHeader    from '../components/ui/PageHeader';
import Modal         from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Badge from '../components/ui/Badge';
import UserSelect from '../components/ui/UserSelect';
import { Plus, Pencil, Trash2, LayoutGrid, ClipboardCheck } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';

const EMPTY = {
  name: '',
  description: '',
  category: 'Backups',
  frequency: 'Monthly',
  owner: '',
  next_due: '',
  last_completed: '',
  status: 'Active',
  control_id: '',
  columns: [],
  rows: [],
  subtrackers: [],
};

const TEMPLATES = [
  { category: 'Backups', name: 'Backup Verification', frequency: 'Weekly', description: 'Verify scheduled backups completed successfully and capture evidence of failures or retries.' },
  { category: 'Backups', name: 'Backup Restore Test', frequency: 'Quarterly', description: 'Perform a sample restore test and record restore result, duration, and evidence location.' },
  { category: 'Training', name: 'Annual Cyber Awareness Training', frequency: 'Annual', description: 'Review annual cyber awareness completion and follow up on overdue users.' },
  { category: 'Account Management', name: 'Privileged Access Review', frequency: 'Monthly', description: 'Review privileged accounts for continued need, approval, and inactivity.' },
  { category: 'Vulnerability Management', name: 'Patch Window Verification', frequency: 'Monthly', description: 'Confirm patch window execution, exceptions, and remediation follow-up.' },
  { category: 'Log Review', name: 'Weekly Audit Log Review', frequency: 'Weekly', description: 'Review audit/security logs, document anomalies, and create follow-up taskers as needed.' },
  { category: 'Incident Readiness', name: 'IR Contact Roster Validation', frequency: 'Quarterly', description: 'Validate incident response contacts, escalation paths, and notification procedures.' },
  { category: 'Configuration Management', name: 'Baseline Configuration Review', frequency: 'Quarterly', description: 'Review baselines for drift, unauthorized software, or undocumented changes.' },
];

function trackerHealth(tracker, todayStr) {
  if (tracker.status === 'Completed') return 'Completed';
  if (tracker.status === 'Inactive') return 'Inactive';
  if (!tracker.next_due) return 'Stale';
  if (tracker.next_due < todayStr) return 'Overdue';
  const due = new Date(tracker.next_due);
  const today = new Date(todayStr);
  if (Number.isNaN(due.getTime())) return 'Stale';
  const days = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return days <= 30 ? 'Due Soon' : 'Current';
}

export default function TrackersPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['trackers'], queryFn: api.trackers.list });
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId]     = useState(null);

  const create = useMutation({ mutationFn: api.trackers.create, onSuccess: () => { qc.invalidateQueries(['trackers']); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.trackers.update(id, d), onSuccess: () => { qc.invalidateQueries(['trackers']); setModal(null); } });
  const remove = useMutation({ mutationFn: api.trackers.remove, onSuccess: () => { qc.invalidateQueries(['trackers']); setDelId(null); } });

  function openCreate(template) { setForm({ ...EMPTY, ...(template || {}) }); setModal('create'); }
  function openEdit(row) {
    setForm({
      ...EMPTY,
      ...row,
      next_due: row.next_due || row.nextDue || '',
      last_completed: row.last_completed || row.lastCompleted || '',
      control_id: row.control_id || row.controlId || '',
    });
    setEditing(row.id);
    setModal('edit');
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  if (isLoading) return <LoadingSpinner />;

  const totalRows = data.reduce((s, t) => s + (t.rows?.length    || 0), 0);
  const totalCols = data.reduce((s, t) => s + (t.columns?.length || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const dueSoon = data.filter(t => trackerHealth(t, todayStr) === 'Due Soon').length;
  const overdue = data.filter(t => trackerHealth(t, todayStr) === 'Overdue').length;
  const stale = data.filter(t => trackerHealth(t, todayStr) === 'Stale').length;


  return (
    <div>
      <PageHeader title="Trackers" description="Custom compliance tracking boards"
        action={<button className="btn-primary" onClick={() => openCreate()}><Plus size={15} />New Tracker</button>}
      />
      <StatusDashboard>
        <div className="flex flex-wrap gap-2">
          <StatTile label="Trackers"      value={data.length} color="blue"    />
          <StatTile label="Due Soon"      value={dueSoon}     color={dueSoon > 0 ? 'yellow' : 'default'} />
          <StatTile label="Overdue"       value={overdue}     color={overdue > 0 ? 'red' : 'default'} />
          <StatTile label="Stale"         value={stale}       color={stale > 0 ? 'yellow' : 'default'} />
          <StatTile label="Total Rows"    value={totalRows}   />
          <StatTile label="Total Columns" value={totalCols}   />
        </div>
      </StatusDashboard>

      <div className="card p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardCheck size={14} className="text-scorva-muted" />
          <span className="text-[10px] font-mono font-semibold text-scorva-muted uppercase tracking-widest">Scheduled Requirement Templates</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(t => (
            <button key={`${t.category}-${t.name}`} className="btn-secondary text-xs" onClick={() => openCreate(t)}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-scorva-muted">
          <LayoutGrid size={36} className="mb-3 opacity-30" />
          <p className="text-sm">No trackers yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(t => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium text-scorva-text">{t.name}</h3>
                  {t.description && <p className="text-xs text-scorva-muted mt-0.5">{t.description}</p>}
                </div>
                <div className="flex gap-1.5 ml-2">
                  <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(t)}><Pencil size={13} /></button>
                  <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(t.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge label={trackerHealth(t, todayStr)} />
                {t.category && <Badge label={t.category} />}
                {t.frequency && <span className="px-2 py-0.5 rounded text-xs bg-scorva-surface text-scorva-muted border border-scorva-border">{t.frequency}</span>}
              </div>
              <div className="flex gap-3 mt-3 text-xs text-scorva-muted">
                <span>Owner: {t.owner || '—'}</span>
                <span>·</span>
                <span>Next: {t.next_due || t.nextDue || '—'}</span>
              </div>
              <div className="flex gap-3 mt-2 text-xs text-scorva-muted">
                <span>{(t.columns || []).length} columns</span>
                <span>·</span>
                <span>{(t.rows || []).length} rows</span>
              </div>
              <div className="text-xs text-scorva-muted mt-1 font-mono">{t.created_at ? t.created_at.split('T')[0] : ''}</div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'New Tracker' : 'Edit Tracker'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-scorva-muted mb-1">Name *</label>
              <input className="input-base" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-scorva-muted mb-1">Category</label>
                <select className="input-base" value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['Backups','Training','Account Management','Vulnerability Management','Log Review','Incident Readiness','Configuration Management','Physical Security','Contingency Planning'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-scorva-muted mb-1">Frequency</label>
                <select className="input-base" value={form.frequency || ''} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {['Daily','Weekly','Monthly','Quarterly','Semiannual','Annual','Ad hoc'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-scorva-muted mb-1">Owner</label>
                <UserSelect value={form.owner || ''} onChange={v => setForm(f => ({ ...f, owner: v }))} placeholder="Select owner…" />
              </div>
              <div>
                <label className="block text-xs text-scorva-muted mb-1">Status</label>
                <select className="input-base" value={form.status || 'Active'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {['Active','Completed','Inactive'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-scorva-muted mb-1">Next Due</label>
                <input type="date" className="input-base" value={form.next_due || ''} onChange={e => setForm(f => ({ ...f, next_due: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-scorva-muted mb-1">Last Completed</label>
                <input type="date" className="input-base" value={form.last_completed || ''} onChange={e => setForm(f => ({ ...f, last_completed: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-scorva-muted mb-1">Control Link</label>
                <input className="input-base font-mono" placeholder="e.g. CP-9, AT-2, AU-6" value={form.control_id || ''} onChange={e => setForm(f => ({ ...f, control_id: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-scorva-muted mb-1">Description</label>
              <textarea className="input-base resize-none" rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {delId && <ConfirmDialog title="Delete Tracker" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
    </div>
  );
}
