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
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';
import StatusDashboard from '../components/ui/StatusDashboard';
import { StatTile }    from '../components/ui/StatusDashboard';
import DonutChart       from '../components/ui/DonutChart';

const EMPTY = { system: '', category: '', status: 'Pending Authorization', issued: '', expires: '', ao: '', controls: 0, open_findings: 0 };

function toFormState(row = {}) {
  return {
    ...EMPTY,
    ...row,
    open_findings: row.open_findings ?? row.openFindings ?? 0,
  };
}

function getAtoRowClass(row) {
  const s = (row.status || '').toLowerCase();
  const isExpiredByDate = row.expires && new Date(row.expires) < new Date();
  if (s === 'expired' || s === 'denied' || isExpiredByDate) return 'row-critical';
  if (s.includes('pending')) return 'row-medium';
  return '';
}

function ATOForm({ value, onChange }) {
  const f = (k, v) => onChange({ ...value, [k]: v });

  // Check if ATO is expired
  const isExpired = value.expires && new Date(value.expires) < new Date();

  return (
    <div className="space-y-4">
      {/* Expiration warning */}
      {isExpired && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-3 text-sm text-red-400">
          <strong>⚠ This ATO is expired.</strong> Please update the Status field to "Expired" or renew the authorization.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-scorva-muted mb-1">System Name *</label>
        <input
          className="input-base"
          placeholder="e.g., Enterprise Email System, Cloud Storage Platform"
          value={value.system}
          onChange={e => f('system', e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Category</label>
        <input
          className="input-base"
          placeholder="e.g., Category Four"
          value={value.category}
          onChange={e => f('category', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Status</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {['Pending Authorization','Authorized','Denied','Expired'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Issued</label>
        <input
          type="date"
          className="input-base"
          title="Date when authorization was issued"
          value={value.issued}
          onChange={e => f('issued', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Expires</label>
        <input
          type="date"
          className="input-base"
          title="Date when authorization expires"
          value={value.expires}
          onChange={e => f('expires', e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">Authorizing Official</label>
        <input
          className="input-base"
          placeholder="e.g., Dr. John Smith, Chief Information Officer"
          value={value.ao}
          onChange={e => f('ao', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Controls Count</label>
        <input
          type="number"
          className="input-base"
          placeholder="0"
          title="Number of security controls implemented"
          value={value.controls}
          onChange={e => f('controls', +e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">Open Findings</label>
        <input
          type="number"
          className="input-base"
          placeholder="0"
          title="Number of open security findings"
          value={value.open_findings}
          onChange={e => f('open_findings', +e.target.value)}
        />
      </div>
      </div>
    </div>
  );
}

export default function ATOPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: ['ato', siteScopeKey], queryFn: api.ato.list });
  const [modal, setModal]   = useState(null); // null | 'create' | 'edit'
  const [form, setForm]     = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [delId, setDelId]   = useState(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ato'] });
  const create = useMutation({ mutationFn: api.ato.create, onSuccess: () => { invalidate(); setModal(null); } });
  const update = useMutation({ mutationFn: ({ id, d }) => api.ato.update(id, d), onSuccess: () => { invalidate(); setModal(null); } });
  const remove = useMutation({ mutationFn: api.ato.remove, onSuccess: () => { invalidate(); setDelId(null); } });

  function openCreate() { create.reset(); update.reset(); setForm(EMPTY); setModal('create'); }
  function openEdit(row) { create.reset(); update.reset(); setForm(toFormState(row)); setEditing(row.id); setModal('edit'); }

  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  const cols = [
    { key: 'id',     label: 'ID',     width: 100 },
    { key: 'system', label: 'System' },
    { key: 'category', label: 'Category' },
    {
      key: 'status',
      label: 'Status',
      render: (v, row) => {
        // Check if ATO is actually expired based on date
        const isActuallyExpired = row.expires && new Date(row.expires) < now;
        const displayStatus = isActuallyExpired ? 'Expired' : v;
        return <Badge label={displayStatus} />;
      }
    },
    { key: 'ao',     label: 'Auth. Official' },
    { key: 'expires',label: 'Expires',  render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'open_findings', label: 'Findings' },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  const mutationError = create.error?.response?.data?.error || update.error?.response?.data?.error || create.error?.message || update.error?.message;

  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <div className="text-sm text-red-400">Failed to load ATO data: {error?.response?.data?.error || error?.message || 'Unknown error'}</div>;
  }

  // Define date references first
  const now  = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Count based on actual status (checking expiration dates)
  const authorized = data.filter(r => r.status === 'Authorized' && (!r.expires || new Date(r.expires) >= now)).length;
  const pending    = data.filter(r => r.status === 'Pending Authorization').length;
  const expired    = data.filter(r => r.status !== 'Denied' && (r.status === 'Expired' || (r.expires && new Date(r.expires) < now))).length;
  const denied     = data.filter(r => r.status === 'Denied').length;
  const findings   = data.reduce((s, r) => s + (r.open_findings || 0), 0);
  const authPct    = data.length ? Math.round((authorized / data.length) * 100) : 0;

  const expiringWithin30 = data
    .filter(r => r.status === 'Authorized' && r.expires)
    .map(r => ({ ...r, _expDate: new Date(r.expires) }))
    .filter(r => r._expDate >= now && r._expDate <= in30)
    .sort((a, b) => a._expDate - b._expDate);

  const expiringSoon = data
    .filter(r => r.status === 'Authorized' && r.expires)
    .map(r => ({ ...r, _expDate: new Date(r.expires) }))
    .filter(r => r._expDate >= now && r._expDate <= in90)
    .sort((a, b) => a._expDate - b._expDate);

  function daysUntil(date) {
    return Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  }

  function expiryColor(days) {
    if (days <= 30) return { badge: 'bg-red-500/15 text-red-400 border border-red-500/25',    bar: 'bg-red-400'    };
    if (days <= 60) return { badge: 'bg-orange-500/15 text-orange-400 border border-orange-500/25', bar: 'bg-orange-400' };
    return              { badge: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25',  bar: 'bg-yellow-400' };
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Authorization' }, { label: 'ATO' }]}
        title="Authority to Operate"
        description="ATO package tracking and expiration monitoring"
        action={<button className="btn-primary flex items-center gap-1.5" onClick={openCreate} disabled={!selectedSite}><Plus size={15} />New ATO</button>}
      />
      {!selectedSite && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-600 dark:text-yellow-400 text-sm">
          Select a site from the header to view or add ATOs for that site.
        </div>
      )}
      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={`${authPct}%`}
            sublabel="active"
            segments={[
              { label: 'Active',     value: authorized, color: 'green'  },
              { label: 'Pending',    value: pending,    color: 'yellow' },
              { label: 'Expired',    value: expired,    color: 'red'    },
              { label: 'Denied',     value: denied,     color: 'orange' },
            ]}
          />
          <div className="flex flex-wrap gap-2 items-start">
            <StatTile label="Total Systems"  value={data.length} />
            <StatTile label="Open Findings"  value={findings} color={findings > 0 ? 'red' : 'green'} />
          </div>
        </div>

        {/* ── URGENT: Expiring Within 30 Days ── */}
        {expiringWithin30.length > 0 && (
          <div className="mt-5 pt-5 border-t border-red-500/30 bg-red-500/5 -mx-4 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={13} className="text-red-400 animate-pulse" />
              <span className="text-[11px] font-mono font-semibold text-red-400 uppercase tracking-wide">
                ⚠ URGENT: Expiring Within 30 Days
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                {expiringWithin30.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {expiringWithin30.map(r => {
                const days = daysUntil(r._expDate);
                return (
                  <div key={r.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-red-400 truncate">{r.system}</span>
                        {r.category && <span className="text-[9px] font-mono text-scorva-muted hidden sm:inline">{r.category}</span>}
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-scorva-border overflow-hidden w-32">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{ width: `${Math.max(8, Math.round((days / 30) * 100))}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-scorva-muted">{r.expires}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                        {days}d
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Expiring Within 90 Days ── */}
        <div className={`mt-5 pt-5 border-t border-scorva-border ${expiringWithin30.length > 0 ? '' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} className={expiringSoon.length > 0 ? 'text-yellow-400' : 'text-scorva-muted'} />
            <span className="text-[11px] font-mono font-semibold text-scorva-text uppercase tracking-wide">
              Expiring Within 90 Days
            </span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${expiringSoon.length > 0 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-scorva-hover text-scorva-muted'}`}>
              {expiringSoon.length}
            </span>
          </div>

          {expiringSoon.length === 0 ? (
            <p className="text-xs text-scorva-muted font-mono">No systems expiring within 90 days.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {expiringSoon.map(r => {
                const days = daysUntil(r._expDate);
                const { badge, bar } = expiryColor(days);
                return (
                  <div key={r.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-scorva-hover/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-scorva-text truncate">{r.system}</span>
                        {r.category && <span className="text-[9px] font-mono text-scorva-muted hidden sm:inline">{r.category}</span>}
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-scorva-border overflow-hidden w-32">
                        <div
                          className={`h-full rounded-full ${bar}`}
                          style={{ width: `${Math.max(4, Math.round((days / 90) * 100))}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-scorva-muted">{r.expires}</span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${badge}`}>
                        {days}d
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </StatusDashboard>
      <div className="mt-6">
      <Table
        columns={cols}
        data={data}
        onRowClick={openEdit}
        getRowClass={getAtoRowClass}
        emptyText="No ATO packages found."
      />

      {modal && (
        <Modal title={modal === 'create' ? 'New ATO' : 'Edit ATO'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ATOForm value={form} onChange={setForm} />
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
      {delId && <ConfirmDialog title="Delete ATO" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
      </div>
    </div>
  );
}
