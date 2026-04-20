import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader    from '../components/ui/PageHeader';
import Table         from '../components/ui/Table';
import Modal         from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';

const EMPTY = { id: '', label: '' };

export default function SitesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list });
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId]     = useState(null);

  const isAdmin = user?.role === 'Corporate Admin';

  const create = useMutation({ mutationFn: api.sites.create, onSuccess: () => { qc.invalidateQueries(['sites']); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.sites.update(id, d), onSuccess: () => { qc.invalidateQueries(['sites']); setModal(null); } });
  const remove = useMutation({ mutationFn: api.sites.remove, onSuccess: () => { qc.invalidateQueries(['sites']); setDelId(null); } });

  function openCreate() { setForm(EMPTY); setModal('create'); }
  function openEdit(row) { setForm(row); setEditing(row.id); setModal('edit'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: { label: form.label } });
  }

  const cols = [
    { key: 'id',    label: 'Site ID', render: v => <span className="font-mono text-xs text-scorva-accent-light">{v}</span> },
    { key: 'label', label: 'Label' },
    ...(isAdmin ? [{ key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )}] : []),
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Sites" description="Physical or logical site definitions"
        action={isAdmin && <button className="btn-primary" onClick={openCreate}><Plus size={15} />Add Site</button>}
      />
      <StatusDashboard>
        <div className="flex flex-wrap gap-2">
          <StatTile label="Total Sites" value={data.length} color="blue" />
        </div>
      </StatusDashboard>
      <div className="mt-6">
      <Table columns={cols} data={data} />

      {modal && (
        <Modal title={modal === 'create' ? 'Add Site' : 'Edit Site'} onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {modal === 'create' && (
              <div>
                <label className="block text-xs text-scorva-muted mb-1">Site ID *</label>
                <input className="input-base font-mono" placeholder="e.g. SITE-001" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} required />
              </div>
            )}
            <div>
              <label className="block text-xs text-scorva-muted mb-1">Label *</label>
              <input className="input-base" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}
      {delId && <ConfirmDialog title="Delete Site" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
      </div>
    </div>
  );
}
