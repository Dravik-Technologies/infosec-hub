import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import PageHeader    from '../components/ui/PageHeader';
import Modal         from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';

const EMPTY = { name: '', description: '', columns: [], rows: [], subtrackers: [] };

export default function TrackersPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['trackers'], queryFn: api.trackers.list });
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId]     = useState(null);

  const create = useMutation({ mutationFn: api.trackers.create, onSuccess: () => { qc.invalidateQueries(['trackers']); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.trackers.update(id, d), onSuccess: () => { qc.invalidateQueries(['trackers']); setModal(null); } });
  const remove = useMutation({ mutationFn: api.trackers.remove, onSuccess: () => { qc.invalidateQueries(['trackers']); setDelId(null); } });

  function openCreate() { setForm(EMPTY); setModal('create'); }
  function openEdit(row) { setForm(row); setEditing(row.id); setModal('edit'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  if (isLoading) return <LoadingSpinner />;

  const totalRows = data.reduce((s, t) => s + (t.rows?.length    || 0), 0);
  const totalCols = data.reduce((s, t) => s + (t.columns?.length || 0), 0);


  return (
    <div>
      <PageHeader title="Trackers" description="Custom compliance tracking boards"
        action={<button className="btn-primary" onClick={openCreate}><Plus size={15} />New Tracker</button>}
      />
      <StatusDashboard>
        <div className="flex flex-wrap gap-2">
          <StatTile label="Trackers"      value={data.length} color="blue"    />
          <StatTile label="Total Rows"    value={totalRows}   />
          <StatTile label="Total Columns" value={totalCols}   />
        </div>
      </StatusDashboard>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-scorva-muted">
          <LayoutGrid size={36} className="mb-3 opacity-30" />
          <p className="text-sm">No trackers yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(t => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium text-scorva-text">{t.name}</h3>
                  {t.description && <p className="text-xs text-scorva-muted mt-0.5">{t.description}</p>}
                </div>
                <div className="flex gap-1.5 ml-2">
                  <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(t)}><Pencil size={13} /></button>
                  <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(t.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="flex gap-3 mt-3 text-xs text-scorva-muted">
                <span>{(t.columns || []).length} columns</span>
                <span>·</span>
                <span>{(t.rows || []).length} rows</span>
              </div>
              <div className="text-xs text-scorva-muted mt-1 font-mono">{t.created_at ? t.created_at.split('T')[0] : ''}</div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'New Tracker' : 'Edit Tracker'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-scorva-muted mb-1">Name *</label>
              <input className="input-base" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs text-scorva-muted mb-1">Description</label>
              <textarea className="input-base resize-none" rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {delId && <ConfirmDialog title="Delete Tracker" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
    </div>
  );
}
