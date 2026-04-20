import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import PageHeader    from '../components/ui/PageHeader';
import Badge         from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { CheckCheck, Trash2, Bell } from 'lucide-react';
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications.list });

  const markRead    = useMutation({ mutationFn: api.notifications.markRead,    onSuccess: () => qc.invalidateQueries(['notifications']) });
  const markAll     = useMutation({ mutationFn: api.notifications.markAllRead, onSuccess: () => qc.invalidateQueries(['notifications']) });
  const remove      = useMutation({ mutationFn: api.notifications.remove,      onSuccess: () => qc.invalidateQueries(['notifications']) });

  const unread = data.filter(n => !n.read).length;
  const read   = data.length - unread;

  if (isLoading) return <LoadingSpinner />;
  return (
    <div>
      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-center">
          <div className="flex flex-wrap gap-2">
            <StatTile label="Total"  value={data.length} />
            <StatTile label="Unread" value={unread} color={unread > 0 ? 'blue'  : 'default'} />
            <StatTile label="Read"   value={read}   color={read   > 0 ? 'green' : 'default'} />
          </div>
          {data.length > 0 && (
            <div className="flex flex-col gap-2 min-w-[180px]">
              <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest">Read Progress</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-scorva-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.round((read / data.length) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums shrink-0">
                  {Math.round((read / data.length) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </StatusDashboard>
      <PageHeader
        title="Notifications"
        description={`${unread} unread`}
        action={
          unread > 0 && (
            <button className="btn-secondary" onClick={() => markAll.mutate()}>
              <CheckCheck size={14} />
              Mark all read
            </button>
          )
        }
      />

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-scorva-muted">
          <Bell size={36} className="mb-3 opacity-30" />
          <p className="text-sm">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map(n => (
            <div
              key={n.id}
              className={`card p-4 flex items-start gap-4 ${!n.read ? 'border-scorva-accent/30' : ''}`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-scorva-accent' : 'bg-scorva-border'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-scorva-text">{n.title}</span>
                  <Badge label={n.type} variant={n.type} />
                </div>
                {n.message && <p className="text-xs text-scorva-muted">{n.message}</p>}
                <p className="text-xs text-scorva-muted mt-1 font-mono">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {!n.read && (
                  <button
                    className="p-1.5 rounded text-scorva-muted hover:text-emerald-400 hover:bg-scorva-hover"
                    onClick={() => markRead.mutate(n.id)}
                    title="Mark read"
                  >
                    <CheckCheck size={13} />
                  </button>
                )}
                <button
                  className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover"
                  onClick={() => remove.mutate(n.id)}
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
