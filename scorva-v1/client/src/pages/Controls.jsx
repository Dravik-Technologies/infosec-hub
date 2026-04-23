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
import { Plus, Pencil, Trash2, Search, Upload, Download } from 'lucide-react';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';
import BarList    from '../components/ui/BarList';
import ImportControlsModal from '../components/ImportControlsModal';

/* ── NIST families for dropdown ── */
const NIST_FAMILIES = [
  'Access Control', 'Awareness and Training', 'Audit and Accountability',
  'Assessment, Authorization, and Monitoring', 'Configuration Management',
  'Contingency Planning', 'Identification and Authentication', 'Incident Response',
  'Maintenance', 'Media Protection', 'Physical and Environmental Protection',
  'Planning', 'Program Management', 'Personnel Security',
  'Personally Identifiable Information Processing and Transparency',
  'Risk Assessment', 'System and Services Acquisition',
  'System and Communications Protection', 'System and Information Integrity',
  'Supply Chain Risk Management',
];

const EMPTY = {
  id: '', title: '', family: '', status: 'Not Implemented', baseline: '',
  last_review: '', findings: 0, notes: '',
  description: '', implementation_guidance: '',
  conmon_status: 'Open', conmon_group: '', conmon_frequency: '',
};

/* ── Add / Edit form ── */
function ControlForm({ value, onChange, isNew }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      {isNew && (
        <div>
          <label className="block text-xs text-scorva-muted mb-1">CONTROL ID *</label>
          <input className="input-base font-mono" placeholder="e.g. SI-2, AC-6, CUSTOM-001" value={value.id} onChange={e => f('id', e.target.value)} required />
        </div>
      )}
      <div className={isNew ? '' : 'col-span-2'}>
        <label className="block text-xs text-scorva-muted mb-1">TITLE *</label>
        <input className="input-base" placeholder="e.g. Flaw Remediation" value={value.title} onChange={e => f('title', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">CONTROL FAMILY</label>
        <select className="input-base" value={value.family} onChange={e => f('family', e.target.value)}>
          <option value="">— Select —</option>
          {NIST_FAMILIES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">BASELINE</label>
        <select className="input-base" value={value.baseline} onChange={e => f('baseline', e.target.value)}>
          <option value="">—</option>
          {['Low','Moderate','High'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">IMPLEMENTATION STATUS</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {['Not Implemented','Partially Implemented','Implemented'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">LAST REVIEW DATE</label>
        <input type="date" className="input-base" value={value.last_review || ''} onChange={e => f('last_review', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">
          DESCRIPTION <span className="text-scorva-muted/60">(OPTIONAL — NIST CONTROL TEXT)</span>
        </label>
        <textarea className="input-base resize-none" rows={4} placeholder="Paste the official NIST SP 800-53 control description here..." value={value.description || ''} onChange={e => f('description', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">
          IMPLEMENTATION GUIDANCE <span className="text-scorva-muted/60">(OPTIONAL)</span>
        </label>
        <textarea className="input-base resize-none" rows={3} placeholder="How is this control implemented in your environment?" value={value.implementation_guidance || ''} onChange={e => f('implementation_guidance', e.target.value)} />
      </div>

      {/* ConMon section */}
      <div className="col-span-2 border-t border-scorva-border pt-3 mt-1">
        <p className="text-[11px] text-scorva-muted uppercase tracking-wider mb-3">ConMon Tracking</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-scorva-muted mb-1">CONMON GROUP / ACTIVITY</label>
            <input className="input-base" placeholder="e.g. Monthly STIG/SCAP Review" value={value.conmon_group || ''} onChange={e => f('conmon_group', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1">CONMON STATUS</label>
            <select className="input-base" value={value.conmon_status || 'Open'} onChange={e => f('conmon_status', e.target.value)}>
              {['Open','Compliant','POA&M'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1">CONMON FREQUENCY</label>
            <select className="input-base" value={value.conmon_frequency || ''} onChange={e => f('conmon_frequency', e.target.value)}>
              <option value="">—</option>
              {['Weekly','Monthly','Quarterly','Annual','On Demand'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Control Detail view ── */
function ControlDetail({ control, activities }) {
  const linked = activities.filter(a => (a.linked_controls || []).includes(control.id));

  function Field({ label, value, mono }) {
    if (!value && value !== 0) return null;
    return (
      <div>
        <div className="text-xs text-scorva-muted mb-0.5 uppercase tracking-wider">{label}</div>
        <div className={`text-sm text-scorva-text ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge label={control.status} />
        <Badge label={control.conmon_status || 'Open'} />
        {control.baseline && <span className="px-2 py-0.5 rounded text-xs bg-scorva-surface text-scorva-muted border border-scorva-border">{control.baseline}</span>}
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="Family"       value={control.family} />
        <Field label="Baseline"     value={control.baseline} />
        <Field label="Last Review"  value={control.last_review} mono />
        <Field label="Findings"     value={control.findings > 0 ? control.findings : null} />
        <Field label="ConMon Group" value={control.conmon_group} />
        <Field label="Frequency"    value={control.conmon_frequency} />
      </div>

      {/* Description */}
      {control.description && (
        <div>
          <div className="text-xs text-scorva-muted mb-1 uppercase tracking-wider">Description</div>
          <div className="text-xs text-scorva-text whitespace-pre-wrap bg-scorva-surface rounded-lg p-3 border border-scorva-border leading-relaxed max-h-40 overflow-y-auto">{control.description}</div>
        </div>
      )}

      {/* Implementation Guidance */}
      {control.implementation_guidance && (
        <div>
          <div className="text-xs text-scorva-muted mb-1 uppercase tracking-wider">Implementation Guidance</div>
          <div className="text-sm text-scorva-text whitespace-pre-wrap bg-scorva-surface rounded-lg p-3 border border-scorva-border">{control.implementation_guidance}</div>
        </div>
      )}

      {/* Linked ConMon Activities */}
      {linked.length > 0 && (
        <div>
          <div className="text-xs text-scorva-muted uppercase tracking-wider mb-2">Linked ConMon Activities</div>
          <div className="space-y-2">
            {linked.map(a => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-scorva-hover/50 border border-scorva-border/50 text-xs">
                <div>
                  <span className="font-mono text-scorva-accent-light mr-2">{a.id}</span>
                  <span className="text-scorva-text">{a.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-scorva-muted">{a.frequency}</span>
                  <Badge label={a.status || 'Scheduled'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {control.notes && (
        <div>
          <div className="text-xs text-scorva-muted mb-1 uppercase tracking-wider">Notes</div>
          <div className="text-sm text-scorva-text whitespace-pre-wrap bg-scorva-surface rounded-lg p-3 border border-scorva-border">{control.notes}</div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function ControlsPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';
  const { data = [],           isLoading, isError, error }  = useQuery({ queryKey: ['controls', siteScopeKey], queryFn: api.controls.list });
  const { data: activities = [] }            = useQuery({ queryKey: ['conmon', siteScopeKey],   queryFn: api.conmon.list });

  const [modal,        setModal]       = useState(null);   // 'create' | 'edit' | 'view'
  const [form,         setForm]        = useState(EMPTY);
  const [editing,      setEditing]     = useState(null);
  const [viewing,      setViewing]     = useState(null);
  const [delId,        setDelId]       = useState(null);
  const [search,       setSearch]      = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterConMon, setFilterConMon] = useState('All');
  const [importOpen,   setImportOpen]  = useState(false);

  const create      = useMutation({ mutationFn: api.controls.create, onSuccess: () => { qc.invalidateQueries(['controls']); setModal(null); } });
  const update      = useMutation({ mutationFn: ({ id, d }) => api.controls.update(id, d), onSuccess: () => { qc.invalidateQueries(['controls']); qc.invalidateQueries(['conmon']); setModal(null); } });
  const remove      = useMutation({ mutationFn: api.controls.remove, onSuccess: () => { qc.invalidateQueries(['controls']); setDelId(null); } });
  const exportXlsx  = useMutation({ mutationFn: api.reports.controls, onSuccess: ({ blob, filename }) => triggerDownload(blob, filename) });

  const sorted = [...data].sort((a, b) =>
    (a.id ?? '').localeCompare(b.id ?? '', undefined, { numeric: true, sensitivity: 'base' })
  );

  const filtered = sorted.filter(c => {
    const matchSearch = !search ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.conmon_group || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchConMon = filterConMon === 'All' || (c.conmon_status || 'Open') === filterConMon;
    return matchSearch && matchStatus && matchConMon;
  });

  function openCreate()  { setForm(EMPTY); setModal('create'); }
  function openEdit(row) { setForm(row); setEditing(row.id); setModal('edit'); }
  function openView(row) { setViewing(row); setModal('view'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  const cols = [
    { key: 'id',     label: 'ID',     width: 100,
      render: v => <span className="font-mono text-scorva-accent-light text-xs">{v}</span> },
    { key: 'title',  label: 'Title' },
    { key: 'family', label: 'Family', width: 80 },
    { key: 'conmon_group', label: 'ConMon Group',
      render: v => <span className="text-xs text-scorva-muted">{v || '—'}</span> },
    { key: 'conmon_frequency', label: 'Frequency', width: 90,
      render: v => <span className="text-xs text-scorva-muted">{v || '—'}</span> },
    { key: 'conmon_status', label: 'ConMon Status', width: 120,
      render: v => <Badge label={v || 'Open'} /> },
    { key: 'last_review', label: 'Last Completed', width: 120,
      render: v => <span className="font-mono text-xs text-scorva-muted">{v || '—'}</span> },
    { key: 'status', label: 'Impl. Status', render: v => <Badge label={v} /> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover"  onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <div className="text-sm text-red-400">Failed to load Controls data: {error?.response?.data?.error || error?.message || 'Unknown error'}</div>;
  }

  const implemented = data.filter(r => r.status === 'Implemented').length;
  const partial     = data.filter(r => r.status === 'Partially Implemented').length;
  const notImpl     = data.filter(r => r.status === 'Not Implemented').length;
  const compliant   = data.filter(r => (r.conmon_status || 'Open') === 'Compliant').length;
  const findings    = data.reduce((s, r) => s + (r.findings || 0), 0);
  const implPct     = data.length ? Math.round((implemented / data.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Control Library" description={`${data.length} controls · NIST SP 800-53 Rev 5`}
        action={
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload size={14} /> Import
            </button>
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending} title="Export controls to Excel">
              <Download size={14} className={exportXlsx.isPending ? 'animate-pulse' : ''} /> Export
            </button>
            <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}>
              <Plus size={15} /> Add Control
            </button>
          </div>
        }
      />

      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={`${implPct}%`}
            sublabel="implemented"
            segments={[
              { label: 'Implemented', value: implemented, color: 'green'  },
              { label: 'Partial',     value: partial,     color: 'yellow' },
              { label: 'Not Impl.',   value: notImpl,     color: 'red'    },
            ]}
          />
          <div className="flex-1 min-w-[180px]">
            <BarList
              title="Implementation Status"
              bars={[
                { label: 'Implemented', value: implemented, color: 'green'  },
                { label: 'Partial',     value: partial,     color: 'yellow' },
                { label: 'Not Impl.',   value: notImpl,     color: 'red'    },
              ]}
            />
          </div>
          <StatTile label="Total Controls"  value={data.length} />
          <StatTile label="ConMon Compliant" value={compliant} color={compliant > 0 ? 'green' : 'default'} />
          <StatTile label="Total Findings"  value={findings}  color={findings > 0 ? 'red' : 'green'} />
        </div>
      </StatusDashboard>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted" />
          <input className="input-base pl-9" placeholder="Search controls..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-base w-48" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {['All','Not Implemented','Partially Implemented','Implemented'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input-base w-44" value={filterConMon} onChange={e => setFilterConMon(e.target.value)}>
          {['All','Open','Compliant','POA&M'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <Table columns={cols} data={filtered} onRowClick={openView} emptyText="No controls match your filters." />

      {/* View Modal */}
      {modal === 'view' && viewing && (
        <Modal title={`${viewing.id} — ${viewing.title}`} onClose={() => setModal(null)} size="lg">
          <ControlDetail control={viewing} activities={activities} />
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-scorva-border">
            <button className="btn-secondary" onClick={() => openEdit(viewing)}>Edit</button>
            <button className="btn-primary"   onClick={() => setModal(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Control' : 'Edit Control'} onClose={() => setModal(null)} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <ControlForm value={form} onChange={setForm} isNew={modal === 'create'} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {delId && <ConfirmDialog title="Delete Control" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}

      {importOpen && (
        <ImportControlsModal
          currentCount={data.length}
          onClose={() => setImportOpen(false)}
          onImported={() => qc.invalidateQueries(['controls'])}
        />
      )}
    </div>
  );
}
