import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader     from '../components/ui/PageHeader';
import Table          from '../components/ui/Table';
import Badge          from '../components/ui/Badge';
import Modal          from '../components/ui/Modal';
import ConfirmDialog  from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Pencil, Trash2, Search, ShieldCheck, LaptopMinimal } from 'lucide-react';
import UserSelect from '../components/ui/UserSelect';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';

const TYPES    = ['Laptop','Server','TACLANE','Switch','Workstation','Other'];
const STATUSES = ['Available','Checked Out','Awaiting Destruction','Lost','Active','Maintenance','Decommissioned'];
const CLASSES  = ['Unclassified','Secret','Top Secret'];

const EMPTY = {
  asset_tag: '', hostname: '', type: 'Workstation', os: '', ip: '',
  username: '', location: '', classification: 'Unclassified',
  status: 'Available', system: '', key_expiry: '', notes: '',
};

/* ── TACLANE key expiry indicator ── */
function getWsRowClass(row) {
  const s = (row.status || '').toLowerCase();
  if (s === 'lost') return 'row-critical';
  if (s === 'awaiting destruction') return 'row-high';
  if (s === 'decommissioned') return 'row-medium';
  return '';
}

function ExpiryCell({ dateStr }) {
  if (!dateStr) return <span className="text-xs text-scorva-muted">—</span>;
  const days = Math.floor((new Date(dateStr) - new Date()) / 86_400_000);
  if (days < 0)   return <span className="font-mono text-[11px] text-red-400">✕ Expired</span>;
  if (days <= 30) return <span className="font-mono text-[11px] text-yellow-400">⏱ {days}d left</span>;
  return <span className="font-mono text-[11px] text-emerald-400">✓ {new Date(dateStr).toLocaleDateString()}</span>;
}

/* ── Form ── */
function WSForm({ value, onChange, systems }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  const isTaclane = value.type === 'TACLANE';
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-scorva-muted mb-1">ASSET TAG</label>
        <input className="input-base font-mono" placeholder="e.g. LT-0042" value={value.asset_tag || ''} onChange={e => f('asset_tag', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">HOSTNAME *</label>
        <input className="input-base font-mono" value={value.hostname} onChange={e => f('hostname', e.target.value)} required />
      </div>

      <div>
        <label className="block text-xs text-scorva-muted mb-1">TYPE</label>
        <select className="input-base" value={value.type} onChange={e => f('type', e.target.value)}>
          {TYPES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">OS</label>
        <input className="input-base" placeholder="e.g. Windows 11" value={value.os || ''} onChange={e => f('os', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">IP ADDRESS</label>
        <input className="input-base font-mono" value={value.ip || ''} onChange={e => f('ip', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">ASSIGNED TO</label>
        <UserSelect value={value.username || ''} onChange={v => f('username', v)} placeholder="Select user…" />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">LOCATION</label>
        <input className="input-base" value={value.location || ''} onChange={e => f('location', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">CLASSIFICATION</label>
        <select className="input-base" value={value.classification} onChange={e => f('classification', e.target.value)}>
          {CLASSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">STATUS</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">SYSTEM</label>
        <select className="input-base" value={value.system || ''} onChange={e => f('system', e.target.value)}>
          <option value="">— None —</option>
          {systems.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {isTaclane && (
        <div>
          <label className="block text-xs text-scorva-muted mb-1">KEY EXPIRATION</label>
          <input type="date" className="input-base" value={value.key_expiry || ''} onChange={e => f('key_expiry', e.target.value)} />
        </div>
      )}
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">NOTES</label>
        <textarea className="input-base resize-none" rows={2} value={value.notes || ''} onChange={e => f('notes', e.target.value)} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function WorkstationsPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';
  const { data = [], isLoading }         = useQuery({ queryKey: ['workstations', siteScopeKey],  queryFn: api.workstations.list });
  const { data: atoData = [] }           = useQuery({ queryKey: ['ato', siteScopeKey],           queryFn: api.ato.list });

  const systems = useMemo(() => atoData.map(r => r.system).filter(Boolean).sort(), [atoData]);

  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [editing,  setEditing]  = useState(null);
  const [delId,    setDelId]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [ftType,   setFtType]   = useState('');
  const [ftStatus, setFtStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [siteScopeKey]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['workstations'] });
  const create = useMutation({ mutationFn: api.workstations.create,                       onSuccess: () => { invalidate(); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.workstations.update(id, d), onSuccess: () => { invalidate(); setModal(null); } });
  const remove = useMutation({ mutationFn: api.workstations.remove,                       onSuccess: () => { invalidate(); setDelId(null); } });
  const removeMany = useMutation({
    mutationFn: api.workstations.bulkDelete,
    onSuccess: () => { invalidate(); setSelectedIds([]); },
  });

  function openCreate() { setForm(EMPTY); setModal('create'); }
  function openEdit(row) { setForm(row); setEditing(row.id); setModal('edit'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  /* ── Filtering ── */
  const shown = useMemo(() => {
    const term = search.toLowerCase();
    return data.filter(r =>
      (!term     || (r.hostname  || '').toLowerCase().includes(term) || (r.asset_tag || '').toLowerCase().includes(term)) &&
      (!ftType   || r.type   === ftType) &&
      (!ftStatus || r.status === ftStatus)
    );
  }, [data, search, ftType, ftStatus]);
  const shownIds = useMemo(() => shown.map(r => r.id), [shown]);
  const allShownSelected = shownIds.length > 0 && shownIds.every(id => selectedIds.includes(id));

  /* ── Dashboard counts ── */
  const available    = data.filter(r => r.status === 'Available').length;
  const checkedOut   = data.filter(r => r.status === 'Checked Out').length;
  const decommission = data.filter(r => r.status === 'Decommissioned').length;
  const lost         = data.filter(r => r.status === 'Lost').length;

  const cols = [
    {
      key: '_select',
      label: <input type="checkbox" checked={allShownSelected} onChange={() => {
        setSelectedIds(prev => allShownSelected
          ? prev.filter(id => !shownIds.includes(id))
          : [...new Set([...prev, ...shownIds])]);
      }} onClick={e => e.stopPropagation()} aria-label="Select all devices" />,
      width: 32,
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => setSelectedIds(prev => prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id])}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${row.hostname}`}
        />
      ),
    },
    { key: 'hostname', label: 'Hostname / Tag', render: (v, row) => (
      <div>
        <div className="font-mono text-xs text-scorva-text">{v}</div>
        {row.asset_tag && <div className="font-mono text-[10px] text-scorva-muted">{row.asset_tag}</div>}
        {row.type === 'TACLANE' && row.key_expiry && (
          <div className="mt-0.5"><ExpiryCell dateStr={row.key_expiry} /></div>
        )}
      </div>
    )},
    { key: 'type',           label: 'Type',        render: v => <Badge label={v} /> },
    { key: 'username',       label: 'Assigned To', render: v => <span className="text-xs">{v || '—'}</span> },
    { key: 'status',         label: 'Status',      render: v => <Badge label={v} /> },
    { key: 'os',             label: 'OS',          render: v => <span className="text-xs">{v || '—'}</span> },
    { key: 'ip',             label: 'IP',          render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'location',       label: 'Location',    render: v => <span className="text-xs">{v || '—'}</span> },
    { key: 'system',         label: 'System',      render: v => v ? <span className="text-xs text-scorva-accent-light font-mono">{v}</span> : <span className="text-xs text-scorva-muted">—</span> },
    { key: 'classification', label: 'Class',       render: v => <Badge label={v || 'Unclassified'} /> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400   hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Assets' }, { label: 'Devices' }]}
        title="Devices"
        description="Endpoint inventory & compliance"
        action={<div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button className="btn-secondary flex items-center gap-1.5 text-red-300 border-red-500/40" onClick={() => removeMany.mutate(selectedIds)} disabled={removeMany.isPending}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}><Plus size={15} /> Add Device</button>
        </div>}
      />

      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={String(data.length)}
            sublabel="total"
            segments={[
              { label: 'Available',     value: available,    color: 'green'  },
              { label: 'Checked Out',   value: checkedOut,   color: 'yellow' },
              { label: 'Decommissioned',value: decommission, color: 'muted'  },
              { label: 'Lost',          value: lost,         color: 'red'    },
            ]}
          />
          <div className="flex flex-wrap gap-2 items-start">
            <StatTile label="Available"      value={available}    color="green" />
            <StatTile label="Checked Out"    value={checkedOut}   color={checkedOut   > 0 ? 'yellow' : 'default'} />
            <StatTile label="Decommissioned" value={decommission} color={decommission > 0 ? 'yellow' : 'default'} />
            <StatTile label="Lost"           value={lost}         color={lost         > 0 ? 'red'    : 'default'} />
          </div>
        </div>
      </StatusDashboard>

      <div className="sc-workbar mb-4 mt-2">
        <div className="sc-workbar-meta">
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <LaptopMinimal size={12} />
            Endpoint registry
          </span>
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <ShieldCheck size={12} />
            {systems.length} linked systems
          </span>
        </div>
        <div className="flex flex-wrap gap-2 flex-1 justify-end">
          <div className="relative flex-1 min-w-[180px] max-w-[22rem]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-scorva-muted pointer-events-none" />
            <input
              className="input-base pl-7 text-xs"
              placeholder="Search hostname or asset tag…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input-base text-xs w-36" value={ftType} onChange={e => setFtType(e.target.value)}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select className="input-base text-xs w-44" value={ftStatus} onChange={e => setFtStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="sc-surface-block">
        <Table
          columns={cols}
          data={shown}
          onRowClick={openEdit}
          getRowClass={getWsRowClass}
          emptyText="No devices found."
        />
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'Add Device' : 'Edit Device'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <WSForm value={form} onChange={setForm} systems={systems} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {delId && <ConfirmDialog title="Delete Device" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
    </div>
  );
}
