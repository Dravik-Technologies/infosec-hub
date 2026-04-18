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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';

const EMPTY = { product: '', vendor: '', seats: 0, used: 0, status: 'Active', expires: '', cost: '' };

function LicForm({ value, onChange }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Product *</label>
        <input className="input-base" value={value.product} onChange={e => f('product', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Vendor</label>
        <input className="input-base" value={value.vendor || ''} onChange={e => f('vendor', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Status</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {['Active','Expired','Pending Renewal'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Seats</label>
        <input type="number" className="input-base" value={value.seats} onChange={e => f('seats', +e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Used</label>
        <input type="number" className="input-base" value={value.used} onChange={e => f('used', +e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Expires</label>
        <input type="date" className="input-base" value={value.expires || ''} onChange={e => f('expires', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Annual Cost</label>
        <input className="input-base" placeholder="e.g. $12,000" value={value.cost || ''} onChange={e => f('cost', e.target.value)} />
      </div>
    </div>
  );
}

export default function LicensesPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';
  const { data = [], isLoading } = useQuery({ queryKey: ['licenses', siteScopeKey], queryFn: api.licenses.list });
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId]     = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => { setSelectedIds([]); }, [siteScopeKey]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['licenses'] });
  const create = useMutation({ mutationFn: api.licenses.create, onSuccess: () => { invalidate(); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.licenses.update(id, d), onSuccess: () => { invalidate(); setModal(null); } });
  const remove = useMutation({ mutationFn: api.licenses.remove, onSuccess: () => { invalidate(); setDelId(null); } });
  const removeMany = useMutation({
    mutationFn: api.licenses.bulkDelete,
    onSuccess: () => { invalidate(); setSelectedIds([]); },
  });

  function openCreate() { setForm(EMPTY); setModal('create'); }
  function openEdit(row) { setForm(row); setEditing(row.id); setModal('edit'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  const shownIds = useMemo(() => data.map(r => r.id), [data]);
  const allShownSelected = shownIds.length > 0 && shownIds.every(id => selectedIds.includes(id));

  const cols = [
    {
      key: '_select',
      label: <input type="checkbox" checked={allShownSelected} onChange={() => {
        setSelectedIds(prev => allShownSelected ? [] : [...new Set([...prev, ...shownIds])]);
      }} onClick={e => e.stopPropagation()} aria-label="Select all licenses" />,
      width: 32,
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => setSelectedIds(prev => prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id])}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${row.product}`}
        />
      ),
    },
    { key: 'id',      label: 'ID',      width: 90, render: v => <span className="font-mono text-xs text-scorva-muted">{v}</span> },
    { key: 'product', label: 'Product' },
    { key: 'vendor',  label: 'Vendor' },
    { key: 'status',  label: 'Status',  render: v => <Badge label={v} /> },
    { key: 'seats',   label: 'Seats',   render: (v, row) => `${row.used}/${v}` },
    { key: 'expires', label: 'Expires', render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'cost',    label: 'Cost' },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;

  const active      = data.filter(r => r.status === 'Active').length;
  const expired     = data.filter(r => r.status === 'Expired').length;
  const pending     = data.filter(r => r.status === 'Pending Renewal').length;
  const totalSeats  = data.reduce((s, r) => s + (r.seats || 0), 0);
  const usedSeats   = data.reduce((s, r) => s + (r.used  || 0), 0);
  const utilPct     = totalSeats ? Math.round((usedSeats / totalSeats) * 100) : 0;

  return (
    <div>
      <PageHeader title="Licenses" description="Software license management"
        action={<div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button className="btn-secondary flex items-center gap-1.5 text-red-300 border-red-500/40" onClick={() => removeMany.mutate(selectedIds)} disabled={removeMany.isPending}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <button className="btn-primary" onClick={openCreate}><Plus size={15} />Add License</button>
        </div>}
      />
      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={`${active}`}
            sublabel="active"
            segments={[
              { label: 'Active',          value: active,  color: 'green'  },
              { label: 'Expired',         value: expired, color: 'red'    },
              { label: 'Pending Renewal', value: pending, color: 'yellow' },
            ]}
          />
          {/* Seat utilization */}
          <div className="flex-1 min-w-[200px] flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest">
              Seat Utilization
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 rounded-full bg-scorva-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all duration-500"
                  style={{ width: `${utilPct}%` }}
                />
              </div>
              <span className="font-mono text-sm font-bold text-scorva-text tabular-nums shrink-0">
                {utilPct}%
              </span>
            </div>
            <p className="text-xs text-scorva-muted">{usedSeats} of {totalSeats} seats in use</p>
          </div>
          <StatTile label="Total Licenses" value={data.length} />
        </div>
      </StatusDashboard>
      <div className="mt-6">
      <Table columns={cols} data={data} />
      {modal && (
        <Modal title={modal === 'create' ? 'Add License' : 'Edit License'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <LicForm value={form} onChange={setForm} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {delId && <ConfirmDialog title="Delete License" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
      </div>
    </div>
  );
}
