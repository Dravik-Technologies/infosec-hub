import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { projectsApi, adminApi, type AuditLogEntry, type AuditLogResponse } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { Project } from '@/types/project'

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
  GENERATE: 'Generate',
  IMPORT: 'Import',
}

const ACTION_CLASS: Record<string, string> = {
  CREATE: 'text-green-matrix border-green-matrix/30 bg-green-matrix/10',
  UPDATE: 'text-cyan-neon border-cyan-neon/30 bg-cyan-neon/10',
  DELETE: 'text-red-alert border-red-alert/30 bg-red-alert/10',
  GENERATE: 'text-purple-electric border-purple-electric/30 bg-purple-electric/10',
  IMPORT: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
}

const ENTITY_LABELS: Record<string, string> = {
  project: 'Project',
  rmf_step: 'RMF Step',
  artifact: 'Artifact',
  diagram: 'Diagram',
  inventory_item: 'Inventory',
  ppsm_entry: 'PPSM',
  poam_item: 'POA&M',
  stig_checklist: 'STIG Checklist',
  project_member: 'Team Member',
  ssp: 'SSP',
  rmf_package: 'RMF Package',
}

const KNOWN_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'GENERATE', 'IMPORT']
const KNOWN_ENTITIES = ['project', 'rmf_step', 'artifact', 'diagram', 'inventory_item', 'ppsm_entry', 'poam_item', 'stig_checklist', 'project_member', 'ssp', 'rmf_package']

const PAGE_SIZE = 25

interface AuditLogPageProps {
  project?: Project
  adminMode?: boolean
}

export default function AuditLogPage({ project, adminMode = false }: AuditLogPageProps) {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const queryParams = {
    action: actionFilter || undefined,
    entityType: entityFilter || undefined,
    from: fromDate || undefined,
    to: toDate ? `${toDate}T23:59:59Z` : undefined,
    page,
    limit: PAGE_SIZE,
  }

  const { data, isLoading } = useQuery<AuditLogResponse>({
    queryKey: adminMode
      ? ['admin', 'audit', queryParams]
      : [...queryKeys.projects.detail(project!.id), 'audit', queryParams],
    queryFn: () =>
      adminMode
        ? adminApi.listAuditLogs(queryParams)
        : projectsApi.listAuditLogs(project!.id, queryParams),
    enabled: adminMode || Boolean(project?.id),
    placeholderData: (prev) => prev,
  })

  const entries = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function resetFilters() {
    setActionFilter('')
    setEntityFilter('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  function exportCsv() {
    if (!entries.length) return
    const header = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Method', 'Path']
    const rows = entries.map((entry) => [
      new Date(entry.timestamp).toISOString(),
      entry.user ? `${entry.user.firstName} ${entry.user.lastName} <${entry.user.email}>` : 'System',
      entry.action,
      entry.entityType,
      entry.entityId ?? '',
      entry.ipAddress ?? '',
      (entry.details as Record<string, string> | null)?.method ?? '',
      (entry.details as Record<string, string> | null)?.path ?? '',
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${project ? project.id : 'platform'}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const hasFilters = actionFilter || entityFilter || fromDate || toDate

  return (
    <div className="space-y-5">
      <section className="rmf-card active p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hud-label text-slate-600">COMPLIANCE AUDIT TRAIL</p>
            <h2 className="mt-1 font-mono text-xl text-slate-100">Audit Log</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {adminMode
                ? 'Platform-wide record of all user actions for security oversight and DCSA assessor review.'
                : 'Record of all changes to this system for accountability and DCSA assessor review.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded border border-cyan-neon/10 bg-space-elevated/60 px-4 py-2 text-center">
              <p className="hud-label text-slate-600">TOTAL ENTRIES</p>
              <p className="mt-1 font-mono text-xl font-bold text-cyan-neon">{total}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rmf-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
              className="select-hud w-36"
            >
              <option value="">All Actions</option>
              {KNOWN_ACTIONS.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
              ))}
            </select>

            <select
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setPage(1) }}
              className="select-hud w-40"
            >
              <option value="">All Entities</option>
              {KNOWN_ENTITIES.map((e) => (
                <option key={e} value={e}>{ENTITY_LABELS[e] ?? e}</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <span className="hud-label text-slate-600 text-[10px]">FROM</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
                className="input-hud w-36"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="hud-label text-slate-600 text-[10px]">TO</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1) }}
                className="input-hud w-36"
              />
            </div>

            {hasFilters && (
              <button type="button" onClick={resetFilters} className="btn-secondary px-2 py-1.5 text-xs">
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={exportCsv}
            disabled={!entries.length}
            className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-40"
          >
            <Download size={14} />
            EXPORT CSV
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded border border-cyan-neon/10">
          {isLoading ? (
            <p className="p-6 text-center font-mono text-sm text-cyan-neon">LOADING AUDIT LOG...</p>
          ) : entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cyan-neon/10 bg-space-elevated/40">
                    <th className="px-4 py-2.5 text-left hud-label text-slate-600 font-normal">TIMESTAMP</th>
                    <th className="px-4 py-2.5 text-left hud-label text-slate-600 font-normal">USER</th>
                    <th className="px-4 py-2.5 text-left hud-label text-slate-600 font-normal">ACTION</th>
                    <th className="px-4 py-2.5 text-left hud-label text-slate-600 font-normal">ENTITY</th>
                    <th className="px-4 py-2.5 text-left hud-label text-slate-600 font-normal">METHOD / PATH</th>
                    <th className="px-4 py-2.5 text-left hud-label text-slate-600 font-normal">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-neon/5">
                  {entries.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <Activity size={28} className="text-slate-700" />
              <p className="font-mono text-sm text-slate-500">NO AUDIT ENTRIES FOUND</p>
              {hasFilters && (
                <button type="button" onClick={resetFilters} className="btn-secondary text-xs px-3 py-1.5">
                  <Search size={13} className="mr-1.5 inline" />
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between">
            <p className="font-mono text-xs text-slate-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary px-2 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="font-mono text-xs text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary px-2 py-1.5 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const details = entry.details as Record<string, string> | null
  const actionCls = ACTION_CLASS[entry.action] ?? 'text-slate-400 border-slate-600 bg-slate-800/40'
  const userName = entry.user
    ? `${entry.user.firstName} ${entry.user.lastName}`
    : 'System'
  const userEmail = entry.user?.email ?? ''

  return (
    <tr className="hover:bg-cyan-neon/5 transition-colors">
      <td className="px-4 py-2.5 font-mono text-slate-400 whitespace-nowrap">
        {new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(entry.timestamp))}
      </td>
      <td className="px-4 py-2.5">
        <p className="font-mono text-slate-200">{userName}</p>
        {userEmail && <p className="text-slate-600 mt-0.5">{userEmail}</p>}
      </td>
      <td className="px-4 py-2.5">
        <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${actionCls}`}>
          {ACTION_LABELS[entry.action] ?? entry.action}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <p className="font-mono text-slate-300">{ENTITY_LABELS[entry.entityType] ?? entry.entityType}</p>
        {entry.entityId && <p className="font-mono text-[10px] text-slate-600 mt-0.5 truncate max-w-[140px]">{entry.entityId}</p>}
      </td>
      <td className="px-4 py-2.5 font-mono text-slate-500">
        {details?.method && (
          <span className="mr-1.5 text-cyan-neon/70">{details.method}</span>
        )}
        <span className="truncate max-w-[200px] inline-block align-bottom">{details?.path ?? '—'}</span>
      </td>
      <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
        {entry.ipAddress ?? '—'}
      </td>
    </tr>
  )
}
