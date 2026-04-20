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
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import UserSelect from '../components/ui/UserSelect';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';
import BarList    from '../components/ui/BarList';

const EMPTY = { title: '', weakness: '', severity: 'Medium', status: 'Open', responsible_party: '', scheduled_completion: '', poam_type: '', comments: '' };

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
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Comments</label>
        <textarea className="input-base resize-none" rows={2} value={value.comments || ''} onChange={e => f('comments', e.target.value)} />
      </div>
    </div>
  );
}

export default function POAMPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
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
  const backfill = useMutation({
    mutationFn: api.poam.backfillTasks,
    onSuccess: (r) => { invalidate(); alert(`Sync complete: ${r.created} task(s) created, ${r.skipped} already existed.`); },
  });

  function openCreate() { setForm(EMPTY); setModal('create'); }
  function openEdit(row) { setForm(row); setEditing(row.id); setModal('edit'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  const cols = [
    { key: 'id',       label: 'ID',       width: 90, render: v => <span className="font-mono text-xs text-scorva-accent-light">{v}</span> },
    { key: 'title',    label: 'Title' },
    { key: 'severity', label: 'Severity', render: v => <Badge label={v} /> },
    { key: 'status',   label: 'Status',   render: v => <Badge label={v} /> },
    { key: 'responsible_party', label: 'Responsible Party' },
    { key: 'scheduled_completion', label: 'Due', render: v => <span className="font-mono text-xs">{v || '—'}</span> },
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
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {delId && <ConfirmDialog title="Delete POAM" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
      </div>
    </div>
  );
}
