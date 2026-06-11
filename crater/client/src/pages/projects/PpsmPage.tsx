import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Network, Pencil, Plus, Save, Search, Trash2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi, type PpsmApprovalStatus, type PpsmDirection, type PpsmEntry, type PpsmEntryInput, type PpsmProtocol } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { Project } from '@/types/project'

const EMPTY_FORM: PpsmEntryInput = {
  port: '',
  protocol: 'TCP',
  direction: 'INBOUND',
  serviceApplication: '',
  justification: '',
  approvalStatus: 'PENDING',
}

const STATUS_CLASS: Record<PpsmApprovalStatus, string> = {
  APPROVED: 'border-green-matrix/30 bg-green-matrix/10 text-green-matrix',
  PENDING: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400',
  REJECTED: 'border-red-alert/30 bg-red-alert/10 text-red-alert',
  RETIRED: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
}

const DIRECTION_LABEL: Record<PpsmDirection, string> = {
  INBOUND: 'Inbound',
  OUTBOUND: 'Outbound',
  BOTH: 'Both',
}

export default function PpsmPage({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PpsmEntryInput>(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [protocolFilter, setProtocolFilter] = useState<PpsmProtocol | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<PpsmApprovalStatus | 'ALL'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: [...queryKeys.projects.detail(project.id), 'ppsm'],
    queryFn: () => projectsApi.listPpsm(project.id),
  })

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesProtocol = protocolFilter === 'ALL' || entry.protocol === protocolFilter
      const matchesStatus = statusFilter === 'ALL' || entry.approvalStatus === statusFilter
      const matchesSearch =
        !needle ||
        [entry.port, entry.protocol, entry.direction, entry.serviceApplication, entry.justification]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      return matchesProtocol && matchesStatus && matchesSearch
    })
  }, [entries, protocolFilter, query, statusFilter])

  const approvedCount = entries.filter((entry) => entry.approvalStatus === 'APPROVED').length
  const pendingCount = entries.filter((entry) => entry.approvalStatus === 'PENDING').length
  const inboundCount = entries.filter((entry) => entry.direction === 'INBOUND' || entry.direction === 'BOTH').length
  const outboundCount = entries.filter((entry) => entry.direction === 'OUTBOUND' || entry.direction === 'BOTH').length

  const createMutation = useMutation({
    mutationFn: (input: PpsmEntryInput) => projectsApi.createPpsmEntry(project.id, normalizePpsmInput(input)),
    onSuccess: () => {
      refreshPpsm(queryClient, project.id)
      setForm(EMPTY_FORM)
      toast.success('PPSM entry created')
    },
    onError: () => toast.error('Unable to create PPSM entry'),
  })

  const updateMutation = useMutation({
    mutationFn: (input: PpsmEntryInput & { id: string }) => projectsApi.updatePpsmEntry(project.id, input.id, normalizePpsmInput(input)),
    onSuccess: () => {
      refreshPpsm(queryClient, project.id)
      setEditingId(null)
      setForm(EMPTY_FORM)
      toast.success('PPSM entry updated')
    },
    onError: () => toast.error('Unable to update PPSM entry'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.deletePpsmEntry(project.id, id),
    onSuccess: () => {
      refreshPpsm(queryClient, project.id)
      toast.success('PPSM entry removed')
    },
    onError: () => toast.error('Unable to remove PPSM entry'),
  })

  function submitEntry() {
    if (!form.port.trim()) {
      toast.error('Port is required')
      return
    }

    if (!form.serviceApplication.trim()) {
      toast.error('Service/application is required')
      return
    }

    if (editingId) {
      updateMutation.mutate({ ...form, id: editingId })
      return
    }

    createMutation.mutate(form)
  }

  function editEntry(entry: PpsmEntry) {
    setEditingId(entry.id)
    setForm({
      port: entry.port,
      protocol: entry.protocol,
      direction: entry.direction,
      serviceApplication: entry.serviceApplication,
      justification: entry.justification ?? '',
      approvalStatus: entry.approvalStatus,
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="space-y-5">
      <section className="rmf-card active p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hud-label text-slate-600">PORTS PROTOCOLS SERVICES MANAGEMENT</p>
            <h2 className="mt-1 font-mono text-xl text-slate-100">PPSM Tracker</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Track authorized ports, protocols, services, applications, traffic direction, and justification for the system boundary.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
            <Metric label="INBOUND" value={inboundCount} tone="cyan" />
            <Metric label="OUTBOUND" value={outboundCount} tone="cyan" />
            <Metric label="PENDING" value={pendingCount} tone="yellow" />
            <Metric label="APPROVED" value={approvedCount} tone="green" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rmf-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Plus size={17} className="text-cyan-neon" />
              <span className="hud-label">{editingId ? 'EDIT PPSM ENTRY' : 'ADD PPSM ENTRY'}</span>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-secondary px-2 py-1.5" title="Cancel edit">
                <XCircle size={14} />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input-hud w-full" placeholder="Port, e.g. 443" value={form.port} onChange={(event) => setForm({ ...form, port: event.target.value })} />
              <select className="select-hud" value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value as PpsmProtocol })}>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="ICMP">ICMP</option>
              </select>
            </div>
            <input className="input-hud w-full" placeholder="Service / application" value={form.serviceApplication} onChange={(event) => setForm({ ...form, serviceApplication: event.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="select-hud" value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as PpsmDirection })}>
                <option value="INBOUND">Inbound</option>
                <option value="OUTBOUND">Outbound</option>
                <option value="BOTH">Both</option>
              </select>
              <select className="select-hud" value={form.approvalStatus} onChange={(event) => setForm({ ...form, approvalStatus: event.target.value as PpsmApprovalStatus })}>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>
            <textarea className="textarea-hud w-full" placeholder="Business need, system owner approval, boundary rationale..." value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} />
            <button type="button" onClick={submitEntry} disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60">
              {createMutation.isPending || updateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {editingId ? 'SAVE PPSM ENTRY' : 'CREATE PPSM ENTRY'}
            </button>
          </div>
        </div>

        <div className="rmf-card p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="hud-label text-slate-600">PPSM LIBRARY</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">{filtered.length} Entries</h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="input-hud pl-9" placeholder="Search PPSM..." />
              </div>
              <select value={protocolFilter} onChange={(event) => setProtocolFilter(event.target.value as PpsmProtocol | 'ALL')} className="select-hud sm:w-36">
                <option value="ALL">All Protocols</option>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="ICMP">ICMP</option>
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PpsmApprovalStatus | 'ALL')} className="select-hud sm:w-40">
                <option value="ALL">All Status</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="REJECTED">Rejected</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded border border-cyan-neon/10">
            {isLoading ? (
              <p className="p-6 text-center font-mono text-sm text-cyan-neon">LOADING PPSM...</p>
            ) : filtered.length ? (
              <div className="divide-y divide-cyan-neon/10">
                {filtered.map((entry) => (
                  <div key={entry.id} className="grid gap-3 p-4 transition hover:bg-cyan-neon/5 lg:grid-cols-[120px_minmax(0,1fr)_160px_120px] lg:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <Network size={16} className="text-cyan-neon" />
                        <p className="font-mono text-sm text-slate-100">{entry.port}/{entry.protocol}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{DIRECTION_LABEL[entry.direction]}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-slate-100">{entry.serviceApplication}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{entry.justification || 'No justification recorded'}</p>
                    </div>
                    <span className={`w-fit rounded border px-2 py-1 font-mono text-[10px] ${STATUS_CLASS[entry.approvalStatus]}`}>
                      {entry.approvalStatus}
                    </span>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => editEntry(entry)} className="btn-secondary px-2 py-1.5" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => deleteMutation.mutate(entry.id)} className="btn-danger px-2 py-1.5" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">No PPSM entries found.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'green' | 'yellow' }) {
  const toneClass = tone === 'green' ? 'text-green-matrix' : tone === 'yellow' ? 'text-yellow-400' : 'text-cyan-neon'
  return (
    <div className="rounded border border-cyan-neon/10 bg-space-elevated/60 px-3 py-2">
      <p className="hud-label text-slate-600">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function normalizePpsmInput(input: PpsmEntryInput): PpsmEntryInput {
  return {
    port: input.port.trim(),
    protocol: input.protocol,
    direction: input.direction,
    serviceApplication: input.serviceApplication.trim(),
    justification: input.justification?.trim() || undefined,
    approvalStatus: input.approvalStatus,
  }
}

function refreshPpsm(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(projectId), 'ppsm'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
}
