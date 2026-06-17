import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader    from '../components/ui/PageHeader';
import Table         from '../components/ui/Table';
import Badge         from '../components/ui/Badge';
import Modal         from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Pencil, Trash2, RefreshCw, Download, List, LayoutGrid, AlertTriangle, Filter } from 'lucide-react';
import UserSelect from '../components/ui/UserSelect';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';
import BarList    from '../components/ui/BarList';
import EvidencePanel from '../components/EvidencePanel';

const EMPTY = {
  title: '',
  weakness: '',
  severity: 'Medium',
  status: 'Open',
  responsible_party: '',
  scheduled_completion: '',
  poam_type: '',
  comments: '',
  risk_decision: '',
  risk_rationale: '',
  risk_workflow_state: 'Draft',
  risk_review_notes: '',
  risk_submitted_at: '',
  risk_submitted_by: '',
  risk_reviewed_at: '',
  risk_reviewed_by: '',
};

const REVIEWER_ROLES = new Set(['Corporate Admin', 'Site Admin']);

const WORKFLOW_ACTIONS = {
  Draft: [{ state: 'Submitted', label: 'Submit for Review' }],
  Submitted: [
    { state: 'Draft', label: 'Return to Draft' },
    { state: 'Under Review', label: 'Start Review', reviewerOnly: true },
  ],
  'Under Review': [
    { state: 'Approved', label: 'Approve', reviewerOnly: true },
    { state: 'Rejected', label: 'Reject', reviewerOnly: true },
  ],
  Rejected: [
    { state: 'Draft', label: 'Rework Draft' },
    { state: 'Submitted', label: 'Resubmit' },
  ],
  Approved: [{ state: 'Draft', label: 'Reopen Draft', reviewerOnly: true }],
};

function formatWorkflowTimestamp(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return value;
  }
}

function toFormState(row = {}) {
  return {
    ...EMPTY,
    ...row,
    responsible_party: row.responsible_party ?? row.responsibleParty ?? '',
    scheduled_completion: row.scheduled_completion ?? row.scheduledCompletion ?? '',
    poam_type: row.poam_type ?? row.poamType ?? '',
    risk_decision: row.risk_decision ?? row.riskDecision ?? '',
    risk_rationale: row.risk_rationale ?? row.riskRationale ?? '',
    risk_workflow_state: row.risk_workflow_state ?? row.riskWorkflowState ?? 'Draft',
    risk_review_notes: row.risk_review_notes ?? row.riskReviewNotes ?? '',
    risk_submitted_at: row.risk_submitted_at ?? row.riskSubmittedAt ?? '',
    risk_submitted_by: row.risk_submitted_by ?? row.riskSubmittedBy ?? '',
    risk_reviewed_at: row.risk_reviewed_at ?? row.riskReviewedAt ?? '',
    risk_reviewed_by: row.risk_reviewed_by ?? row.riskReviewedBy ?? '',
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function POAMForm({ value, onChange }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Title *</label>
        <input className="input-base" placeholder="e.g. Implement multi-factor authentication" value={value.title} onChange={e => f('title', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Severity</label>
        <select className="input-base" value={value.severity} onChange={e => f('severity', e.target.value)}>
          {['Critical','High','Medium','Low'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Status</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {['Open','In Progress','Completed','Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">POAM Type</label>
        <input className="input-base" placeholder="e.g. Technical, Operational, Policy" value={value.poam_type || ''} onChange={e => f('poam_type', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Scheduled Completion</label>
        <input type="date" className="input-base" value={value.scheduled_completion || ''} onChange={e => f('scheduled_completion', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Weakness Description</label>
        <textarea className="input-base resize-none" rows={3} placeholder="Describe the security weakness or finding that this POA&M item addresses..." value={value.weakness || ''} onChange={e => f('weakness', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Responsible Party</label>
        <UserSelect value={value.responsible_party || ''} onChange={v => f('responsible_party', v)} placeholder="Select responsible party…" />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Risk Decision</label>
        <select className="input-base" value={value.risk_decision || ''} onChange={e => f('risk_decision', e.target.value)}>
          <option value="">— None —</option>
          {['Mitigate', 'Accept', 'Transfer', 'Avoid'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Comments</label>
        <textarea className="input-base resize-none" rows={2} placeholder="e.g. Budget approved, team assigned, dependencies noted..." value={value.comments || ''} onChange={e => f('comments', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Risk Rationale</label>
        <textarea className="input-base resize-none" rows={2} placeholder="Explain the risk if this item is not completed, business impact, or mitigation strategy..." value={value.risk_rationale || ''} onChange={e => f('risk_rationale', e.target.value)} />
      </div>
    </div>
  );
}

function RiskWorkflowPanel({ value, onChange, canReview, onTransition, isTransitioning }) {
  const actions = (WORKFLOW_ACTIONS[value.risk_workflow_state || 'Draft'] || []).filter(action => !action.reviewerOnly || canReview);

  return (
    <div className="rounded-xl border border-scorva-border bg-scorva-panel/40 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Risk Workflow</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge label={value.risk_workflow_state || 'Draft'} />
            <span className="text-sm text-scorva-muted">Formal review path for the selected risk response.</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-scorva-muted mb-1">Submitted</div>
          <div className="text-scorva-text">{formatWorkflowTimestamp(value.risk_submitted_at)}</div>
          <div className="text-xs text-scorva-muted mt-1">By {value.risk_submitted_by || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-scorva-muted mb-1">Last Review</div>
          <div className="text-scorva-text">{formatWorkflowTimestamp(value.risk_reviewed_at)}</div>
          <div className="text-xs text-scorva-muted mt-1">By {value.risk_reviewed_by || '—'}</div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-scorva-muted mb-1">Review Notes</label>
        <textarea
          className="input-base resize-none"
          rows={3}
          value={value.risk_review_notes || ''}
          onChange={e => onChange({ ...value, risk_review_notes: e.target.value })}
          placeholder="Reviewer rationale, approval guidance, or rejection notes."
        />
      </div>

      {!!actions.length && (
        <div className="flex flex-wrap gap-2">
          {actions.map(action => (
            <button
              key={action.state}
              type="button"
              className={action.state === 'Approved' ? 'btn-primary' : 'btn-secondary'}
              disabled={isTransitioning}
              onClick={() => onTransition(action.state)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Severity → row accent class ── */
function getPoamRowClass(row) {
  const sev = (row.severity || '').toLowerCase();
  if (sev === 'critical') return 'row-critical';
  if (sev === 'high')     return 'row-high';
  if (sev === 'medium')   return 'row-medium';
  if (sev === 'low')      return 'row-low';
  return '';
}

/* ── Kanban board view ── */
const KANBAN_COLS = [
  { status: 'Open',        label: 'Open',        dot: 'bg-red-500',     text: 'text-red-400' },
  { status: 'In Progress', label: 'In Progress',  dot: 'bg-yellow-400',  text: 'text-yellow-400' },
  { status: 'Completed',   label: 'Completed',    dot: 'bg-emerald-500', text: 'text-emerald-400' },
  { status: 'Closed',      label: 'Closed',       dot: 'bg-slate-500',   text: 'text-slate-400' },
];

function KanbanBoard({ data, onEdit, onDelete }) {
  const grouped = Object.fromEntries(KANBAN_COLS.map(c => [c.status, []]));
  data.forEach(row => {
    const key = grouped[row.status] !== undefined ? row.status : 'Open';
    grouped[key].push(row);
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-6 items-start">
      {KANBAN_COLS.map(col => (
        <div key={col.status} className="flex flex-col gap-2">
          {/* Column header */}
          <div className="flex items-center gap-2 px-1 mb-1">
            <div className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-scorva-muted">
              {col.label}
            </span>
            <span className={`ml-auto text-[11px] font-mono font-semibold ${col.text}`}>
              {grouped[col.status].length}
            </span>
          </div>

          {/* Cards */}
          {grouped[col.status].length === 0 ? (
            <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-scorva-border/50 text-scorva-muted/30 text-xs">
              Empty
            </div>
          ) : (
            grouped[col.status].map(row => (
              <div
                key={row.id}
                className="card p-3 space-y-2.5 group hover:border-scorva-accent/25 transition-colors cursor-pointer"
                onClick={() => onEdit(row)}
              >
                {/* ID + actions */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-scorva-accent-light truncate">
                    {row.id}
                  </span>
                  <div
                    className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      className="p-1 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover"
                      onClick={() => onEdit(row)}
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      className="p-1 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover"
                      onClick={() => onDelete(row.id)}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <p className="text-[12px] text-scorva-text font-medium leading-snug line-clamp-2">
                  {row.title}
                </p>

                {/* Severity + due date */}
                <div className="flex items-center justify-between gap-2">
                  <Badge label={row.severity} />
                  {(row.scheduled_completion || row.scheduledCompletion) && (
                    <span className="text-[10px] font-mono text-scorva-muted shrink-0">
                      {row.scheduled_completion || row.scheduledCompletion}
                    </span>
                  )}
                </div>

                {/* Responsible party */}
                {(row.responsible_party || row.responsibleParty) && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-scorva-accent/15 text-scorva-accent text-[9px] font-bold flex items-center justify-center font-mono shrink-0">
                      {(row.responsible_party || row.responsibleParty).slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-scorva-muted truncate">
                      {row.responsible_party || row.responsibleParty}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

export default function POAMPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const canReviewRisk = REVIEWER_ROLES.has(user?.role);
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: ['poam', siteScopeKey], queryFn: api.poam.list });
  const [view,           setView]          = useState('list');
  const [filterOpen,     setFilterOpen]    = useState(false);
  const [filterSeverity, setFilterSev]     = useState('All');
  const [filterStatus,   setFilterStatus]  = useState('All');
  const [filterRisk,     setFilterRisk]    = useState('All');
  const [modal,          setModal]         = useState(null);
  const [form,           setForm]          = useState(EMPTY);
  const [editing,        setEditing]       = useState(null);
  const [delId,          setDelId]         = useState(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['poam'] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };
  const create   = useMutation({ mutationFn: api.poam.create,                           onSuccess: () => { invalidate(); setModal(null); } });
  const update   = useMutation({ mutationFn: ({ id, d }) => api.poam.update(id, d),     onSuccess: () => { invalidate(); setModal(null); } });
  const remove   = useMutation({ mutationFn: api.poam.remove,                           onSuccess: () => { invalidate(); setDelId(null); } });
  const transitionRisk = useMutation({
    mutationFn: ({ id, d }) => api.poam.transitionRiskWorkflow(id, d),
    onSuccess: (updated) => {
      invalidate();
      setForm(toFormState(updated));
    },
  });
  const backfill = useMutation({
    mutationFn: api.poam.backfillTasks,
    onSuccess: (r) => { invalidate(); alert(`Sync complete: ${r.created} task(s) created, ${r.skipped} already existed.`); },
  });
  const exportXlsx = useMutation({
    mutationFn: api.reports.poam,
    onSuccess: ({ blob, filename }) => triggerDownload(blob, filename),
  });

  function resetErrors() {
    create.reset();
    update.reset();
    transitionRisk.reset();
  }

  function openCreate() { resetErrors(); setEditing(null); setForm(EMPTY); setModal('create'); }
  function openEdit(row) { resetErrors(); setForm(toFormState(row)); setEditing(row.id); setModal('edit'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  function handleRiskTransition(nextState) {
    if (!editing) return;
    transitionRisk.mutate({
      id: editing,
      d: {
        state: nextState,
        review_notes: form.risk_review_notes || '',
        risk_review_notes: form.risk_review_notes || '',
        risk_decision: form.risk_decision || '',
        risk_rationale: form.risk_rationale || '',
      },
    });
  }

  const mutationError =
    create.error?.response?.data?.error ||
    update.error?.response?.data?.error ||
    transitionRisk.error?.response?.data?.error ||
    create.error?.message ||
    update.error?.message ||
    transitionRisk.error?.message;

  const displayData = data.filter(r => {
    if (filterSeverity !== 'All' && r.severity !== filterSeverity) return false;
    if (filterStatus   !== 'All' && r.status   !== filterStatus)   return false;
    const wfState = r.risk_workflow_state || r.riskWorkflowState || 'Draft';
    if (filterRisk !== 'All' && wfState !== filterRisk) return false;
    return true;
  });

  const activeFilterCount = (filterSeverity !== 'All' ? 1 : 0)
    + (filterStatus !== 'All' ? 1 : 0)
    + (filterRisk !== 'All' ? 1 : 0);

  function clearFilters() {
    setFilterSev('All');
    setFilterStatus('All');
    setFilterRisk('All');
  }

  const cols = [
    { key: 'id',       label: 'ID',       width: 90, render: v => <span className="font-mono text-xs text-scorva-accent-light">{v}</span> },
    { key: 'title',    label: 'Title' },
    { key: 'severity', label: 'Severity', render: v => <Badge label={v} /> },
    { key: 'status',   label: 'Status',   render: v => <Badge label={v} /> },
    { key: 'riskWorkflowState', label: 'Risk Workflow', render: (_, row) => <Badge label={row.risk_workflow_state || row.riskWorkflowState || 'Draft'} /> },
    { key: 'responsibleParty', label: 'Responsible Party', render: (_, row) => row.responsible_party || row.responsibleParty || '—' },
    { key: 'scheduledCompletion', label: 'Due', render: (_, row) => <span className="font-mono text-xs">{row.scheduled_completion || row.scheduledCompletion || '—'}</span> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <div className="text-sm text-red-400">Failed to load POAM data: {error?.response?.data?.error || error?.message || 'Unknown error'}</div>;
  }

  const open     = data.filter(r => r.status === 'Open').length;
  const inProg   = data.filter(r => r.status === 'In Progress').length;
  const closed   = data.filter(r => r.status === 'Closed' || r.status === 'Completed').length;
  const critical = data.filter(r => r.severity === 'Critical').length;
  const high     = data.filter(r => r.severity === 'High').length;

  const medium = data.filter(r => r.severity === 'Medium').length;
  const low    = data.filter(r => r.severity === 'Low').length;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Authorization', to: '/ato' }, { label: 'POAM' }]}
        title="Plan of Action & Milestones"
        description={`${data.length} total · ${open} open · ${critical} critical`}
        action={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-scorva-border p-0.5 bg-scorva-surface">
              <button
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-scorva-card text-scorva-text shadow-sm' : 'text-scorva-muted hover:text-scorva-text'}`}
                onClick={() => setView('list')}
                title="List view"
              >
                <List size={13} /> List
              </button>
              <button
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === 'board' ? 'bg-scorva-card text-scorva-text shadow-sm' : 'text-scorva-muted hover:text-scorva-text'}`}
                onClick={() => setView('board')}
                title="Board view"
              >
                <LayoutGrid size={13} /> Board
              </button>
            </div>
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => setFilterOpen(true)} title="Open filter panel">
              <Filter size={14} /> Filters {activeFilterCount > 0 && <span className="font-mono text-xs bg-scorva-accent/20 text-scorva-accent px-1.5 rounded">{activeFilterCount}</span>}
            </button>
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => backfill.mutate()} disabled={backfill.isPending} title="Create missing tasks for existing POAMs">
              <RefreshCw size={14} className={backfill.isPending ? 'animate-spin' : ''} /> Sync
            </button>
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending}>
              <Download size={14} className={exportXlsx.isPending ? 'animate-pulse' : ''} /> Export
            </button>
            <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}><Plus size={15} />New POAM</button>
          </div>
        }
      />
      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={String(open)}
            sublabel="open"
            segments={[
              { label: 'Open',        value: open,   color: 'red'    },
              { label: 'In Progress', value: inProg, color: 'yellow' },
              { label: 'Closed',      value: closed, color: 'green'  },
            ]}
          />
          <div className="flex-1 min-w-[180px]">
            <BarList
              title="Severity Breakdown"
              bars={[
                { label: 'Critical', value: critical, color: 'red'    },
                { label: 'High',     value: high,     color: 'orange' },
                { label: 'Medium',   value: medium,   color: 'yellow' },
                { label: 'Low',      value: low,      color: 'blue'   },
              ]}
            />
          </div>
          <StatTile label="Total POAMs" value={data.length} />
        </div>
      </StatusDashboard>
      <div className="sc-workbar mt-6 mb-4">
        <div className="sc-workbar-meta">
          <span className="sc-workbar-pill">{displayData.length} visible</span>
          <span className="sc-workbar-pill">{view === 'board' ? 'kanban surface' : 'table surface'}</span>
        </div>
      </div>
      <div className="sc-surface-block">
      {view === 'board' ? (
        <KanbanBoard
          data={displayData}
          onEdit={openEdit}
          onDelete={id => setDelId(id)}
        />
      ) : (
        <Table
          columns={cols}
          data={displayData}
          getRowClass={getPoamRowClass}
          emptyText={activeFilterCount > 0 ? 'No POAMs match the active filters.' : 'No POAMs found.'}
          emptyIcon={AlertTriangle}
        />
      )}

      {/* ── Filter modal ── */}
      {filterOpen && (
        <Modal title="Filter POAMs" onClose={() => setFilterOpen(false)} size="md">
          <div className="space-y-6">
            {/* Severity */}
            <div>
              <h4 className="text-sm font-semibold text-scorva-text mb-3">Severity</h4>
              <div className="space-y-2">
                {[
                  { value: 'All', label: 'All', count: data.length },
                  { value: 'Critical', label: 'Critical', count: data.filter(r => r.severity === 'Critical').length },
                  { value: 'High',     label: 'High',     count: data.filter(r => r.severity === 'High').length },
                  { value: 'Medium',   label: 'Medium',   count: data.filter(r => r.severity === 'Medium').length },
                  { value: 'Low',      label: 'Low',      count: data.filter(r => r.severity === 'Low').length },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 p-2 rounded hover:bg-scorva-hover cursor-pointer group transition-colors">
                    <input type="radio" name="severity" checked={filterSeverity === opt.value} onChange={() => setFilterSev(opt.value)} className="accent-scorva-accent" />
                    <span className="text-sm text-scorva-text flex-1">{opt.label}</span>
                    <span className="text-xs text-scorva-muted font-mono bg-scorva-surface px-2 py-0.5 rounded group-hover:bg-scorva-card">{opt.count}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <h4 className="text-sm font-semibold text-scorva-text mb-3">Status</h4>
              <div className="space-y-2">
                {[
                  { value: 'All',        label: 'All',        count: data.length },
                  { value: 'Open',        label: 'Open',        count: data.filter(r => r.status === 'Open').length },
                  { value: 'In Progress', label: 'In Progress', count: data.filter(r => r.status === 'In Progress').length },
                  { value: 'Completed',   label: 'Completed',   count: data.filter(r => r.status === 'Completed').length },
                  { value: 'Closed',      label: 'Closed',      count: data.filter(r => r.status === 'Closed').length },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 p-2 rounded hover:bg-scorva-hover cursor-pointer group transition-colors">
                    <input type="radio" name="status" checked={filterStatus === opt.value} onChange={() => setFilterStatus(opt.value)} className="accent-scorva-accent" />
                    <span className="text-sm text-scorva-text flex-1">{opt.label}</span>
                    <span className="text-xs text-scorva-muted font-mono bg-scorva-surface px-2 py-0.5 rounded group-hover:bg-scorva-card">{opt.count}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Risk Workflow */}
            <div>
              <h4 className="text-sm font-semibold text-scorva-text mb-3">Risk Workflow</h4>
              <div className="space-y-2">
                {[
                  { value: 'All', label: 'All', count: data.length },
                  ...['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected'].map(s => ({
                    value: s, label: s,
                    count: data.filter(r => (r.risk_workflow_state || r.riskWorkflowState || 'Draft') === s).length,
                  }))
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 p-2 rounded hover:bg-scorva-hover cursor-pointer group transition-colors">
                    <input type="radio" name="workflow" checked={filterRisk === opt.value} onChange={() => setFilterRisk(opt.value)} className="accent-scorva-accent" />
                    <span className="text-sm text-scorva-text flex-1">{opt.label}</span>
                    <span className="text-xs text-scorva-muted font-mono bg-scorva-surface px-2 py-0.5 rounded group-hover:bg-scorva-card">{opt.count}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-scorva-border">
              <button type="button" className="btn-secondary flex-1" onClick={() => { clearFilters(); setFilterOpen(false); }} disabled={activeFilterCount === 0}>
                Clear All
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => setFilterOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal && (
        <Modal title={modal === 'create' ? 'New POAM' : 'Edit POAM'} onClose={() => setModal(null)} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <POAMForm value={form} onChange={setForm} />
            {modal === 'edit' && (
              <>
                <RiskWorkflowPanel
                  value={form}
                  onChange={setForm}
                  canReview={canReviewRisk}
                  onTransition={handleRiskTransition}
                  isTransitioning={transitionRisk.isPending}
                />
                {editing && <EvidencePanel resourceType="poam" resourceId={editing} />}
              </>
            )}
            {mutationError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {mutationError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending || transitionRisk.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {delId && <ConfirmDialog title="Delete POAM" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
      </div>
    </div>
  );
}
