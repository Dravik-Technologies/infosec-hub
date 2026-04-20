import { useEffect, useMemo, useState } from 'react';
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
import ImportConMonModal from '../components/ImportConMonModal';
import { Plus, Pencil, Trash2, CheckCircle, Upload } from 'lucide-react';

const STATUS_TABS = ['Pending', 'Completed', 'All'];

const EMPTY_FORM = {
  control_id: '', control_title: '', family: '',
  daag_jsig_frequency: '', baseline_applicability: '',
  conmon_group: '', notes: '', due_date: '',
};

/* ── Control Form (create / edit) ── */
function ControlForm({ value, onChange }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-scorva-muted mb-1">CONTROL ID *</label>
        <input
          className="input-base font-mono"
          placeholder="e.g. AC-1"
          value={value.control_id}
          onChange={e => f('control_id', e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">FAMILY</label>
        <input
          className="input-base"
          placeholder="e.g. Access Control"
          value={value.family}
          onChange={e => f('family', e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">CONTROL TITLE</label>
        <input
          className="input-base"
          placeholder="e.g. Policy and Procedures"
          value={value.control_title}
          onChange={e => f('control_title', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">DAAG/JSIG FREQUENCY</label>
        <input
          className="input-base"
          placeholder="e.g. Annual"
          value={value.daag_jsig_frequency}
          onChange={e => f('daag_jsig_frequency', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">BASELINE APPLICABILITY</label>
        <input
          className="input-base"
          placeholder="e.g. LOW, MOD, HIGH"
          value={value.baseline_applicability}
          onChange={e => f('baseline_applicability', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">CONMON GROUP</label>
        <input
          className="input-base"
          placeholder="e.g. Documentation"
          value={value.conmon_group}
          onChange={e => f('conmon_group', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">DUE DATE</label>
        <input
          type="date"
          className="input-base"
          value={value.due_date}
          onChange={e => f('due_date', e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">NOTES / DEPENDENCIES</label>
        <textarea
          className="input-base resize-none"
          rows={4}
          placeholder="Enter any notes, dependencies, or additional context..."
          value={value.notes}
          onChange={e => f('notes', e.target.value)}
        />
      </div>
    </div>
  );
}

/* ── Control Detail (view / complete) ── */
function ControlDetail({ item, onComplete }) {
  const [showComplete, setShowComplete] = useState(false);

  function Field({ label, value, mono, wide }) {
    if (!value) return null;
    return (
      <div className={wide ? 'col-span-2' : ''}>
        <div className="text-xs text-scorva-muted mb-0.5 uppercase tracking-wider">{label}</div>
        <div className={`text-sm text-scorva-text ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Status + Frequency badges */}
      <div className="flex flex-wrap gap-2">
        <Badge label={item.status || 'Pending'} />
        {item.daag_jsig_frequency && (
          <span className="px-2 py-0.5 rounded text-xs bg-scorva-surface text-scorva-muted border border-scorva-border">
            {item.daag_jsig_frequency}
          </span>
        )}
        {item.conmon_group && (
          <span className="px-2 py-0.5 rounded text-xs bg-scorva-surface text-scorva-muted border border-scorva-border">
            {item.conmon_group}
          </span>
        )}
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="Control ID"             value={item.control_id}             mono />
        <Field label="Family"                 value={item.family} />
        <Field label="Baseline Applicability" value={item.baseline_applicability} wide />
        <Field label="Due Date"               value={item.due_date}               mono />
        {item.completed_date && (
          <div>
            <div className="text-xs text-scorva-muted mb-0.5 uppercase tracking-wider">Completed</div>
            <div className="text-sm font-mono text-emerald-400">{item.completed_date}</div>
          </div>
        )}
      </div>

      {/* Notes / Dependencies */}
      {item.notes ? (
        <div>
          <div className="text-xs text-scorva-muted mb-1.5 uppercase tracking-wider">Notes / Dependencies</div>
          <div className="text-sm text-scorva-text whitespace-pre-wrap bg-scorva-surface rounded-lg p-3 border border-scorva-border leading-relaxed">
            {item.notes}
          </div>
        </div>
      ) : (
        <p className="text-xs text-scorva-muted italic">No notes or dependencies recorded.</p>
      )}

      {/* Mark as Complete */}
      {item.status !== 'Completed' && (
        <div className="border-t border-scorva-border pt-4">
          {!showComplete ? (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setShowComplete(true)}
            >
              <CheckCircle size={14} /> Mark as Complete
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-scorva-muted">
                This will mark the control as <Badge label="Completed" /> and record today's date as the completion date.
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={onComplete}
                >
                  <CheckCircle size={14} /> Confirm Complete
                </button>
                <button className="btn-secondary" onClick={() => setShowComplete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function ConMonPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const siteScopeKey = selectedSite || user?.siteID || 'all-sites';
  const { data: items = [], isLoading } = useQuery({ queryKey: ['conmon', siteScopeKey], queryFn: api.conmon.list });

  const [tab,        setTab]        = useState('Pending');
  const [modal,      setModal]      = useState(null);   // 'create' | 'edit' | 'view'
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [editing,    setEditing]    = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [delId,      setDelId]      = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteError, setBulkDeleteError] = useState('');

  useEffect(() => {
    setSelectedIds([]);
    setBulkDeleteError('');
  }, [siteScopeKey]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['conmon'] });
    qc.invalidateQueries({ queryKey: ['controls'] });
  };

  const create = useMutation({
    mutationFn: api.conmon.create,
    onSuccess: () => { invalidate(); setModal(null); },
  });

  const update = useMutation({
    mutationFn: ({ id, d }) => api.conmon.update(id, d),
    onSuccess: updatedDoc => {
      invalidate();
      /* If completing from the view modal, update selected so the badge flips */
      if (selected && updatedDoc.id === selected.id) setSelected(updatedDoc);
      if (modal !== 'view') setModal(null);
    },
  });

  const remove = useMutation({
    mutationFn: api.conmon.remove,
    onSuccess: () => { invalidate(); setDelId(null); setModal(null); },
  });
  const removeMany = useMutation({
    mutationFn: api.controls.bulkDelete,
    onSuccess: () => {
      invalidate();
      setSelectedIds([]);
      setBulkDeleteError('');
    },
    onError: err => {
      setBulkDeleteError(err?.response?.data?.error || err.message || 'Bulk delete failed.');
    },
  });

  function openCreate() { setForm(EMPTY_FORM); setModal('create'); }
  function openEdit(row) {
    setForm({
      control_id:             row.control_id             || '',
      control_title:          row.control_title          || '',
      family:                 row.family                 || '',
      daag_jsig_frequency:    row.daag_jsig_frequency    || '',
      baseline_applicability: row.baseline_applicability || '',
      conmon_group:           row.conmon_group            || '',
      notes:                  row.notes                  || '',
      due_date:               row.due_date               || '',
    });
    setEditing(row.id);
    setModal('edit');
  }
  function openView(row) { setSelected(row); setModal('view'); }

  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  function handleComplete() {
    update.mutate({ id: selected.id, d: { status: 'Completed' } });
  }

  /* ── natural sort: AC-1, AC-2, AC-3 … AC-10, AC-11 ── */
  const sorted = [...items].sort((a, b) =>
    (a.control_id ?? '').localeCompare(b.control_id ?? '', undefined, { numeric: true, sensitivity: 'base' })
  );

  /* ── stats ── */
  const todayStr  = new Date().toISOString().split('T')[0];
  const pending   = sorted.filter(i => i.status !== 'Completed');
  const completed = sorted.filter(i => i.status === 'Completed');
  const overdue   = pending.filter(i => i.due_date && i.due_date < todayStr);
  const pctDone   = items.length ? Math.round(completed.length / items.length * 100) : 0;

  /* ── filtered by tab ── */
  const filtered = tab === 'All'
    ? sorted
    : sorted.filter(i => (tab === 'Pending' ? i.status !== 'Completed' : i.status === 'Completed'));

  const filteredIds = useMemo(() => filtered.map(row => row.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));

  function toggleSelectOne(id) {
    setBulkDeleteError('');
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleSelectAll() {
    setBulkDeleteError('');
    setSelectedIds(prev => {
      if (allFilteredSelected) return prev.filter(id => !filteredIds.includes(id));
      return [...new Set([...prev, ...filteredIds])];
    });
  }

  /* ── shared columns ── */
  const sharedCols = [
    {
      key: '_select',
      label: (
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleSelectAll}
          onClick={e => e.stopPropagation()}
          aria-label="Select all controls"
        />
      ),
      width: 32,
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelectOne(row.id)}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${row.control_id}`}
        />
      ),
    },
    {
      key: 'control_id', label: 'Control ID', width: 100,
      render: v => <span className="font-mono text-xs text-scorva-accent-light">{v}</span>,
    },
    { key: 'control_title', label: 'Control Title' },
    {
      key: 'family', label: 'Family', width: 130,
      render: v => <span className="text-xs text-scorva-muted">{v || '—'}</span>,
    },
    {
      key: 'daag_jsig_frequency', label: 'DAAG/JSIG Freq', width: 120,
      render: v => <span className="text-xs">{v || '—'}</span>,
    },
    {
      key: 'conmon_group', label: 'ConMon Group', width: 130,
      render: v => <span className="text-xs">{v || '—'}</span>,
    },
  ];

  const dueDateCol = {
    key: 'due_date', label: 'Due Date', width: 100,
    render: v => (
      <span className={`font-mono text-xs ${v && v < todayStr ? 'text-red-400' : 'text-scorva-muted'}`}>
        {v || '—'}
      </span>
    ),
  };

  const actionsCol = {
    key: '_actions', label: '', width: 64,
    render: (_, row) => (
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        <button
          className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover"
          onClick={() => openEdit(row)}
        >
          <Pencil size={13} />
        </button>
        <button
          className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover"
          onClick={() => setDelId(row.id)}
        >
          <Trash2 size={13} />
        </button>
      </div>
    ),
  };

  const pendingCols = [
    ...sharedCols,
    dueDateCol,
    { key: 'status', label: 'Status', width: 90, render: v => <Badge label={v || 'Pending'} /> },
    actionsCol,
  ];

  const completedCols = [
    ...sharedCols,
    dueDateCol,
    {
      key: 'completed_date', label: 'Completed', width: 110,
      render: v => <span className="font-mono text-xs text-emerald-400">{v || '—'}</span>,
    },
    actionsCol,
  ];

  const allCols = [
    ...sharedCols,
    dueDateCol,
    { key: 'status', label: 'Status', width: 90, render: v => <Badge label={v || 'Pending'} /> },
    {
      key: 'completed_date', label: 'Completed', width: 110,
      render: v => v ? <span className="font-mono text-xs text-emerald-400">{v}</span> : null,
    },
    actionsCol,
  ];

  const cols = tab === 'Completed' ? completedCols : tab === 'All' ? allCols : pendingCols;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Continuous Monitoring"
        description={`${items.length} controls · ${pctDone}% complete`}
        action={
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button
                className="btn-secondary flex items-center gap-1.5 text-red-300 border-red-500/40"
                onClick={() => removeMany.mutate(selectedIds)}
                disabled={removeMany.isPending}
              >
                <Trash2 size={14} /> Delete Selected ({selectedIds.length})
              </button>
            )}
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload size={14} /> Import Excel
            </button>
            <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}>
              <Plus size={15} /> Add Control
            </button>
          </div>
        }
      />
      {bulkDeleteError && (
        <p className="mb-3 text-xs text-red-400">{bulkDeleteError}</p>
      )}

      {/* ── Stats ── */}
      <StatusDashboard>
        <div className="flex flex-wrap gap-2">
          <StatTile label="Total Controls" value={items.length} />
          <StatTile label="Pending"        value={pending.length}   color={pending.length   > 0 ? 'yellow' : 'default'} />
          <StatTile label="Completed"      value={completed.length} color={completed.length > 0 ? 'green'  : 'default'} />
          <StatTile label="Overdue"        value={overdue.length}   color={overdue.length   > 0 ? 'red'    : 'default'} />
        </div>
      </StatusDashboard>

      {/* ── Status Tabs ── */}
      <div className="flex gap-0.5 border-b border-scorva-border mb-4 mt-1">
        {STATUS_TABS.map(t => {
          const count = t === 'All' ? items.length : t === 'Pending' ? pending.length : completed.length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-scorva-accent text-scorva-accent'
                  : 'border-transparent text-scorva-muted hover:text-scorva-text'
              }`}
            >
              {t}
              <span className="ml-1.5 text-[10px] font-mono text-scorva-muted/60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      <Table
        columns={cols}
        data={filtered}
        onRowClick={openView}
        emptyText={
          tab === 'Pending'
            ? 'No pending controls. Import an Excel spreadsheet or add a control manually.'
            : tab === 'Completed'
            ? 'No completed controls yet.'
            : 'No controls found.'
        }
      />

      {/* ── View / Detail Modal ── */}
      {modal === 'view' && selected && (
        <Modal
          title={`${selected.control_id}${selected.control_title ? ` — ${selected.control_title}` : ''}`}
          onClose={() => setModal(null)}
          size="lg"
        >
          <ControlDetail item={selected} onComplete={handleComplete} />
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-scorva-border">
            <button className="btn-secondary" onClick={() => openEdit(selected)}>Edit</button>
            <button className="btn-primary"   onClick={() => setModal(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* ── Create / Edit Modal ── */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Add Control' : 'Edit Control'}
          onClose={() => setModal(null)}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <ControlForm value={form} onChange={setForm} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="submit"
                className="btn-primary"
                disabled={create.isPending || update.isPending}
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {delId && (
        <ConfirmDialog
          title="Delete Control"
          message="This will permanently remove this control from ConMon. This cannot be undone."
          onConfirm={() => remove.mutate(delId)}
          onCancel={() => setDelId(null)}
        />
      )}

      {/* ── Import Modal ── */}
      {importOpen && (
        <ImportConMonModal
          onClose={() => setImportOpen(false)}
          onImported={() => qc.invalidateQueries({ queryKey: ['conmon'] })}
        />
      )}
    </div>
  );
}
