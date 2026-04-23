import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader     from '../components/ui/PageHeader';
import Table          from '../components/ui/Table';
import Badge          from '../components/ui/Badge';
import Modal          from '../components/ui/Modal';
import ConfirmDialog  from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';
import BarList    from '../components/ui/BarList';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const EVENT_TYPES = ['IDS Alert', 'Login Failure', 'Scan Finding', 'Policy Violation', 'Malware', 'Data Exfil', 'Other'];
const SEVERITIES  = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES    = ['New', 'Acknowledged', 'Resolved'];

const EMPTY = {
  type: 'Other', severity: 'Medium', source: '', asset_id: '',
  description: '', status: 'New',
};

function EventForm({ value, onChange }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Event Type</label>
        <select className="input-base" value={value.type} onChange={e => f('type', e.target.value)}>
          {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Severity</label>
        <select className="input-base" value={value.severity} onChange={e => f('severity', e.target.value)}>
          {SEVERITIES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Status</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Source (IP / hostname)</label>
        <input className="input-base font-mono" value={value.source || ''} onChange={e => f('source', e.target.value)} placeholder="e.g. 10.0.0.5" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Asset ID</label>
        <input className="input-base" value={value.asset_id || ''} onChange={e => f('asset_id', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Description</label>
        <textarea className="input-base resize-none" rows={3} value={value.description || ''} onChange={e => f('description', e.target.value)} />
      </div>
    </div>
  );
}

export default function SecurityEventsPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['security-events', siteScopeKey],
    queryFn: api.securityEvents.list,
  });

  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId,   setDelId]   = useState(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['security-events'] });

  const create = useMutation({ mutationFn: api.securityEvents.create, onSuccess: () => { invalidate(); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.securityEvents.update(id, d), onSuccess: () => { invalidate(); setModal(null); } });
  const remove = useMutation({ mutationFn: api.securityEvents.remove, onSuccess: () => { invalidate(); setDelId(null); } });

  function openCreate() { setForm(EMPTY); setModal('create'); }
  function openEdit(row) { setForm(row); setEditing(row.id); setModal('edit'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  const cols = [
    { key: 'id',          label: 'ID',       width: 130, render: v => <span className="font-mono text-xs text-scorva-accent-light">{v}</span> },
    { key: 'type',        label: 'Type',      width: 120 },
    { key: 'severity',    label: 'Severity',  width: 100, render: v => <Badge label={v} /> },
    { key: 'status',      label: 'Status',    width: 110, render: v => <Badge label={v} /> },
    { key: 'source',      label: 'Source',    render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'description', label: 'Description', render: v => <span className="truncate text-xs text-scorva-muted">{(v || '—').slice(0, 80)}</span> },
    { key: 'createdAt',   label: 'Detected',  width: 140, render: v => <span className="font-mono text-xs">{v ? new Date(v).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <div className="text-sm text-red-400">Failed to load security events: {error?.response?.data?.error || error?.message}</div>;

  const newEvts      = data.filter(e => e.status === 'New').length;
  const ackEvts      = data.filter(e => e.status === 'Acknowledged').length;
  const resolvedEvts = data.filter(e => e.status === 'Resolved').length;
  const critical     = data.filter(e => e.severity === 'Critical').length;
  const high         = data.filter(e => e.severity === 'High').length;
  const medium       = data.filter(e => e.severity === 'Medium').length;
  const low          = data.filter(e => e.severity === 'Low').length;

  return (
    <div>
      <PageHeader
        title="Security Events"
        description="Track and correlate security incidents across assets"
        action={
          <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}>
            <Plus size={15} /> Log Event
          </button>
        }
      />

      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={String(newEvts)}
            sublabel="new"
            segments={[
              { label: 'New',          value: newEvts,      color: 'red'    },
              { label: 'Acknowledged', value: ackEvts,      color: 'yellow' },
              { label: 'Resolved',     value: resolvedEvts, color: 'green'  },
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
          <StatTile label="Total Events" value={data.length} />
        </div>
      </StatusDashboard>

      <div className="mt-6">
        <Table columns={cols} data={data} />

        {modal && (
          <Modal
            title={modal === 'create' ? 'Log Security Event' : 'Edit Event'}
            onClose={() => setModal(null)}
            size="lg"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <EventForm value={form} onChange={setForm} />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
              </div>
            </form>
          </Modal>
        )}

        {delId && (
          <ConfirmDialog
            title="Delete Security Event"
            message="This cannot be undone."
            onConfirm={() => remove.mutate(delId)}
            onCancel={() => setDelId(null)}
          />
        )}
      </div>
    </div>
  );
}
