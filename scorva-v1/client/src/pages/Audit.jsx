import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import PageHeader    from '../components/ui/PageHeader';
import Table         from '../components/ui/Table';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Search, ScanSearch, History } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';

export default function AuditPage() {
  const [filters, setFilters] = useState({ username: '', action: '', site: '', limit: 100, offset: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => api.audit.list(filters),
    keepPreviousData: true,
  });

  const rows  = data?.rows  || [];
  const total = data?.total || 0;

  const cols = [
    { key: 'timestamp', label: 'Timestamp', render: v => <span className="font-mono text-xs">{v ? new Date(v).toLocaleString() : '—'}</span> },
    { key: 'username',  label: 'User',      render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'action',    label: 'Action',    render: v => <span className="font-mono text-xs text-scorva-accent-light">{v}</span> },
    { key: 'resource',  label: 'Resource',  render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'detail',    label: 'Detail' },
    { key: 'site',      label: 'Site' },
  ];

  if (isLoading) return <LoadingSpinner />;

  const uniqueUsers   = new Set(rows.map(r => r.username).filter(Boolean)).size;
  const uniqueActions = new Set(rows.map(r => r.action).filter(Boolean)).size;

  return (
    <div>
      <PageHeader title="Audit Log" description={`${total.toLocaleString()} total entries`} />
      <StatusDashboard>
        <div className="flex flex-wrap gap-2">
          <StatTile label="Total Entries"  value={total.toLocaleString()} color="blue" />
          <StatTile label="Showing"        value={rows.length} />
          <StatTile label="Unique Users"   value={uniqueUsers} />
          <StatTile label="Action Types"   value={uniqueActions} />
        </div>
      </StatusDashboard>

      {/* Filters */}
      <div className="sc-workbar mb-4 mt-2">
        <div className="sc-workbar-meta">
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <History size={12} />
            Audit trail
          </span>
          <span className="sc-workbar-pill inline-flex items-center gap-2">
            <ScanSearch size={12} />
            {rows.length} rows loaded
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted" />
          <input
            className="input-base pl-9 w-44"
            placeholder="Username..."
            value={filters.username}
            onChange={e => setFilters(f => ({ ...f, username: e.target.value, offset: 0 }))}
          />
        </div>
        <input
          className="input-base w-44"
          placeholder="Action..."
          value={filters.action}
          onChange={e => setFilters(f => ({ ...f, action: e.target.value, offset: 0 }))}
        />
        <select
          className="input-base w-32"
          value={filters.limit}
          onChange={e => setFilters(f => ({ ...f, limit: +e.target.value, offset: 0 }))}
        >
          {[50, 100, 250, 500].map(n => <option key={n} value={n}>{n} rows</option>)}
        </select>
        </div>
      </div>

      <div className="sc-surface-block">
        <Table columns={cols} data={rows} emptyText="No audit entries found." />
      </div>

      {/* Pagination */}
      {total > filters.limit && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-scorva-muted">
            Showing {filters.offset + 1}–{Math.min(filters.offset + filters.limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-xs py-1.5"
              disabled={filters.offset === 0}
              onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
            >Previous</button>
            <button
              className="btn-secondary text-xs py-1.5"
              disabled={filters.offset + filters.limit >= total}
              onClick={() => setFilters(f => ({ ...f, offset: f.offset + f.limit }))}
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
