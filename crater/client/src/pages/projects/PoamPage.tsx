import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertOctagon,
  Bot,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Edit3,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi, projectsApi, type AiPoamSuggestion, type PoamItem, type PoamItemInput } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { Project } from '@/types/project'

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = PoamItemInput['severity']
type PoamStatus = NonNullable<PoamItemInput['status']>
type Urgency = 'BLOCKS_ATO' | 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'RESOLVED'

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: PoamItemInput = {
  controlId: '',
  weakness: '',
  description: '',
  severity: 'MODERATE',
  status: 'OPEN',
  scheduledCompletion: '',
  milestonesWithDates: '',
  resources: '',
  cost: undefined,
}

const DEADLINE_DAYS: Record<Severity, number | null> = {
  CRITICAL: null,
  HIGH: 180,
  MODERATE: 365,
  LOW: 365,
}

const URGENCY_ORDER: Record<Urgency, number> = {
  BLOCKS_ATO: 0,
  OVERDUE: 1,
  DUE_SOON: 2,
  ON_TRACK: 3,
  RESOLVED: 4,
}

const SEVERITY_CLASS: Record<Severity, string> = {
  CRITICAL: 'border-red-alert/40 bg-red-alert/15 text-red-alert',
  HIGH: 'border-orange-400/40 bg-orange-400/10 text-orange-400',
  MODERATE: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400',
  LOW: 'border-green-matrix/30 bg-green-matrix/10 text-green-matrix',
}

const STATUS_CLASS: Record<PoamStatus, string> = {
  OPEN: 'border-red-alert/30 bg-red-alert/10 text-red-alert',
  IN_REMEDIATION: 'border-cyan-neon/30 bg-cyan-neon/10 text-cyan-neon',
  CLOSED: 'border-green-matrix/30 bg-green-matrix/10 text-green-matrix',
  RISK_ACCEPTED: 'border-purple-electric/30 bg-purple-electric/10 text-purple-electric',
}

const ALL_SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW']
const ALL_STATUSES: PoamStatus[] = ['OPEN', 'IN_REMEDIATION', 'CLOSED', 'RISK_ACCEPTED']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDueDate(item: PoamItem): Date | null {
  if (item.scheduledCompletion) return new Date(item.scheduledCompletion)
  const days = DEADLINE_DAYS[item.severity]
  if (days === null) return null
  const d = new Date(item.createdAt)
  d.setDate(d.getDate() + days)
  return d
}

function getDaysRemaining(item: PoamItem): number | null {
  const due = computeDueDate(item)
  if (!due) return null
  return Math.ceil((due.getTime() - Date.now()) / 86_400_000)
}

function computeUrgency(item: PoamItem): Urgency {
  if (item.status === 'CLOSED' || item.status === 'RISK_ACCEPTED') return 'RESOLVED'
  if (item.severity === 'CRITICAL') return 'BLOCKS_ATO'
  const days = getDaysRemaining(item)
  if (days === null) return 'ON_TRACK'
  if (days < 0) return 'OVERDUE'
  if (days <= 30) return 'DUE_SOON'
  return 'ON_TRACK'
}

function sortByUrgency(a: PoamItem, b: PoamItem): number {
  const ua = computeUrgency(a)
  const ub = computeUrgency(b)
  if (ua !== ub) return URGENCY_ORDER[ua] - URGENCY_ORDER[ub]
  const da = getDaysRemaining(a) ?? 9999
  const db = getDaysRemaining(b) ?? 9999
  return da - db
}

function formatDate(value?: string | Date | null) {
  if (!value) return 'TBD'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value as string))
}

function normalizePoamInput(input: PoamItemInput): PoamItemInput {
  return {
    ...input,
    controlId: input.controlId?.trim() || undefined,
    scheduledCompletion: input.scheduledCompletion
      ? new Date(`${input.scheduledCompletion}T12:00:00.000Z`).toISOString()
      : undefined,
    cost: input.cost != null && !isNaN(Number(input.cost)) ? Number(input.cost) : undefined,
  }
}

function suggestionToPoam(s: AiPoamSuggestion): PoamItemInput {
  return {
    controlId: s.relatedControlIds[0],
    weakness: s.weakness,
    description: s.recommendedMitigation,
    severity: s.severity,
    status: 'OPEN',
    scheduledCompletion: new Date(`${s.suggestedCompletionDate}T12:00:00.000Z`).toISOString(),
    milestonesWithDates: `AI suggested completion: ${s.suggestedCompletionDate}`,
    resources: s.rationale,
  }
}

function exportCsv(items: PoamItem[]) {
  const headers = [
    'Control ID', 'Weakness', 'Description', 'Severity', 'Status',
    'Policy Deadline', 'Scheduled Completion', 'Days Remaining',
    'Resources', 'Milestones', 'Cost', 'Created',
  ]
  const rows = items.map((item) => {
    const due = computeDueDate(item)
    const days = getDaysRemaining(item)
    return [
      item.controlId ?? '',
      item.weakness,
      item.description ?? '',
      item.severity,
      item.status,
      due ? due.toISOString().split('T')[0] : 'N/A',
      item.scheduledCompletion ? item.scheduledCompletion.split('T')[0] : '',
      days !== null ? String(days) : 'N/A',
      item.resources ?? '',
      item.milestonesWithDates ?? '',
      item.cost != null ? String(item.cost) : '',
      item.createdAt.split('T')[0],
    ]
  })
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'poam-export.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ─── Create / Edit Form ───────────────────────────────────────────────────────

function PoamForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  mode,
}: {
  initial: PoamItemInput
  onSubmit: (v: PoamItemInput) => void
  onCancel: () => void
  isPending: boolean
  mode: 'create' | 'edit'
}) {
  const [form, setForm] = useState<PoamItemInput>(initial)
  const set = (patch: Partial<PoamItemInput>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="hud-label mb-1 block">CONTROL ID</label>
          <input
            className="input-hud w-full"
            placeholder="e.g. AC-2"
            value={form.controlId ?? ''}
            onChange={(e) => set({ controlId: e.target.value })}
          />
        </div>
        <div>
          <label className="hud-label mb-1 block">SEVERITY</label>
          <select
            className="select-hud w-full"
            value={form.severity}
            onChange={(e) => set({ severity: e.target.value as Severity })}
          >
            {ALL_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="hud-label mb-1 block">WEAKNESS <span className="text-red-alert">*</span></label>
        <textarea
          className="textarea-hud w-full"
          rows={2}
          placeholder="Describe the weakness or gap..."
          value={form.weakness}
          onChange={(e) => set({ weakness: e.target.value })}
        />
      </div>

      <div>
        <label className="hud-label mb-1 block">DESCRIPTION / MITIGATION</label>
        <textarea
          className="textarea-hud w-full"
          rows={2}
          placeholder="Recommended mitigation or remediation steps..."
          value={form.description ?? ''}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="hud-label mb-1 block">STATUS</label>
          <select
            className="select-hud w-full"
            value={form.status}
            onChange={(e) => set({ status: e.target.value as PoamStatus })}
          >
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="hud-label mb-1 block">SCHEDULED COMPLETION</label>
          <input
            type="date"
            className="input-hud w-full"
            value={form.scheduledCompletion?.slice(0, 10) ?? ''}
            onChange={(e) => set({ scheduledCompletion: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="hud-label mb-1 block">MILESTONES WITH DATES</label>
        <textarea
          className="textarea-hud w-full"
          rows={2}
          placeholder="M1: Patch applied by 2025-06-01&#10;M2: Scan validation by 2025-06-15"
          value={form.milestonesWithDates ?? ''}
          onChange={(e) => set({ milestonesWithDates: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="hud-label mb-1 block">RESOURCES / OWNER</label>
          <input
            className="input-hud w-full"
            placeholder="Team, POC, tools..."
            value={form.resources ?? ''}
            onChange={(e) => set({ resources: e.target.value })}
          />
        </div>
        <div>
          <label className="hud-label mb-1 block">ESTIMATED COST ($)</label>
          <input
            type="number"
            className="input-hud w-full"
            placeholder="0"
            min={0}
            value={form.cost ?? ''}
            onChange={(e) => set({ cost: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            if (!form.weakness.trim()) { toast.error('Weakness is required'); return }
            onSubmit(form)
          }}
          disabled={isPending}
          className="btn-primary flex-1 text-xs inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {mode === 'create' ? 'CREATE POA&M ITEM' : 'SAVE CHANGES'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary px-4 text-xs">
          CANCEL
        </button>
      </div>
    </div>
  )
}

// ─── POA&M Card ───────────────────────────────────────────────────────────────

function PoamCard({
  item,
  selected,
  onSelect,
  onDelete,
  onUpdate,
  onScheduleConMon,
  projectId,
}: {
  item: PoamItem
  selected: boolean
  onSelect: (checked: boolean) => void
  onDelete: () => void
  onUpdate: (patch: Partial<PoamItemInput>) => void
  onScheduleConMon: () => void
  projectId: string
}) {
  const [editing, setEditing] = useState(false)

  const updateMut = useMutation({
    mutationFn: (input: PoamItemInput) =>
      projectsApi.updatePoam(projectId, item.id, normalizePoamInput(input)),
    onSuccess: () => {
      onUpdate({})
      setEditing(false)
      toast.success('POA&M item updated')
    },
    onError: () => toast.error('Unable to update POA&M item'),
  })

  const urgency = computeUrgency(item)
  const daysLeft = getDaysRemaining(item)
  const dueDate = computeDueDate(item)
  const isComputedDeadline = !item.scheduledCompletion && dueDate !== null

  const urgencyBadge =
    urgency === 'BLOCKS_ATO' ? (
      <span className="inline-flex items-center gap-1 rounded border border-red-alert/50 bg-red-alert/15 px-2 py-1 font-mono text-[10px] text-red-alert">
        <AlertOctagon size={10} />
        BLOCKS ATO
      </span>
    ) : urgency === 'OVERDUE' ? (
      <span className="inline-flex items-center gap-1 rounded border border-red-alert/40 bg-red-alert/10 px-2 py-1 font-mono text-[10px] text-red-alert">
        <Clock size={10} />
        {Math.abs(daysLeft!)}d OVERDUE
      </span>
    ) : urgency === 'DUE_SOON' ? (
      <span className="inline-flex items-center gap-1 rounded border border-yellow-400/40 bg-yellow-400/10 px-2 py-1 font-mono text-[10px] text-yellow-400">
        <Clock size={10} />
        {daysLeft}d LEFT
      </span>
    ) : null

  const cardBorder =
    urgency === 'BLOCKS_ATO'
      ? 'border-red-alert/40'
      : urgency === 'OVERDUE'
        ? 'border-red-alert/25'
        : selected
          ? 'border-cyan-neon/40'
          : ''

  if (editing) {
    return (
      <article className={`rmf-card p-4 border-cyan-neon/30`}>
        <div className="flex items-center gap-2 mb-4">
          <Edit3 size={14} className="text-cyan-neon" />
          <span className="hud-label text-cyan-neon">EDITING: {item.weakness.slice(0, 50)}{item.weakness.length > 50 ? '…' : ''}</span>
        </div>
        <PoamForm
          initial={{
            controlId: item.controlId ?? '',
            weakness: item.weakness,
            description: item.description ?? '',
            severity: item.severity,
            status: item.status,
            scheduledCompletion: item.scheduledCompletion?.slice(0, 10) ?? '',
            milestonesWithDates: item.milestonesWithDates ?? '',
            resources: item.resources ?? '',
            cost: item.cost ?? undefined,
          }}
          onSubmit={(v) => updateMut.mutate(v)}
          onCancel={() => setEditing(false)}
          isPending={updateMut.isPending}
          mode="edit"
        />
      </article>
    )
  }

  return (
    <article className={`rmf-card p-4 ${cardBorder}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-1 h-3.5 w-3.5 accent-cyan-neon flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.controlId && (
              <span className="control-id">{item.controlId}</span>
            )}
            <span className={`rounded border px-2 py-1 font-mono text-[10px] ${SEVERITY_CLASS[item.severity]}`}>
              {item.severity}
            </span>
            <span className={`rounded border px-2 py-1 font-mono text-[10px] ${STATUS_CLASS[item.status]}`}>
              {item.status.replace(/_/g, ' ')}
            </span>
            {urgencyBadge}
          </div>

          <h3 className="mt-3 font-mono text-sm text-slate-100">{item.weakness}</h3>
          {item.description && (
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
          )}

          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
            <span className={urgency === 'OVERDUE' ? 'text-red-alert/80' : urgency === 'DUE_SOON' ? 'text-yellow-400/80' : ''}>
              Due: {dueDate ? formatDate(dueDate) : 'N/A'}
              {isComputedDeadline ? ' (policy)' : ''}
            </span>
            <span>Resources: {item.resources || 'TBD'}</span>
            <span className="col-span-1 sm:col-span-1">
              Milestones: {item.milestonesWithDates ? item.milestonesWithDates.slice(0, 60) + (item.milestonesWithDates.length > 60 ? '…' : '') : 'TBD'}
            </span>
            {item.cost != null && (
              <span>Est. Cost: ${item.cost.toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn-secondary px-2 py-1.5"
            title="Edit"
          >
            <Edit3 size={13} />
          </button>
          <button
            type="button"
            onClick={onScheduleConMon}
            className="btn-secondary px-2 py-1.5 text-cyan-neon"
            title="Schedule ConMon review"
          >
            <CalendarPlus size={13} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn-secondary px-2 py-1.5 text-red-alert"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PoamPage({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<AiPoamSuggestion[]>([])
  const [acceptedSuggestionIds, setAcceptedSuggestionIds] = useState<Set<string>>(new Set())

  // Filters
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'ALL'>('ALL')
  const [filterStatus, setFilterStatus] = useState<PoamStatus | 'ALL'>('ALL')

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<PoamStatus>('IN_REMEDIATION')
  const bulkApplying = useRef(false)

  const { data: items = [], isLoading } = useQuery({
    queryKey: [...queryKeys.projects.detail(project.id), 'poam'],
    queryFn: () => projectsApi.listPoam(project.id),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(project.id), 'poam'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
  }

  const createMutation = useMutation({
    mutationFn: (input: PoamItemInput) => projectsApi.createPoam(project.id, normalizePoamInput(input)),
    onSuccess: () => { invalidate(); setShowCreate(false); toast.success('POA&M item created') },
    onError: () => toast.error('Unable to create POA&M item'),
  })

  const deleteMutation = useMutation({
    mutationFn: (poamId: string) => projectsApi.deletePoam(project.id, poamId),
    onSuccess: () => { invalidate(); toast.success('POA&M item removed') },
    onError: () => toast.error('Unable to remove POA&M item'),
  })

  const conmonMutation = useMutation({
    mutationFn: (item: PoamItem) => {
      const due = computeDueDate(item)
      const dueDate = due
        ? due.toISOString()
        : new Date(Date.now() + 30 * 86_400_000).toISOString()
      return projectsApi.createConMonEvent(project.id, {
        title: `POA&M Review: ${item.weakness.slice(0, 80)}`,
        description: item.controlId ? `Control: ${item.controlId}` : undefined,
        eventType: 'POAM_REVIEW',
        dueDate,
        poamItemId: item.id,
      })
    },
    onSuccess: () => toast.success('ConMon review event scheduled'),
    onError: () => toast.error('Failed to schedule ConMon event'),
  })

  const generateSuggestions = useMutation({
    mutationFn: () => aiApi.generatePoamSuggestions({ projectId: project.id, maxSuggestions: 12 }),
    onSuccess: (result) => {
      setSuggestions(result.suggestions)
      setAcceptedSuggestionIds(new Set())
      setSuggestionsOpen(true)
      toast.success(
        result.suggestions.length
          ? `Generated ${result.suggestions.length} POA&M suggestions`
          : 'No implementation gaps found',
      )
    },
    onError: () => toast.error('AI POA&M suggestion generation failed'),
  })

  const acceptSuggestion = useMutation({
    mutationFn: (s: AiPoamSuggestion) => projectsApi.createPoam(project.id, suggestionToPoam(s)),
    onSuccess: (_item, s) => {
      setAcceptedSuggestionIds((c) => new Set(c).add(s.id))
      invalidate()
      toast.success('AI POA&M suggestion accepted')
    },
    onError: () => toast.error('Unable to accept POA&M suggestion'),
  })

  async function acceptAllSuggestions() {
    const pending = suggestions.filter((s) => !acceptedSuggestionIds.has(s.id))
    if (!pending.length) { toast('No pending suggestions'); return }
    if (!window.confirm(`Accept ${pending.length} AI POA&M suggestions?`)) return
    for (const s of pending) await acceptSuggestion.mutateAsync(s)
  }

  async function applyBulkStatus() {
    if (bulkApplying.current || !selected.size) return
    bulkApplying.current = true
    const ids = [...selected]
    try {
      await Promise.all(
        ids.map((id) =>
          projectsApi.updatePoam(project.id, id, { status: bulkStatus }),
        ),
      )
      invalidate()
      setSelected(new Set())
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} updated to ${bulkStatus.replace(/_/g, ' ')}`)
    } catch {
      toast.error('Bulk update failed')
    } finally {
      bulkApplying.current = false
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const sortedItems = useMemo(() => [...items].sort(sortByUrgency), [items])

  const filteredItems = useMemo(() =>
    sortedItems.filter((item) => {
      if (filterSeverity !== 'ALL' && item.severity !== filterSeverity) return false
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          item.weakness.toLowerCase().includes(q) ||
          (item.controlId ?? '').toLowerCase().includes(q) ||
          (item.description ?? '').toLowerCase().includes(q)
        )
      }
      return true
    }),
    [sortedItems, filterSeverity, filterStatus, search],
  )

  const openItems = useMemo(() => items.filter((i) => i.status === 'OPEN' || i.status === 'IN_REMEDIATION'), [items])
  const blocksAtoItems = useMemo(() => openItems.filter((i) => i.severity === 'CRITICAL'), [openItems])
  const overdueItems = useMemo(() => openItems.filter((i) => i.severity !== 'CRITICAL' && (getDaysRemaining(i) ?? 1) < 0), [openItems])

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => selected.has(i.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((s) => {
        const next = new Set(s)
        filteredItems.forEach((i) => next.delete(i.id))
        return next
      })
    } else {
      setSelected((s) => {
        const next = new Set(s)
        filteredItems.forEach((i) => next.add(i.id))
        return next
      })
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="rmf-card active p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hud-label text-slate-600">PLAN OF ACTION AND MILESTONES</p>
            <h2 className="mt-1 font-mono text-xl text-slate-100">POA&M Triage Board</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Track implementation gaps, remediation milestones, and risk posture. Deadlines follow DCSA CAT matrix: CRITICAL blocks ATO, HIGH = 180 days, MODERATE/LOW = 365 days.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportCsv(filteredItems)}
              disabled={!filteredItems.length}
              className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-50"
            >
              <Download size={14} />
              EXPORT CSV
            </button>
            <button
              type="button"
              onClick={() => generateSuggestions.mutate()}
              disabled={generateSuggestions.isPending}
              className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-60"
            >
              {generateSuggestions.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              AI SUGGESTIONS
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="btn-primary inline-flex items-center gap-2 text-xs"
            >
              {showCreate ? <XCircle size={14} /> : <Plus size={14} />}
              {showCreate ? 'CANCEL' : 'NEW ITEM'}
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
          <Metric label="TOTAL" value={items.length} tone="cyan" />
          <Metric label="BLOCKS ATO" value={blocksAtoItems.length} tone="red" alert={blocksAtoItems.length > 0} />
          <Metric label="OVERDUE" value={overdueItems.length} tone="red" alert={overdueItems.length > 0} />
          <Metric label="OPEN / ACTIVE" value={openItems.length} tone="yellow" />
          <Metric label="CLOSED" value={items.filter((i) => i.status === 'CLOSED').length} tone="green" />
        </div>
      </section>

      {/* ── ATO Blocked Banner ──────────────────────────────────────────────── */}
      {blocksAtoItems.length > 0 && (
        <section className="flex items-start gap-3 rounded border border-red-alert/40 bg-red-alert/10 p-4">
          <AlertOctagon size={18} className="mt-0.5 flex-shrink-0 text-red-alert" />
          <div>
            <p className="font-mono text-sm font-bold text-red-alert">
              ATO BLOCKED — {blocksAtoItems.length} CRITICAL FINDING{blocksAtoItems.length > 1 ? 'S' : ''} OPEN
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              DCSA CAT I findings must be remediated or risk-accepted before authorization can be granted.
              Controls: {blocksAtoItems.map((i) => i.controlId).filter(Boolean).join(', ') || 'see items below'}
            </p>
          </div>
        </section>
      )}

      {/* ── Overdue Banner ──────────────────────────────────────────────────── */}
      {overdueItems.length > 0 && (
        <section className="flex items-start gap-3 rounded border border-orange-400/30 bg-orange-400/5 p-4">
          <Clock size={18} className="mt-0.5 flex-shrink-0 text-orange-400" />
          <div>
            <p className="font-mono text-sm font-bold text-orange-400">
              {overdueItems.length} ITEM{overdueItems.length > 1 ? 'S' : ''} PAST DCSA POLICY DEADLINE
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Update scheduled completion dates or escalate to AO for risk acceptance.
            </p>
          </div>
        </section>
      )}

      {/* ── Create Form (inline collapsible) ───────────────────────────────── */}
      {showCreate && (
        <section className="rmf-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={15} className="text-cyan-neon" />
            <span className="hud-label">NEW POA&M ITEM</span>
          </div>
          <PoamForm
            initial={EMPTY_FORM}
            onSubmit={(v) => createMutation.mutate(v)}
            onCancel={() => setShowCreate(false)}
            isPending={createMutation.isPending}
            mode="create"
          />
        </section>
      )}

      {/* ── Filter / Search Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="input-hud flex-1 min-w-[200px]"
          placeholder="Search weakness, control ID, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select-hud"
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as Severity | 'ALL')}
        >
          <option value="ALL">All Severities</option>
          {ALL_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="select-hud"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as PoamStatus | 'ALL')}
        >
          <option value="ALL">All Statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        {(search || filterSeverity !== 'ALL' || filterStatus !== 'ALL') && (
          <button
            type="button"
            onClick={() => { setSearch(''); setFilterSeverity('ALL'); setFilterStatus('ALL') }}
            className="btn-secondary text-xs px-3"
          >
            CLEAR FILTERS
          </button>
        )}
        <span className="font-mono text-xs text-slate-600">
          {filteredItems.length} / {items.length}
        </span>
      </div>

      {/* ── Bulk Action Toolbar ──────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-cyan-neon/30 bg-cyan-neon/5 p-3">
          <span className="font-mono text-xs text-cyan-neon">
            {selected.size} ITEM{selected.size > 1 ? 'S' : ''} SELECTED
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="hud-label">SET STATUS:</span>
            <select
              className="select-hud text-xs"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as PoamStatus)}
            >
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <button
              type="button"
              onClick={applyBulkStatus}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <CheckCircle2 size={13} />
              APPLY TO {selected.size}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="btn-secondary text-xs px-2"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── POA&M List ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rmf-card p-8 text-center font-mono text-sm text-cyan-neon">
          LOADING POA&M ITEMS...
        </div>
      ) : items.length === 0 ? (
        <div className="rmf-card p-8 text-center">
          <ClipboardList size={28} className="mx-auto text-slate-600" />
          <p className="mt-4 font-mono text-sm text-slate-300">NO POA&M ITEMS RECORDED</p>
          <p className="mt-2 text-sm text-slate-500">
            Create one manually or generate AI suggestions from Step 2/3 implementation gaps.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rmf-card p-6 text-center">
          <p className="font-mono text-sm text-slate-500">NO ITEMS MATCH CURRENT FILTERS</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select all row */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 accent-cyan-neon"
            />
            <span className="hud-label text-slate-600">SELECT ALL VISIBLE</span>
          </div>

          {filteredItems.map((item) => (
            <PoamCard
              key={item.id}
              item={item}
              projectId={project.id}
              selected={selected.has(item.id)}
              onSelect={(checked) => {
                setSelected((s) => {
                  const next = new Set(s)
                  checked ? next.add(item.id) : next.delete(item.id)
                  return next
                })
              }}
              onDelete={() => deleteMutation.mutate(item.id)}
              onUpdate={() => invalidate()}
              onScheduleConMon={() => conmonMutation.mutate(item)}
            />
          ))}
        </div>
      )}

      {/* ── AI Suggestions Slide-over ────────────────────────────────────────── */}
      {suggestionsOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-cyan-neon/30 bg-space-card p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="hud-label text-slate-600">AI REVIEW PANEL</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">Suggested POA&M Items</h3>
              <p className="mt-2 text-sm text-slate-500">
                Review AI-generated items before adding them to the official POA&M.
              </p>
            </div>
            <button type="button" onClick={() => setSuggestionsOpen(false)} className="btn-secondary px-3 py-2">
              <X size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={acceptAllSuggestions}
            disabled={acceptSuggestion.isPending || suggestions.every((s) => acceptedSuggestionIds.has(s.id))}
            className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {acceptSuggestion.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            ACCEPT ALL PENDING SUGGESTIONS
          </button>

          <div className="mt-5 space-y-3">
            {suggestions.map((s) => {
              const accepted = acceptedSuggestionIds.has(s.id)
              return (
                <div key={s.id} className="rounded border border-cyan-neon/15 bg-space-elevated p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded border px-2 py-1 font-mono text-[10px] ${SEVERITY_CLASS[s.severity]}`}>
                      {s.severity}
                    </span>
                    <span className="rounded border border-cyan-neon/25 bg-cyan-neon/10 px-2 py-1 font-mono text-[10px] text-cyan-neon">
                      {s.relatedControlIds.join(', ')}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-purple-electric/25 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] text-purple-electric">
                      <Bot size={12} />
                      {s.confidenceScore}% CONF
                    </span>
                    {accepted && (
                      <span className="rounded border border-green-matrix/30 bg-green-matrix/10 px-2 py-1 font-mono text-[10px] text-green-matrix">
                        ACCEPTED
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-mono text-sm text-slate-100">{s.weakness}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{s.recommendedMitigation}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{s.rationale}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                      <CalendarClock size={14} />
                      Due {formatDate(s.suggestedCompletionDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => acceptSuggestion.mutate(s)}
                      disabled={accepted || acceptSuggestion.isPending}
                      className="btn-primary inline-flex items-center gap-2 text-xs disabled:opacity-60"
                    >
                      <CheckCircle2 size={14} />
                      ACCEPT
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Metric tile ──────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  tone,
  alert = false,
}: {
  label: string
  value: number
  tone: 'cyan' | 'red' | 'yellow' | 'green'
  alert?: boolean
}) {
  const color = { cyan: 'text-cyan-neon', red: 'text-red-alert', yellow: 'text-yellow-400', green: 'text-green-matrix' }[tone]
  return (
    <div className={`rounded border p-3 ${alert && value > 0 ? 'border-red-alert/40 bg-red-alert/10' : 'border-cyan-neon/15 bg-space-elevated/40'}`}>
      <p className="hud-label text-slate-600">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
