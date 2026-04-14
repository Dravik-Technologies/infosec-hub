import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import PageHeader    from '../components/ui/PageHeader';
import Table         from '../components/ui/Table';
import Badge         from '../components/ui/Badge';
import Modal         from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';

const EMPTY = { serial: '', model: '', status: 'Unassigned', username: '', issued: '' };

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
    </div>
  );
}

export default function YubiKeysPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['yubikeys'], queryFn: api.yubikeys.list });
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId]     = useState(null);

  const create = useMutation({ mutationFn: api.yubikeys.create, onSuccess: () => { qc.invalidateQueries(['yubikeys']); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.yubikeys.update(id, d), onSuccess: () => { qc.invalidateQueries(['yubikeys']); setModal(null); } });
  const remove = useMutation({ mutationFn: api.yubikeys.remove, onSuccess: () => { qc.invalidateQueries(['yubikeys']); setDelId(null); } });

  function openCreate() { setForm(EMPTY); setModal('create'); }
  function openEdit(row) { setForm(row); setEditing(row.id); setModal('edit'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  const cols = [
    { key: 'id',       label: 'ID',     width: 90, render: v => <span className="font-mono text-xs text-scorva-muted">{v}</span> },
    { key: 'serial',   label: 'Serial', render: v => <span className="font-mono text-xs">{v}</span> },
    { key: 'model',    label: 'Model' },
    { key: 'status',   label: 'Status', render: v => <Badge label={v} /> },
    { key: 'username', label: 'Assigned To' },
    { key: 'issued',   label: 'Issued',   render: v => <span className="font-mono text-xs">{v || '—'}</span> },
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
      <PageHeader title="YubiKeys" description="Hardware token management"
        action={<button className="btn-primary" onClick={openCreate}><Plus size={15} />Add YubiKey</button>}
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
      <div className="mt-6">
      <Table columns={cols} data={data} />
      {modal && (
        <Modal title={modal === 'create' ? 'Add YubiKey' : 'Edit YubiKey'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <YKForm value={form} onChange={setForm} />
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
