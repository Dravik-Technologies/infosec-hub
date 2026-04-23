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
import { Plus, Pencil, Trash2, RefreshCw, Download } from 'lucide-react';
import UserSelect from '../components/ui/UserSelect';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';
import BarList    from '../components/ui/BarList';

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
        <input className="input-base" value={value.title} onChange={e => f('title', e.target.value)} required />
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
        <input className="input-base" value={value.poam_type || ''} onChange={e => f('poam_type', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Scheduled Completion</label>
        <input type="date" className="input-base" value={value.scheduled_completion || ''} onChange={e => f('scheduled_completion', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Weakness Description</label>
        <textarea className="input-base resize-none" rows={3} value={value.weakness || ''} onChange={e => f('weakness', e.target.value)} />
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
        <textarea className="input-base resize-none" rows={2} value={value.comments || ''} onChange={e => f('comments', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Risk Rationale</label>
        <textarea className="input-base resize-none" rows={2} value={value.risk_rationale || ''} onChange={e => f('risk_rationale', e.target.value)} />
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

export default function POAMPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const canReviewRisk = REVIEWER_ROLES.has(user?.role);
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: ['poam', siteScopeKey], queryFn: api.poam.list });
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId]     = useState(null);

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
      <PageHeader title="Plan of Action & Milestones" description="POAM tracking"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => backfill.mutate()} disabled={backfill.isPending} title="Create missing tasks for existing POAMs">
              <RefreshCw size={14} className={backfill.isPending ? 'animate-spin' : ''} /> Sync Tasks
            </button>
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending} title="Export POAM report to Excel">
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
      <div className="mt-6">
      <Table columns={cols} data={data} />
      {modal && (
        <Modal title={modal === 'create' ? 'New POAM' : 'Edit POAM'} onClose={() => setModal(null)} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <POAMForm value={form} onChange={setForm} />
            {modal === 'edit' && (
              <RiskWorkflowPanel
                value={form}
                onChange={setForm}
                canReview={canReviewRisk}
                onTransition={handleRiskTransition}
                isTransitioning={transitionRisk.isPending}
              />
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
