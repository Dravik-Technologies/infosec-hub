import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader    from '../components/ui/PageHeader';
import Table         from '../components/ui/Table';
import Badge         from '../components/ui/Badge';
import Modal         from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';

const EMPTY = { serial: '', model: '', status: 'Unassigned', username: '', issued: '', lost_destroyed_date: '' };

function getYkRowClass(row) {
  const s = (row.status || '').toLowerCase();
  if (s === 'lost') return 'row-critical';
  if (s === 'retired') return 'row-medium';
  return '';
}

function YKForm({ value, onChange }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Serial *</label>
        <input className="input-base font-mono" value={value.serial} onChange={e => f('serial', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Model</label>
        <input className="input-base" placeholder="e.g. YubiKey 5 NFC" value={value.model || ''} onChange={e => f('model', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Status</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {['Unassigned','Assigned','Lost','Retired'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Assigned To</label>
        <input className="input-base" value={value.username || ''} onChange={e => f('username', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Issued Date</label>
        <input type="date" className="input-base" value={value.issued || ''} onChange={e => f('issued', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Lost / Destroyed Date</label>
        <input type="date" className="input-base" value={value.lost_destroyed_date || ''} onChange={e => f('lost_destroyed_date', e.target.value)} />
      </div>
    </div>
  );
}

export default function YubiKeysPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';
  const { data = [], isLoading } = useQuery({ queryKey: ['yubikeys', siteScopeKey], queryFn: api.yubikeys.list });
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId]     = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => { setSelectedIds([]); }, [siteScopeKey]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['yubikeys'] });
  const create = useMutation({ mutationFn: api.yubikeys.create, onSuccess: () => { invalidate(); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.yubikeys.update(id, d), onSuccess: () => { invalidate(); setModal(null); } });
  const remove = useMutation({ mutationFn: api.yubikeys.remove, onSuccess: () => { invalidate(); setDelId(null); } });
  const removeMany = useMutation({
    mutationFn: api.yubikeys.bulkDelete,
    onSuccess: () => { invalidate(); setSelectedIds([]); },
  });

  function openCreate() { setForm(EMPTY); setModal('create'); }
  function openEdit(row) {
    setForm({
      ...EMPTY,
      ...row,
      lost_destroyed_date: row.lost_destroyed_date || row.lostDestroyedDate || '',
    });
    setEditing(row.id);
    setModal('edit');
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  const shownIds = useMemo(() => data.map(r => r.id), [data]);
  const allShownSelected = shownIds.length > 0 && shownIds.every(id => selectedIds.includes(id));
  const mutationError =
    create.error?.response?.data?.error ||
    update.error?.response?.data?.error ||
    create.error?.message ||
    update.error?.message;

  const cols = [
    {
      key: '_select',
      label: <input type="checkbox" checked={allShownSelected} onChange={() => {
        setSelectedIds(prev => allShownSelected ? [] : [...new Set([...prev, ...shownIds])]);
      }} onClick={e => e.stopPropagation()} aria-label="Select all yubi keys" />,
      width: 32,
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => setSelectedIds(prev => prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id])}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${row.serial}`}
        />
      ),
    },
    { key: 'id',       label: 'ID',     width: 90, render: v => <span className="font-mono text-xs text-scorva-muted">{v}</span> },
    { key: 'serial',   label: 'Serial', render: v => <span className="font-mono text-xs">{v}</span> },
    { key: 'model',    label: 'Model' },
    { key: 'status',   label: 'Status', render: v => <Badge label={v} /> },
    { key: 'username', label: 'Assigned To' },
    { key: 'issued',   label: 'Issued',   render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'lost_destroyed_date', label: 'Lost / Destroyed', render: (v, row) => <span className="font-mono text-xs">{v || row.lostDestroyedDate || '—'}</span> },
    { key: 'last_auth',label: 'Last Auth', render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;

  const assigned   = data.filter(r => r.status === 'Assigned').length;
  const unassigned = data.filter(r => r.status === 'Unassigned').length;
  const lost       = data.filter(r => r.status === 'Lost').length;
  const retired    = data.filter(r => r.status === 'Retired').length;
  const utilPct    = data.length ? Math.round((assigned / data.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Assets' }, { label: 'YubiKeys' }]}
        title="YubiKeys"
        description="Hardware token management"
        action={<div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button className="btn-secondary flex items-center gap-1.5 text-red-300 border-red-500/40" onClick={() => removeMany.mutate(selectedIds)} disabled={removeMany.isPending}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <button className="btn-primary" onClick={openCreate}><Plus size={15} />Add YubiKey</button>
        </div>}
      />
      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={`${utilPct}%`}
            sublabel="assigned"
            segments={[
              { label: 'Assigned',   value: assigned,   color: 'green'  },
              { label: 'Unassigned', value: unassigned, color: 'yellow' },
              { label: 'Lost',       value: lost,       color: 'red'    },
              { label: 'Retired',    value: retired,    color: 'muted'  },
            ]}
          />
          <div className="flex flex-wrap gap-2 items-start">
            <StatTile label="Total YubiKeys" value={data.length} />
            <StatTile label="Lost"           value={lost}   color={lost > 0 ? 'red' : 'default'} />
          </div>
        </div>
      </StatusDashboard>
      <div className="sc-workbar mb-4 mt-2">
        <div className="sc-workbar-meta">
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <KeyRound size={12} />
            Token custody
          </span>
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <ShieldCheck size={12} />
            {assigned} assigned / {unassigned} ready
          </span>
        </div>
        <div className="text-xs text-scorva-muted">
          {lost > 0 ? `${lost} token${lost > 1 ? 's are' : ' is'} in a loss state and require follow-up.` : 'No active loss records.'}
        </div>
      </div>
      <div className="sc-surface-block mt-6">
      <Table columns={cols} data={data} getRowClass={getYkRowClass} emptyText="No YubiKeys registered." />
      {modal && (
        <Modal title={modal === 'create' ? 'Add YubiKey' : 'Edit YubiKey'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <YKForm value={form} onChange={setForm} />
            {mutationError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {mutationError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {delId && <ConfirmDialog title="Delete YubiKey" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
      </div>
    </div>
  );
}
