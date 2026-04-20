import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import PageHeader     from '../components/ui/PageHeader';
import Table          from '../components/ui/Table';
import Badge          from '../components/ui/Badge';
import Modal          from '../components/ui/Modal';
import ConfirmDialog  from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart     from '../components/ui/DonutChart';
import { Plus, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import UserSelect from '../components/ui/UserSelect';

const EMPTY = { title: '', type: 'Task', status: 'Open', priority: 'Medium', assignee: '', due_date: '', control: '', linked_controls_str: '', notes: '' };

function parseCtrlStr(str) {
  return (str || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
}

function TaskForm({ value, onChange }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">TITLE *</label>
        <input className="input-base" value={value.title} onChange={e => f('title', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">TYPE</label>
        <select className="input-base" value={value.type} onChange={e => f('type', e.target.value)}>
          {['Task','Finding','Remediation','Action Item'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">STATUS</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {['Open','In Progress','Completed','Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">PRIORITY</label>
        <select className="input-base" value={value.priority} onChange={e => f('priority', e.target.value)}>
          {['Low','Medium','High','Critical'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">ASSIGNEE</label>
        <UserSelect value={value.assignee || ''} onChange={v => f('assignee', v)} placeholder="Select assignee…" />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">DUE DATE</label>
        <input type="date" className="input-base" value={value.due_date || ''} onChange={e => f('due_date', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">CONTROL</label>
        <input className="input-base font-mono" placeholder="e.g. AC-2" value={value.control || ''} onChange={e => f('control', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">
          LINKED CONTROLS <span className="text-scorva-muted/60">(comma-separated)</span>
        </label>
        <input className="input-base font-mono text-xs" placeholder="AC-2, RA-5, SI-2" value={value.linked_controls_str || ''} onChange={e => f('linked_controls_str', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">NOTES</label>
        <textarea className="input-base resize-none" rows={3} value={value.notes || ''} onChange={e => f('notes', e.target.value)} />
      </div>
    </div>
  );
}

/* ── Mark Complete modal ── */
function CompleteModal({ task, onConfirm, onCancel }) {
  const [evidence, setEvidence] = useState('');
  const ctrlIds = task.linked_controls || [];
  return (
    <Modal title="Mark Task as Complete" onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-scorva-text font-medium mb-1">{task.title}</p>
          {task.source === 'conmon' && task.source_id && (
            <p className="text-xs text-scorva-muted font-mono">↳ ConMon Activity: {task.source_id}</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-scorva-muted mb-1 uppercase tracking-wider">
            Evidence / Completion Notes <span className="text-scorva-muted/60">(optional)</span>
          </label>
          <textarea
            className="input-base resize-none w-full"
            rows={3}
            placeholder="Describe what was done, reference artifacts, upload locations..."
            value={evidence}
            onChange={e => setEvidence(e.target.value)}
            autoFocus
          />
        </div>
        {ctrlIds.length > 0 && (
          <div className="bg-scorva-hover/40 rounded-lg p-3 text-xs text-scorva-muted">
            <span className="text-scorva-text font-medium">{ctrlIds.length} linked control{ctrlIds.length !== 1 ? 's' : ''}</span>
            {' '}will be marked <Badge label="Compliant" />:
            <span className="font-mono ml-1 text-scorva-accent-light">{ctrlIds.slice(0, 5).join(', ')}{ctrlIds.length > 5 ? ` +${ctrlIds.length - 5} more` : ''}</span>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex items-center gap-2" onClick={() => onConfirm(evidence)}>
            <CheckCircle size={14} /> Confirm Complete
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function TasksPage() {
  const { user }  = useAuth();
  const qc        = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['tasks', 'mine'], queryFn: api.tasks.listMine });

  const [activeTab,    setActiveTab]   = useState('active');
  const [modal,        setModal]       = useState(null);   // 'create' | 'edit'
  const [completeTask, setCompleteTask] = useState(null);
  const [form,         setForm]        = useState(EMPTY);
  const [editing,      setEditing]     = useState(null);
  const [delId,        setDelId]       = useState(null);

  const invalidate = () => {
    qc.invalidateQueries(['tasks']);
    qc.invalidateQueries(['conmon']);
    qc.invalidateQueries(['controls']);
  };

  const create = useMutation({ mutationFn: api.tasks.create,                           onSuccess: () => { invalidate(); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.tasks.update(id, d),     onSuccess: () => { invalidate(); setModal(null); setCompleteTask(null); } });
  const remove = useMutation({ mutationFn: api.tasks.remove,                           onSuccess: () => { invalidate(); setDelId(null); } });

  const todayStr = new Date().toISOString().split('T')[0];

  function buildPayload(f) {
    const { linked_controls_str, ...rest } = f;
    return { ...rest, linked_controls: parseCtrlStr(linked_controls_str) };
  }

  function openCreate() { setForm({ ...EMPTY, assignee: user?.name || user?.username || '' }); setModal('create'); }
  function openEdit(row) {
    setForm({ ...row, linked_controls_str: (row.linked_controls || []).join(', ') });
    setEditing(row.id);
    setModal('edit');
  }
  function handleSubmit(e) {
    e.preventDefault();
    const payload = buildPayload(form);
    if (modal === 'create') create.mutate(payload);
    else update.mutate({ id: editing, d: payload });
  }
  function handleComplete(evidence) {
    update.mutate({ id: completeTask.id, d: { status: 'Completed', evidence } });
  }

  /* ── split into tabs ── */
  const active    = data.filter(t => t.status !== 'Completed' && t.status !== 'Closed');
  const completed = data.filter(t => t.status === 'Completed' || t.status === 'Closed');
  const shown     = activeTab === 'active' ? active : completed;

  const overdue = active.filter(t => t.due_date && t.due_date < todayStr).length;

  /* ── table columns (shared base) ── */
  function linkedCtrlsCell(ids = []) {
    if (!ids.length) return <span className="text-xs text-scorva-muted">—</span>;
    return (
      <div className="flex flex-wrap gap-0.5">
        {ids.slice(0, 3).map(id => (
          <span key={id} className="font-mono text-[10px] bg-scorva-hover text-scorva-accent-light px-1.5 py-0.5 rounded">{id}</span>
        ))}
        {ids.length > 3 && <span className="text-[10px] text-scorva-muted">+{ids.length - 3}</span>}
      </div>
    );
  }

  const baseCols = [
    { key: 'id',       label: 'ID',       width: 90,  render: v => <span className="font-mono text-xs text-scorva-accent-light">{v}</span> },
    { key: 'title',    label: 'Title' },
    { key: 'priority', label: 'Priority', render: v => <Badge label={v} /> },
    { key: 'due_date', label: 'Due', width: 100,
      render: v => <span className={`font-mono text-xs ${v && v < todayStr ? 'text-red-400' : ''}`}>{v || '—'}</span> },
    { key: 'linked_controls', label: 'Controls', render: linkedCtrlsCell },
  ];

  const activeCols = [
    ...baseCols,
    { key: 'status', label: 'Status', render: v => <Badge label={v} /> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        <button
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
          onClick={() => setCompleteTask(row)}
        >
          <CheckCircle size={11} /> Done
        </button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover"  onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  const completedCols = [
    ...baseCols,
    { key: 'evidence', label: 'Evidence', render: v => <span className="text-xs text-scorva-muted truncate max-w-[180px] block">{v || '—'}</span> },
    { key: 'source_id', label: 'Activity', width: 100,
      render: v => v ? <span className="font-mono text-xs text-scorva-accent-light">{v}</span> : <span className="text-xs text-scorva-muted">—</span> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="My Taskers"
        description={`${active.length} active · ${completed.length} completed`}
        action={
          <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}>
            <Plus size={15} /> New Task
          </button>
        }
      />

      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={String(active.length)}
            sublabel="active"
            segments={[
              { label: 'Open',        value: active.filter(t => t.status === 'Open').length,        color: 'red'    },
              { label: 'In Progress', value: active.filter(t => t.status === 'In Progress').length, color: 'yellow' },
              { label: 'Completed',   value: completed.length,                                      color: 'green'  },
            ]}
          />
          <div className="flex flex-wrap gap-2 items-start">
            <StatTile label="Total Tasks"  value={data.length} />
            <StatTile label="Overdue"      value={overdue}    color={overdue > 0 ? 'red' : 'default'} />
            <StatTile label="Completed"    value={completed.length} color="green" />
          </div>
        </div>
      </StatusDashboard>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 border-b border-scorva-border mb-4 mt-1">
        {[
          { id: 'active',    label: 'Active',    count: active.length    },
          { id: 'completed', label: 'Completed', count: completed.length },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'border-scorva-accent text-scorva-accent'
                : 'border-transparent text-scorva-muted hover:text-scorva-text'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] font-mono text-scorva-muted/60">({t.count})</span>
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <Table
        columns={activeTab === 'active' ? activeCols : completedCols}
        data={shown}
        onRowClick={openEdit}
        emptyText={activeTab === 'active' ? 'No active tasks — you\'re all caught up!' : 'No completed tasks yet.'}
      />

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <Modal title={modal === 'create' ? 'New Task' : 'Edit Task'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TaskForm value={form} onChange={setForm} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Mark Complete Modal ── */}
      {completeTask && (
        <CompleteModal
          task={completeTask}
          onConfirm={handleComplete}
          onCancel={() => setCompleteTask(null)}
        />
      )}

      {delId && (
        <ConfirmDialog title="Delete Task" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />
      )}
    </div>
  );
}
