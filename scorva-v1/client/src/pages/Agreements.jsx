import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader    from '../components/ui/PageHeader';
import Table         from '../components/ui/Table';
import Badge         from '../components/ui/Badge';
import Modal         from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Pencil, Trash2, Files, FileCheck2 } from 'lucide-react';
import UserSelect from '../components/ui/UserSelect';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';
import BarList    from '../components/ui/BarList';
import { getRecordSiteLabel, guardSiteScopedCreate, isAllSitesView } from '../utils/siteSelectionGuard';

/* ── Document taxonomy ─────────────────────────────────── */
const DOC_TYPES = {
  Memorandum: [
    'MOU',
    'MOA',
  ],
  'Appointment Letter': [
    'ISSO Appointment Letter',
    'Alternate ISSO Appointment Letter',
    'ISSM Appointment Letter',
    'System Owner Appointment Letter',
    'AO Appointment Letter',
    'Security Manager Appointment Letter',
    'Data Transfer Agent (DTA) Appointment Letter',
    'Media Custodian Appointment Letter',
    'Key Management Officer (KMO) Appointment Letter',
    'COR Appointment Letter',
    'Other Appointment Letter',
  ],
  Agreement: [
    'ISA',
    'User Agreement',
    'Privileged User Agreement',
    'Data Transfer Agreement',
    'Data Transfer Agent Agreement',
    'Media Custodian Agreement',
    'Remote Access Agreement',
    'Contractor Agreement',
    'Foreign National Agreement',
    'NDA',
    'SLA',
    'Rules of Behavior (RoB)',
    'AUP Acknowledgment',
    'Other Agreement',
  ],
};

const CATEGORIES = Object.keys(DOC_TYPES);
const ALL_TYPES  = Object.values(DOC_TYPES).flat();
const STATUSES   = ['Active', 'Pending', 'Expired', 'Superseded', 'Terminated'];

function getAgreementRowClass(row) {
  const s = (row.status || '').toLowerCase();
  if (s === 'expired' || s === 'terminated') return 'row-critical';
  if (s === 'pending' || s === 'superseded') return 'row-medium';
  return '';
}

function categoryForType(type) {
  for (const [cat, types] of Object.entries(DOC_TYPES)) {
    if (types.includes(type)) return cat;
  }
  return 'Agreement';
}

const EMPTY = {
  title: '', category: 'Agreement', type: 'ISA', status: 'Active',
  signed: '', expires: '', parties: '', assigned_to: '', notes: '',
};

/* ── Form ── */
function DocForm({ value, onChange }) {
  const f = (k, v) => onChange({ ...value, [k]: v });

  function handleCategoryChange(cat) {
    const firstType = DOC_TYPES[cat]?.[0] || '';
    onChange({ ...value, category: cat, type: firstType });
  }
  function handleTypeChange(type) {
    onChange({ ...value, type, category: categoryForType(type) });
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">TITLE *</label>
        <input className="input-base" placeholder="e.g. Memorandum of Understanding with IT Department" value={value.title} onChange={e => f('title', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">CATEGORY</label>
        <select className="input-base" value={value.category} onChange={e => handleCategoryChange(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">TYPE</label>
        <select className="input-base" value={value.type} onChange={e => handleTypeChange(e.target.value)}>
          {(DOC_TYPES[value.category] || ALL_TYPES).map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">STATUS</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">ASSIGNED TO</label>
        <UserSelect value={value.assigned_to || ''} onChange={v => f('assigned_to', v)} placeholder="Select user…" />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">SIGNED DATE</label>
        <input type="date" className="input-base" value={value.signed || ''} onChange={e => f('signed', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">EXPIRES</label>
        <input type="date" className="input-base" value={value.expires || ''} onChange={e => f('expires', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">PARTIES / ORGANIZATIONS</label>
        <input className="input-base" placeholder="e.g. HQ USAREUR, G6" value={value.parties || ''} onChange={e => f('parties', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">NOTES</label>
        <textarea className="input-base resize-none" rows={3} placeholder="e.g. Key terms, renewal conditions, points of contact..." value={value.notes || ''} onChange={e => f('notes', e.target.value)} />
      </div>
    </div>
  );
}

/* ── Detail Modal ── */
function DocDetailModal({ doc, onEdit, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const isExpired = doc.expires && doc.expires < today;

  function Row({ label, value, mono, highlight }) {
    return (
      <div className="flex justify-between items-start py-2 border-b border-scorva-border/50 last:border-0">
        <span className="text-xs text-scorva-muted w-36 shrink-0">{label}</span>
        <span className={`text-xs text-right ${mono ? 'font-mono' : ''} ${highlight ? highlight : 'text-scorva-text'}`}>
          {value || '—'}
        </span>
      </div>
    );
  }

  return (
    <Modal title="Document Details" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest mb-2">Document</p>
          <Row label="ID"    value={doc.id}    mono />
          <Row label="Title" value={doc.title} />
          <div className="flex justify-between items-start py-2 border-b border-scorva-border/50">
            <span className="text-xs text-scorva-muted w-36 shrink-0">Category</span>
            <Badge label={doc.category} />
          </div>
          <Row label="Type"        value={doc.type} />
          <div className="flex justify-between items-start py-2 border-b border-scorva-border/50">
            <span className="text-xs text-scorva-muted w-36 shrink-0">Status</span>
            <Badge label={doc.status} />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest mb-2">Parties & Assignment</p>
          <Row label="Assigned To" value={doc.assigned_to} />
          <Row label="Parties"     value={doc.parties} />
        </div>

        <div>
          <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest mb-2">Dates</p>
          <Row label="Signed"  value={doc.signed}  mono />
          <Row label="Expires" value={doc.expires} mono highlight={isExpired ? 'text-red-400' : ''} />
          {isExpired && <p className="text-xs text-red-400 mt-1">This document has expired.</p>}
        </div>

        {doc.notes && (
          <div>
            <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest mb-2">Notes</p>
            <p className="text-xs text-scorva-text whitespace-pre-wrap">{doc.notes}</p>
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
export default function AgreementsPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const showSiteContext = isAllSitesView(user, selectedSite);
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';
  const { data = [], isLoading } = useQuery({ queryKey: ['agreements', siteScopeKey], queryFn: api.agreements.list });

  const [modal,   setModal]   = useState(null);
  const [detail,  setDetail]  = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId,   setDelId]   = useState(null);
  const [activeTab, setActiveTab] = useState('All');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['agreements'] });
  const create = useMutation({ mutationFn: api.agreements.create, onSuccess: () => { invalidate(); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.agreements.update(id, d), onSuccess: () => { invalidate(); setModal(null); } });
  const remove = useMutation({ mutationFn: api.agreements.remove, onSuccess: () => { invalidate(); setDelId(null); } });

  function openCreate() {
    if (!guardSiteScopedCreate({ user, selectedSite, entityLabel: 'document record' })) return;
    setForm(EMPTY);
    setModal('create');
  }
  function openEdit(row) {
    setDetail(null);
    setForm({ ...row, category: row.category || categoryForType(row.type) });
    setEditing(row.id);
    setModal('edit');
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  /* ── Normalize legacy records that predate category field ── */
  const normalized = useMemo(() =>
    data.map(r => ({ ...r, category: r.category || categoryForType(r.type) })),
    [data]
  );

  const shown = activeTab === 'All'
    ? normalized
    : normalized.filter(r => r.category === activeTab);

  /* ── Stats ── */
  const today      = new Date().toISOString().split('T')[0];
  const active     = normalized.filter(r => r.status === 'Active').length;
  const expired    = normalized.filter(r => r.status === 'Expired' || (r.expires && r.expires < today && r.status === 'Active')).length;
  const pending    = normalized.filter(r => r.status === 'Pending').length;
  const other      = normalized.length - active - expired - pending;

  const TABS = ['All', ...CATEGORIES];

  const cols = [
    { key: 'id',       label: 'ID',          width: 90,  render: v => <span className="font-mono text-xs text-scorva-muted">{v}</span> },
    ...(showSiteContext ? [{
      key: '_site',
      label: 'Site',
      width: 110,
      render: (_, row) => <span className="font-mono text-xs text-scorva-accent-light">{getRecordSiteLabel(row)}</span>,
    }] : []),
    { key: 'title',    label: 'Title',        render: v => <span className="text-xs font-medium text-scorva-text">{v}</span> },
    { key: 'category', label: 'Category',     render: v => <Badge label={v} /> },
    { key: 'type',     label: 'Type',         render: v => <span className="text-xs text-scorva-muted">{v}</span> },
    { key: 'assigned_to', label: 'Assigned To', render: v => <span className="text-xs">{v || '—'}</span> },
    { key: 'status',   label: 'Status',       render: v => <Badge label={v} /> },
    { key: 'signed',   label: 'Signed',       render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'expires',  label: 'Expires',      render: (v) => {
      if (!v) return <span className="font-mono text-xs text-scorva-muted">—</span>;
      const expired = v < today;
      return <span className={`font-mono text-xs ${expired ? 'text-red-400' : ''}`}>{v}</span>;
    }},
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Records' }, { label: 'Documents' }]}
        title="Documents & Records"
        description="Memorandums, appointment letters, agreements & more"
        action={<button className="btn-primary flex items-center gap-1.5" onClick={openCreate}><Plus size={15} /> New Document</button>}
      />

      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={String(active)}
            sublabel="active"
            segments={[
              { label: 'Active',  value: active,  color: 'green'  },
              { label: 'Pending', value: pending, color: 'yellow' },
              { label: 'Expired', value: expired, color: 'red'    },
              { label: 'Other',   value: other,   color: 'muted'  },
            ]}
          />
          <div className="flex-1 min-w-[200px]">
            <BarList
              title="By Category"
              bars={CATEGORIES.map(cat => ({
                label: cat,
                value: normalized.filter(r => r.category === cat).length,
                color: cat === 'Memorandum' ? 'blue' : cat === 'Appointment Letter' ? 'teal' : 'purple',
              }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <StatTile label="Total"    value={normalized.length} />
            <StatTile label="Expired"  value={expired} color={expired > 0 ? 'red' : 'default'} />
            <StatTile label="Pending"  value={pending} color={pending > 0 ? 'yellow' : 'default'} />
          </div>
        </div>
      </StatusDashboard>

      {/* ── Category Tabs ── */}
      <div className="sc-workbar mb-4 mt-2">
        <div className="sc-workbar-meta">
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <Files size={12} />
            Records register
          </span>
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <FileCheck2 size={12} />
            {shown.length} in current view
          </span>
        </div>
        <div className="text-xs text-scorva-muted">
          Track agreements, appointments, and memorandums with expiring records surfaced quickly.
        </div>
      </div>

      <div className="sc-tab-rail mb-4 mt-1">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`sc-tab-pill ${
              activeTab === tab
                ? 'sc-tab-pill-active'
                : 'text-scorva-muted hover:text-scorva-text'
            }`}
          >
            {tab}
            <span className="ml-1.5 text-[10px] font-mono text-scorva-muted/60">
              ({tab === 'All' ? normalized.length : normalized.filter(r => r.category === tab).length})
            </span>
          </button>
        ))}
      </div>

      <div className="sc-surface-block">
        <Table
          columns={cols}
          data={shown}
          onRowClick={row => setDetail(row)}
          getRowClass={getAgreementRowClass}
          emptyText="No documents found."
        />
      </div>

      {/* ── Detail Modal ── */}
      {detail && (
        <DocDetailModal
          doc={detail}
          onClose={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
        />
      )}

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <Modal title={modal === 'create' ? 'New Document' : 'Edit Document'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DocForm value={form} onChange={setForm} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {delId && <ConfirmDialog title="Delete Document" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
    </div>
  );
}
