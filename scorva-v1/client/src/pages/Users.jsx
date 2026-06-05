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
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Shield, Users2, Building2 } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';
import BarList    from '../components/ui/BarList';

const ADMIN_ROLES = ['Corporate Admin', 'Site Admin'];

const BASELINES = [
  'IAT Level I', 'IAT Level II', 'IAT Level III',
  'IAM Level I', 'IAM Level II', 'IAM Level III',
  'IASAE Level I', 'IASAE Level II', 'IASAE Level III',
  'CSSP Analyst', 'CSSP Infrastructure Support', 'CSSP Incident Responder',
  'CSSP Auditor', 'CSSP Manager',
];

const EMPTY = {
  id: '',
  name: '', title: '', username: '', email: '', password: '',
  role: 'Viewer', site: '', siteIDs: [], status: 'Active',
  training_compliant: false, training_due: '',
  dod_8140: { baseline: '', cert_name: '', cert_expiry: '', status: 'Pending' },
};

function getUserRowClass(row) {
  if ((row.status || '').toLowerCase() === 'inactive') return 'row-medium';
  const trained = row.training_compliant || row.trainingCompliant;
  if (!trained) return 'row-low';
  return '';
}

function normalizeUserForForm(row) {
  return {
    ...row,
    id: row.id || row._id || '',
    siteIDs: Array.isArray(row.siteIDs) && row.siteIDs.length
      ? row.siteIDs
      : (Array.isArray(row.siteIds) && row.siteIds.length ? row.siteIds : (row.site ? [row.site] : [])),
    site: row.site || row.siteID || row.siteId || '',
    password: '',
    training_compliant: row.training_compliant ?? row.trainingCompliant ?? false,
    training_due: row.training_due ?? row.trainingDue ?? '',
    dod_8140: row.dod_8140 ?? row.dod8140 ?? { baseline: '', cert_name: '', cert_expiry: '', status: 'Pending' },
  };
}

/* ── Edit / Create Form ── */
function UserForm({ value, onChange, isNew, sites }) {
  const f   = (k, v)      => onChange({ ...value, [k]: v });
  const f8  = (k, v)      => onChange({ ...value, dod_8140: { ...value.dod_8140, [k]: v } });
  const is8140 = ADMIN_ROLES.includes(value.role);
  const supportsMultiSite = value.role !== 'Corporate Admin';

  function handleSitesChange(e) {
    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
    onChange({
      ...value,
      siteIDs: selected,
      siteID: selected[0] || '',
      site: selected[0] || '',
    });
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-scorva-muted mb-1">ID *</label>
        <input
          className="input-base font-mono"
          value={value.id || ''}
          onChange={e => f('id', e.target.value)}
          required={isNew}
          placeholder="e.g. USR-001"
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">FULL NAME *</label>
        <input className="input-base" value={value.name} onChange={e => f('name', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">TITLE</label>
        <input className="input-base" placeholder="e.g. Cyber Security Analyst" value={value.title || ''} onChange={e => f('title', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">{supportsMultiSite ? 'SITES' : 'SITE'}</label>
        {supportsMultiSite ? (
          <>
            <select
              multiple
              className="input-base min-h-[102px]"
              value={Array.isArray(value.siteIDs) ? value.siteIDs : (value.site ? [value.site] : [])}
              onChange={handleSitesChange}
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <p className="text-[10px] text-scorva-muted mt-1">Hold Ctrl/Cmd to select multiple sites.</p>
          </>
        ) : (
          <select className="input-base" value={value.site || ''} onChange={e => f('site', e.target.value)}>
            <option value="">— None —</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">USERNAME *</label>
        <input className="input-base font-mono" value={value.username} onChange={e => f('username', e.target.value)} required={isNew} disabled={!isNew} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">EMAIL *</label>
        <input type="email" className="input-base" value={value.email} onChange={e => f('email', e.target.value)} required={isNew} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">{isNew ? 'PASSWORD *' : 'NEW PASSWORD'}</label>
        <input type="password" className="input-base" value={value.password || ''} onChange={e => f('password', e.target.value)} required={isNew} placeholder={isNew ? '' : 'Leave blank to keep current'} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">ROLE</label>
        <select className="input-base" value={value.role} onChange={e => f('role', e.target.value)}>
          {['Viewer','Analyst','Operator','Site Admin','Corporate Admin'].map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">STATUS</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {['Active','Inactive','Suspended'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Annual Training ── */}
      <div className="col-span-2 pt-2 border-t border-scorva-border">
        <p className="text-xs font-semibold text-scorva-muted mb-3 uppercase tracking-wider">Annual Training</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-scorva-muted mb-1">TRAINING DUE DATE</label>
            <input type="date" className="input-base" value={value.training_due || ''} onChange={e => f('training_due', e.target.value)} />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <input type="checkbox" id="training_compliant" checked={value.training_compliant || false} onChange={e => f('training_compliant', e.target.checked)} className="accent-scorva-accent w-4 h-4" />
            <label htmlFor="training_compliant" className="text-xs text-scorva-muted">Training Complete</label>
          </div>
        </div>
      </div>

      {/* ── DoD 8140 (admins only) ── */}
      {is8140 && (
        <div className="col-span-2 pt-2 border-t border-scorva-border">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={12} className="text-scorva-accent" />
            <p className="text-xs font-semibold text-scorva-muted uppercase tracking-wider">DoD 8140 Compliance</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-scorva-muted mb-1">BASELINE</label>
              <select className="input-base" value={value.dod_8140?.baseline || ''} onChange={e => f8('baseline', e.target.value)}>
                <option value="">— Select —</option>
                {BASELINES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-scorva-muted mb-1">CERTIFICATION</label>
              <input className="input-base" placeholder="e.g. CompTIA Security+" value={value.dod_8140?.cert_name || ''} onChange={e => f8('cert_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-scorva-muted mb-1">CERT EXPIRY</label>
              <input type="date" className="input-base" value={value.dod_8140?.cert_expiry || ''} onChange={e => f8('cert_expiry', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-scorva-muted mb-1">8140 STATUS</label>
              <select className="input-base" value={value.dod_8140?.status || 'Pending'} onChange={e => f8('status', e.target.value)}>
                {['Compliant','Pending','Non-Compliant'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Detail View Modal ── */
function UserDetailModal({ user, onEdit, onClose }) {
  const isAdmin = ADMIN_ROLES.includes(user.role);
  const today   = new Date().toISOString().split('T')[0];
  const trainingDue = user.training_due ?? user.trainingDue;
  const trainingCompliant = user.training_compliant ?? user.trainingCompliant;
  const dod8140 = user.dod_8140 ?? user.dod8140;
  const trainingOverdue = trainingDue && trainingDue < today && !trainingCompliant;
  const certExpired = dod8140?.cert_expiry && dod8140.cert_expiry < today;

  function Row({ label, value, mono }) {
    return (
      <div className="flex justify-between items-start py-2 border-b border-scorva-border/50 last:border-0">
        <span className="text-xs text-scorva-muted w-36 shrink-0">{label}</span>
        <span className={`text-xs text-scorva-text text-right ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
      </div>
    );
  }

  return (
    <Modal title="User Details" onClose={onClose}>
      <div className="space-y-5">
        {/* Identity */}
        <div>
          <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest mb-2">Identity</p>
          <Row label="ID"       value={user.id}       mono />
          <Row label="Name"     value={user.name} />
          <Row label="Title"    value={user.title} />
          <Row label="Username" value={user.username}  mono />
          <Row label="Email"    value={user.email} />
          <Row label="Sites"    value={Array.isArray(user.siteIDs) && user.siteIDs.length ? user.siteIDs.join(', ') : (Array.isArray(user.siteIds) && user.siteIds.length ? user.siteIds.join(', ') : user.site)} />
        </div>

        {/* Access */}
        <div>
          <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest mb-2">Access</p>
          <div className="flex justify-between items-start py-2 border-b border-scorva-border/50">
            <span className="text-xs text-scorva-muted w-36 shrink-0">Role</span>
            <Badge label={user.role} />
          </div>
          <div className="flex justify-between items-start py-2 border-b border-scorva-border/50">
            <span className="text-xs text-scorva-muted w-36 shrink-0">Status</span>
            <Badge label={user.status} />
          </div>
          <Row label="Last Login" value={(user.last_login || user.lastLogin) ? (user.last_login || user.lastLogin).split('T')[0] : null} mono />
        </div>

        {/* Training */}
        <div>
          <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest mb-2">Annual Training</p>
          <div className="flex justify-between items-start py-2 border-b border-scorva-border/50">
            <span className="text-xs text-scorva-muted w-36 shrink-0">Status</span>
            {trainingCompliant
              ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={13} /> Complete</span>
              : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={13} /> {trainingOverdue ? 'Overdue' : 'Incomplete'}</span>
            }
          </div>
          <Row label="Due Date" value={trainingDue} mono />
        </div>

        {/* DoD 8140 — admins only */}
        {isAdmin && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={12} className="text-scorva-accent" />
              <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest">DoD 8140 Compliance</p>
            </div>
            <div className="flex justify-between items-start py-2 border-b border-scorva-border/50">
              <span className="text-xs text-scorva-muted w-36 shrink-0">8140 Status</span>
              {dod8140?.status
                ? <Badge label={dod8140.status} />
                : <span className="text-xs text-scorva-muted">—</span>
              }
            </div>
            <Row label="Baseline"      value={dod8140?.baseline} />
            <Row label="Certification" value={dod8140?.cert_name} />
            <div className="flex justify-between items-start py-2">
              <span className="text-xs text-scorva-muted w-36 shrink-0">Cert Expiry</span>
              <span className={`text-xs font-mono ${certExpired ? 'text-red-400' : 'text-scorva-text'}`}>
                {dod8140?.cert_expiry || '—'}
                {certExpired && ' (Expired)'}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1 border-t border-scorva-border">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary flex items-center gap-1.5" onClick={onEdit}><Pencil size={13} /> Edit</button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading }   = useQuery({ queryKey: ['users'], queryFn: api.users.list });
  const { data: sites = [] }       = useQuery({ queryKey: ['sites'], queryFn: api.sites.list });

  const [modal,    setModal]    = useState(null);   // 'create' | 'edit'
  const [detail,   setDetail]   = useState(null);   // user row for detail view
  const [form,     setForm]     = useState(EMPTY);
  const [editing,  setEditing]  = useState(null);
  const [delId,    setDelId]    = useState(null);
  const [formError, setFormError] = useState('');

  const isAdmin = me?.role === 'Corporate Admin';

  const create = useMutation({
    mutationFn: api.users.create,
    onSuccess: () => { qc.invalidateQueries(['users']); setModal(null); setFormError(''); },
    onError: (err) => setFormError(err?.response?.data?.error || 'Save failed. Please check the fields and try again.'),
  });
  const update = useMutation({
    mutationFn: ({ id, d }) => api.users.update(id, d),
    onSuccess: () => { qc.invalidateQueries(['users']); setModal(null); setFormError(''); },
    onError: (err) => setFormError(err?.response?.data?.error || 'Save failed. Please check the fields and try again.'),
  });
  const remove = useMutation({ mutationFn: api.users.remove, onSuccess: () => { qc.invalidateQueries(['users']); setDelId(null); } });

  function openCreate() { setForm(EMPTY); setFormError(''); setModal('create'); }
  function openEdit(row) {
    setDetail(null);
    setForm(normalizeUserForForm(row));
    setEditing(row.id);
    setFormError('');
    setModal('edit');
  }
  function handleSubmit(e) {
    e.preventDefault();
    const d = { ...form };
    if (!d.id) d.id = editing || '';
    if (modal === 'edit' && !d.id) {
      setFormError('User ID is missing for this record. Re-open the user and try again.');
      return;
    }
    if (!Array.isArray(d.siteIDs)) d.siteIDs = d.site ? [d.site] : [];
    d.site = d.siteIDs[0] || d.site || '';
    if (!d.password) delete d.password;
    if (modal === 'create') create.mutate(d);
    else update.mutate({ id: editing, d });
  }

  const today = new Date().toISOString().split('T')[0];

  const cols = [
    { key: 'id',       label: 'ID',           width: 90,  render: v => <span className="font-mono text-xs text-scorva-muted">{v}</span> },
    { key: 'name',     label: 'Name',          render: v => <span className="text-xs font-medium text-scorva-text">{v}</span> },
    { key: 'title',    label: 'Title',          render: v => <span className="text-xs text-scorva-muted">{v || '—'}</span> },
    { key: 'siteIDs',  label: 'Sites',          render: (v, row) => <span className="text-xs">{Array.isArray(v) && v.length ? v.join(', ') : (Array.isArray(row.siteIds) && row.siteIds.length ? row.siteIds.join(', ') : (row.site || '—'))}</span> },
    { key: 'username', label: 'Username',       render: v => <span className="font-mono text-xs">{v}</span> },
    { key: 'email',    label: 'Email',          render: v => <span className="text-xs">{v}</span> },
    { key: 'role',     label: 'Role',           render: v => <Badge label={v} /> },
    { key: 'status',   label: 'Status',         render: v => <Badge label={v} /> },
    { key: 'training_compliant', label: 'Training', width: 80, render: (v, row) => {
      const trainingCompliant = v ?? row.trainingCompliant;
      const trainingDue = row.training_due ?? row.trainingDue;
      const overdue = !trainingCompliant && trainingDue && trainingDue < today;
      return trainingCompliant
        ? <CheckCircle size={15} className="text-emerald-400" />
        : <XCircle size={15} className={overdue ? 'text-red-400' : 'text-yellow-400'} />;
    }},
    { key: 'training_due', label: 'Training Due', render: (v, row) => {
      const trainingDue = v ?? row.trainingDue;
      return <span className={`font-mono text-xs ${trainingDue && trainingDue < today ? 'text-red-400' : ''}`}>{trainingDue || '—'}</span>;
    }},
    { key: 'last_login',   label: 'Last Login',   render: (v, row) => {
      const lastLogin = v ?? row.lastLogin;
      return <span className="font-mono text-xs">{lastLogin ? lastLogin.split('T')[0] : '—'}</span>;
    }},
    ...(isAdmin ? [{ key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        {row.id !== me?.id && <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>}
      </div>
    )}] : []),
  ];

  if (isLoading) return <LoadingSpinner />;

  const active    = data.filter(r => r.status === 'Active').length;
  const inactive  = data.filter(r => r.status === 'Inactive').length;
  const suspended = data.filter(r => r.status === 'Suspended').length;

  const corpAdmin = data.filter(r => r.role === 'Corporate Admin').length;
  const siteAdmin = data.filter(r => r.role === 'Site Admin').length;
  const operator  = data.filter(r => r.role === 'Operator').length;
  const analyst   = data.filter(r => r.role === 'Analyst').length;
  const viewer    = data.filter(r => r.role === 'Viewer').length;

  const activeUsers     = data.filter(r => r.status === 'Active');
  const trainedCount    = activeUsers.filter(r => r.training_compliant ?? r.trainingCompliant).length;
  const notTrainedCount = activeUsers.length - trainedCount;
  const trainingPct     = activeUsers.length ? Math.round((trainedCount / activeUsers.length) * 100) : 0;
  const representedSites = new Set(
    data.flatMap(r => {
      if (Array.isArray(r.siteIDs) && r.siteIDs.length) return r.siteIDs;
      if (Array.isArray(r.siteIds) && r.siteIds.length) return r.siteIds;
      return r.site ? [r.site] : [];
    }).filter(Boolean)
  ).size;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Assets' }, { label: 'Users' }]}
        title="Users"
        description="Account & access management"
        action={isAdmin && <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}><Plus size={15} /> Add User</button>}
      />

      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={String(active)}
            sublabel="active"
            segments={[
              { label: 'Active',    value: active,    color: 'green'  },
              { label: 'Inactive',  value: inactive,  color: 'yellow' },
              { label: 'Suspended', value: suspended, color: 'red'    },
            ]}
          />
          <div className="flex-1 min-w-[180px]">
            <BarList
              title="Roles"
              bars={[
                { label: 'Corporate Admin', value: corpAdmin, color: 'blue'   },
                { label: 'Site Admin',      value: siteAdmin, color: 'purple' },
                { label: 'Operator',        value: operator,  color: 'orange' },
                { label: 'Analyst',         value: analyst,   color: 'yellow' },
                { label: 'Viewer',          value: viewer,    color: 'muted'  },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 min-w-[200px]">
            <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest">Annual Training</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 rounded-full bg-scorva-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${trainingPct >= 80 ? 'bg-emerald-400' : trainingPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${trainingPct}%` }}
                />
              </div>
              <span className={`font-mono text-sm font-bold tabular-nums shrink-0 ${trainingPct >= 80 ? 'text-emerald-400' : trainingPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {trainingPct}%
              </span>
            </div>
            <p className="text-xs text-scorva-muted">{trainedCount} of {activeUsers.length} active users trained</p>
            {notTrainedCount > 0 && <p className="text-xs text-red-400">{notTrainedCount} user{notTrainedCount > 1 ? 's' : ''} overdue</p>}
          </div>
          <StatTile label="Total Users" value={data.length} />
        </div>
      </StatusDashboard>

      <div className="sc-workbar mb-4">
        <div className="sc-workbar-meta">
          <span className="sc-workbar-pill">Access Directory</span>
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <Users2 size={12} />
            {data.length} accounts
          </span>
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <Building2 size={12} />
            {representedSites} sites represented
          </span>
        </div>
        <div className="text-xs text-scorva-muted">
          {notTrainedCount > 0 ? `${notTrainedCount} training gap${notTrainedCount > 1 ? 's' : ''} require follow-up.` : 'Training posture is currently clean.'}
        </div>
      </div>

      <div className="sc-surface-block">
        <Table
          columns={cols}
          data={data}
          onRowClick={row => setDetail(row)}
          getRowClass={getUserRowClass}
          emptyText="No users found."
        />
      </div>

      {/* ── Detail Modal ── */}
      {detail && (
        <UserDetailModal
          user={detail}
          onClose={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
        />
      )}

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <Modal title={modal === 'create' ? 'Add User' : 'Edit User'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <UserForm value={form} onChange={setForm} isNew={modal === 'create'} sites={sites} />
            {formError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {delId && <ConfirmDialog title="Delete User" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
    </div>
  );
}
