import React, { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi, type ConMonEvent, type ConMonEventType, type ConMonRecurrence } from '@/api/client'
import type { Project } from '@/types/project'
import { useAuth } from '@/hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'calendar' | 'list'

interface VirtualEvent {
  id: string
  title: string
  dueDate: string
  eventType: ConMonEventType
  virtual: true
  severity?: string
}

type CalendarItem = (ConMonEvent & { virtual?: false }) | VirtualEvent

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES: ConMonEventType[] = [
  'CONTROL_ASSESSMENT',
  'POAM_REVIEW',
  'ATO_RENEWAL',
  'SECURITY_REVIEW',
  'SYSTEM_SCAN',
  'TRAINING',
  'CUSTOM',
]

const EVENT_TYPE_LABELS: Record<ConMonEventType, string> = {
  CONTROL_ASSESSMENT: 'Control Assessment',
  POAM_REVIEW: 'POA&M Review',
  ATO_RENEWAL: 'ATO Renewal',
  SECURITY_REVIEW: 'Security Review',
  SYSTEM_SCAN: 'System Scan',
  TRAINING: 'Training',
  CUSTOM: 'Custom',
}

const EVENT_TYPE_COLOR: Record<ConMonEventType, string> = {
  CONTROL_ASSESSMENT: 'bg-purple-electric/20 text-purple-electric border-purple-electric/30',
  POAM_REVIEW: 'bg-red-alert/15 text-red-alert border-red-alert/30',
  ATO_RENEWAL: 'bg-cyan-neon/15 text-cyan-neon border-cyan-neon/30',
  SECURITY_REVIEW: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
  SYSTEM_SCAN: 'bg-green-matrix/15 text-green-matrix border-green-matrix/30',
  TRAINING: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
  CUSTOM: 'bg-slate-400/15 text-slate-400 border-slate-400/30',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-slate-400 border-slate-400/30 bg-slate-400/10',
  IN_PROGRESS: 'text-cyan-neon border-cyan-neon/30 bg-cyan-neon/10',
  COMPLETE: 'text-green-matrix border-green-matrix/30 bg-green-matrix/10',
  OVERDUE: 'text-red-alert border-red-alert/30 bg-red-alert/10',
  CANCELLED: 'text-slate-600 border-slate-600/30 bg-slate-600/10',
}

const RECURRENCE_LABELS: Record<ConMonRecurrence, string> = {
  NONE: 'One-time',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WRITE_ROLES = new Set(['ADMIN', 'SYSTEM_OWNER', 'ISSO', 'ISSM', 'ISSE'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function isOverdue(event: CalendarItem) {
  if ('virtual' in event && event.virtual) return false
  const e = event as ConMonEvent
  if (e.status === 'COMPLETE' || e.status === 'CANCELLED') return false
  return daysUntil(e.dueDate) < 0
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventChip({
  event,
  onClick,
}: {
  event: CalendarItem
  onClick: (e: React.MouseEvent) => void
}) {
  const isVirtual = 'virtual' in event && event.virtual
  const color = EVENT_TYPE_COLOR[event.eventType]
  const overdue = isOverdue(event)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left truncate rounded px-1 py-0.5 font-mono text-[9px] border transition-opacity hover:opacity-80 ${
        isVirtual ? 'border-dashed opacity-70' : ''
      } ${overdue ? 'border-red-alert/50 bg-red-alert/10 text-red-alert' : color}`}
      title={event.title}
    >
      {event.title}
    </button>
  )
}

// ─── Create Event Form ────────────────────────────────────────────────────────

interface CreateFormProps {
  projectId: string
  initialDate?: string
  onClose: () => void
  onCreated: () => void
}

function CreateEventForm({ projectId, initialDate, onClose, onCreated }: CreateFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState<ConMonEventType>('CONTROL_ASSESSMENT')
  const [dueDate, setDueDate] = useState(initialDate ?? isoDate(new Date()))
  const [recurrence, setRecurrence] = useState<ConMonRecurrence>('NONE')
  const [assignedTo, setAssignedTo] = useState('')

  const create = useMutation({
    mutationFn: () =>
      projectsApi.createConMonEvent(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        eventType,
        dueDate: new Date(dueDate + 'T12:00:00').toISOString(),
        recurrence,
        assignedTo: assignedTo.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Event scheduled')
      onCreated()
    },
    onError: () => toast.error('Failed to create event'),
  })

  return (
    <div className="space-y-3">
      <div>
        <label className="hud-label mb-1 block">TITLE</label>
        <input
          className="input-hud w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title..."
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="hud-label mb-1 block">EVENT TYPE</label>
          <select
            className="select-hud w-full"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as ConMonEventType)}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="hud-label mb-1 block">DUE DATE</label>
          <input
            type="date"
            className="input-hud w-full"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="hud-label mb-1 block">RECURRENCE</label>
          <select
            className="select-hud w-full"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as ConMonRecurrence)}
          >
            {(Object.keys(RECURRENCE_LABELS) as ConMonRecurrence[]).map((r) => (
              <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="hud-label mb-1 block">ASSIGNED TO</label>
          <input
            className="input-hud w-full"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Name or role..."
          />
        </div>
      </div>
      <div>
        <label className="hud-label mb-1 block">DESCRIPTION</label>
        <textarea
          className="input-hud w-full"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes..."
          maxLength={1000}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={!title.trim() || !dueDate || create.isPending}
          className="btn-primary flex-1 text-xs disabled:opacity-50"
        >
          {create.isPending ? <Loader2 size={13} className="inline animate-spin mr-1" /> : null}
          SCHEDULE EVENT
        </button>
        <button type="button" onClick={onClose} className="btn-secondary px-4 text-xs">
          CANCEL
        </button>
      </div>
    </div>
  )
}

// ─── Event Detail Panel ───────────────────────────────────────────────────────

interface DetailPanelProps {
  event: ConMonEvent
  projectId: string
  onClose: () => void
  onRefresh: () => void
  canWrite: boolean
}

function EventDetailPanel({ event, projectId, onClose, onRefresh, canWrite }: DetailPanelProps) {
  const days = daysUntil(event.dueDate)
  const overdue = days < 0 && event.status !== 'COMPLETE' && event.status !== 'CANCELLED'

  const complete = useMutation({
    mutationFn: () => projectsApi.completeConMonEvent(projectId, event.id),
    onSuccess: (result) => {
      toast.success(
        result.nextEvent
          ? `Marked complete — next occurrence scheduled for ${formatDate(result.nextEvent.dueDate)}`
          : 'Marked complete',
      )
      onRefresh()
      onClose()
    },
    onError: () => toast.error('Failed to update event'),
  })

  const remove = useMutation({
    mutationFn: () => projectsApi.deleteConMonEvent(projectId, event.id),
    onSuccess: () => {
      toast.success('Event deleted')
      onRefresh()
      onClose()
    },
    onError: () => toast.error('Failed to delete event'),
  })

  const color = EVENT_TYPE_COLOR[event.eventType]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-slate-100 break-words">{event.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${color}`}>
              {EVENT_TYPE_LABELS[event.eventType]}
            </span>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${STATUS_COLOR[event.status] ?? ''}`}>
              {event.status}
            </span>
            {event.recurrence !== 'NONE' && (
              <span className="inline-flex items-center gap-1 rounded border border-cyan-neon/20 bg-cyan-neon/5 px-1.5 py-0.5 font-mono text-[10px] text-cyan-neon">
                <RefreshCw size={8} />
                {RECURRENCE_LABELS[event.recurrence]}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="hud-label">DUE DATE</span>
          <span className={`font-mono ${overdue ? 'text-red-alert' : 'text-slate-300'}`}>
            {formatDate(event.dueDate)}
            {event.status !== 'COMPLETE' && event.status !== 'CANCELLED' && (
              <span className={`ml-2 ${overdue ? 'text-red-alert' : days <= 30 ? 'text-yellow-400' : 'text-slate-500'}`}>
                {overdue ? `${Math.abs(days)}d overdue` : `in ${days}d`}
              </span>
            )}
          </span>
        </div>
        {event.assignedTo && (
          <div className="flex items-center justify-between">
            <span className="hud-label">ASSIGNED TO</span>
            <span className="font-mono text-slate-300">{event.assignedTo}</span>
          </div>
        )}
        {event.controlId && (
          <div className="flex items-center justify-between">
            <span className="hud-label">CONTROL</span>
            <span className="font-mono text-purple-electric">{event.controlId}</span>
          </div>
        )}
        {event.completedAt && (
          <div className="flex items-center justify-between">
            <span className="hud-label">COMPLETED</span>
            <span className="font-mono text-green-matrix">{formatDate(event.completedAt)}</span>
          </div>
        )}
      </div>

      {event.description && (
        <p className="text-xs text-slate-400 leading-5 whitespace-pre-wrap border-t border-cyan-neon/10 pt-3">
          {event.description}
        </p>
      )}

      {canWrite && event.status !== 'COMPLETE' && event.status !== 'CANCELLED' && (
        <div className="flex gap-2 pt-1 border-t border-cyan-neon/10">
          <button
            type="button"
            onClick={() => complete.mutate()}
            disabled={complete.isPending}
            className="btn-primary flex-1 text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {complete.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle2 size={12} />
            )}
            MARK COMPLETE
          </button>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="btn-secondary px-3 text-xs text-red-alert disabled:opacity-50"
            title="Delete event"
          >
            {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

interface CalendarGridProps {
  year: number
  month: number
  events: CalendarItem[]
  onDayClick: (date: string) => void
  onEventClick: (event: CalendarItem) => void
}

function CalendarGrid({ year, month, events, onDayClick, onEventClick }: CalendarGridProps) {
  const today = isoDate(new Date())
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const e of events) {
      const day = e.dueDate.split('T')[0]
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(e)
    }
    return map
  }, [events])

  const cells: Array<{ date: string; dayNum: number; currentMonth: boolean }> = []

  // Pad with prev month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    cells.push({
      date: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      currentMonth: false,
    })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      currentMonth: true,
    })
  }

  // Pad to complete final row
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    cells.push({
      date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      currentMonth: false,
    })
  }

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center hud-label py-1" style={{ fontSize: 9 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px" style={{ background: 'rgba(0,245,255,0.04)' }}>
        {cells.map(({ date, dayNum, currentMonth }) => {
          const cellEvents = eventsByDay.get(date) ?? []
          const isToday = date === today
          const hasOverdue = cellEvents.some((e) => isOverdue(e))

          return (
            <div
              key={date}
              onClick={() => onDayClick(date)}
              className={`min-h-[80px] p-1 cursor-pointer transition-colors hover:bg-white/5 ${
                currentMonth ? 'bg-space-bg/40' : 'bg-space-bg/10'
              } ${isToday ? 'ring-1 ring-inset ring-cyan-neon/40' : ''}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`font-mono text-[11px] ${
                    isToday
                      ? 'text-cyan-neon font-bold'
                      : currentMonth
                        ? 'text-slate-400'
                        : 'text-slate-700'
                  }`}
                >
                  {dayNum}
                </span>
                {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-alert flex-shrink-0" />}
              </div>
              <div className="space-y-0.5">
                {cellEvents.slice(0, 3).map((e) => (
                  <EventChip
                    key={e.id}
                    event={e}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e) }}
                  />
                ))}
                {cellEvents.length > 3 && (
                  <p className="font-mono text-[9px] text-slate-600 text-center">
                    +{cellEvents.length - 3}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Upcoming List View ───────────────────────────────────────────────────────

function UpcomingListView({
  events,
  onEventClick,
}: {
  events: ConMonEvent[]
  onEventClick: (e: ConMonEvent) => void
}) {
  if (events.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <CheckCircle2 size={24} className="text-green-matrix/50" />
        <p className="font-mono text-xs text-slate-500">NO UPCOMING EVENTS</p>
      </div>
    )

  // Group by month
  const grouped = new Map<string, ConMonEvent[]>()
  for (const e of events) {
    const key = new Date(e.dueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(e)
  }

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([monthLabel, monthEvents]) => (
        <div key={monthLabel}>
          <p className="hud-label text-slate-600 mb-2" style={{ fontSize: 9 }}>
            {monthLabel.toUpperCase()}
          </p>
          <div className="divide-y divide-cyan-neon/5">
            {monthEvents.map((e) => {
              const days = daysUntil(e.dueDate)
              const overdue = days < 0 && e.status !== 'COMPLETE' && e.status !== 'CANCELLED'
              const color = EVENT_TYPE_COLOR[e.eventType]

              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onEventClick(e)}
                  className="w-full flex items-center gap-3 py-2.5 px-1 text-left hover:bg-white/5 rounded transition-colors group"
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-xs text-slate-200 group-hover:text-cyan-neon transition-colors truncate`}>
                        {e.title}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] flex-shrink-0 ${color}`}>
                        {EVENT_TYPE_LABELS[e.eventType]}
                      </span>
                      {e.recurrence !== 'NONE' && (
                        <span title={RECURRENCE_LABELS[e.recurrence]}>
                          <RefreshCw size={9} className="text-cyan-neon flex-shrink-0" />
                        </span>
                      )}
                    </div>
                    {e.assignedTo && (
                      <p className="font-mono text-[10px] text-slate-600">{e.assignedTo}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="font-mono text-[11px] text-slate-400">{formatDate(e.dueDate)}</p>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${STATUS_COLOR[e.status] ?? ''}`}>
                      {overdue ? 'OVERDUE' : e.status}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConMonPage({ project }: { project: Project }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = WRITE_ROLES.has(user?.role ?? '')

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [selectedEvent, setSelectedEvent] = useState<ConMonEvent | null>(null)
  const [createDate, setCreateDate] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const calendarKey = ['conmon', project.id, year, month]
  const upcomingKey = ['conmon-upcoming', project.id]

  const { data: calendarEvents = [], refetch: refetchCalendar } = useQuery<ConMonEvent[]>({
    queryKey: calendarKey,
    queryFn: () => projectsApi.listConMonEvents(project.id, year, month),
    staleTime: 30_000,
  })

  const { data: upcomingEvents = [], refetch: refetchUpcoming } = useQuery<ConMonEvent[]>({
    queryKey: upcomingKey,
    queryFn: () => projectsApi.listUpcomingConMon(project.id, 180),
    staleTime: 30_000,
  })

  // Virtual events: ATO expiry + POA&M deadlines derived from project data
  const virtualEvents = useMemo((): VirtualEvent[] => {
    const result: VirtualEvent[] = []
    const p = project as Project & {
      atoExpiry?: string | null
      poamItems?: Array<{
        id: string; weakness: string; severity: string; status: string;
        scheduledCompletion?: string | null; createdAt: string
      }>
    }

    if (p.atoExpiry) {
      result.push({
        id: `virtual-ato-${p.id}`,
        title: 'ATO Expiry',
        dueDate: p.atoExpiry,
        eventType: 'ATO_RENEWAL',
        virtual: true,
      })
    }

    for (const item of p.poamItems ?? []) {
      if (item.status !== 'OPEN' && item.status !== 'IN_REMEDIATION') continue
      let deadline = item.scheduledCompletion
      if (!deadline && item.severity !== 'CRITICAL') {
        const d = new Date(item.createdAt)
        d.setDate(d.getDate() + (item.severity === 'HIGH' ? 180 : 365))
        deadline = d.toISOString()
      }
      if (deadline) {
        result.push({
          id: `virtual-poam-${item.id}`,
          title: `POA&M: ${item.weakness.slice(0, 40)}${item.weakness.length > 40 ? '…' : ''}`,
          dueDate: deadline,
          eventType: 'POAM_REVIEW',
          virtual: true,
          severity: item.severity,
        })
      }
    }
    return result
  }, [project])

  // Merge calendar DB events + virtual events for the displayed month
  const allCalendarItems = useMemo((): CalendarItem[] => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const filtered = virtualEvents.filter((v) => v.dueDate.startsWith(monthStr))
    return [...(calendarEvents as CalendarItem[]), ...(filtered as CalendarItem[])]
  }, [calendarEvents, virtualEvents, year, month])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  function refresh() {
    refetchCalendar()
    refetchUpcoming()
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: calendarKey })
    queryClient.invalidateQueries({ queryKey: upcomingKey })
  }

  function onDayClick(date: string) {
    if (!canWrite) return
    setCreateDate(date)
    setShowCreateForm(true)
    setSelectedEvent(null)
  }

  function onEventClick(event: CalendarItem) {
    if ('virtual' in event && event.virtual) return
    setSelectedEvent(event as ConMonEvent)
    setShowCreateForm(false)
  }

  const overdueCount = upcomingEvents.filter(
    (e) => daysUntil(e.dueDate) < 0 && e.status !== 'COMPLETE' && e.status !== 'CANCELLED',
  ).length
  const dueSoonCount = upcomingEvents.filter((e) => {
    const d = daysUntil(e.dueDate)
    return d >= 0 && d <= 30 && e.status !== 'COMPLETE' && e.status !== 'CANCELLED'
  }).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rmf-card active p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hud-label text-slate-600">CONTINUOUS MONITORING</p>
            <h2 className="mt-1 font-mono text-xl text-slate-100">ConMon Calendar</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Schedule and track recurring assessments, POA&M reviews, ATO renewals, scans, and training events.
              Virtual events (dashed) are computed automatically from project data.
            </p>
          </div>
          <div className="flex gap-3">
            {overdueCount > 0 && (
              <div className="rounded border border-red-alert/30 bg-red-alert/8 px-3 py-2 text-center">
                <p className="hud-label text-red-alert" style={{ fontSize: 9 }}>OVERDUE</p>
                <p className="font-mono text-lg font-bold text-red-alert">{overdueCount}</p>
              </div>
            )}
            {dueSoonCount > 0 && (
              <div className="rounded border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-center">
                <p className="hud-label text-yellow-400" style={{ fontSize: 9 }}>DUE SOON</p>
                <p className="font-mono text-lg font-bold text-yellow-400">{dueSoonCount}</p>
              </div>
            )}
            <div className="rounded border border-cyan-neon/10 bg-space-elevated/60 px-3 py-2 text-center">
              <p className="hud-label text-slate-600" style={{ fontSize: 9 }}>UPCOMING (180D)</p>
              <p className="font-mono text-lg font-bold text-cyan-neon">
                {upcomingEvents.filter((e) => e.status !== 'COMPLETE' && e.status !== 'CANCELLED').length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">

        {/* Calendar / List panel */}
        <div className="rmf-card p-5">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button type="button" onClick={prevMonth} className="btn-secondary p-1.5">
                <ChevronLeft size={14} />
              </button>
              <h3 className="font-mono text-sm text-slate-100 min-w-[160px] text-center">
                {MONTH_NAMES[month - 1]} {year}
              </h3>
              <button type="button" onClick={nextMonth} className="btn-secondary p-1.5">
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
                className="btn-secondary text-[10px] px-2 py-1"
              >
                TODAY
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded border border-cyan-neon/15 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`px-2.5 py-1.5 text-[10px] font-mono transition-colors ${
                    viewMode === 'calendar' ? 'bg-cyan-neon/15 text-cyan-neon' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <CalendarDays size={12} className="inline mr-1" />
                  CALENDAR
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1.5 text-[10px] font-mono transition-colors border-l border-cyan-neon/15 ${
                    viewMode === 'list' ? 'bg-cyan-neon/15 text-cyan-neon' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <List size={12} className="inline mr-1" />
                  LIST
                </button>
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => { setCreateDate(isoDate(new Date())); setShowCreateForm(true); setSelectedEvent(null) }}
                  className="btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <Plus size={13} />
                  NEW EVENT
                </button>
              )}
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <CalendarGrid
              year={year}
              month={month}
              events={allCalendarItems}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
            />
          ) : (
            <UpcomingListView
              events={upcomingEvents}
              onEventClick={(e) => { setSelectedEvent(e); setShowCreateForm(false) }}
            />
          )}

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-cyan-neon/10 flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => (
              <span key={t} className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${EVENT_TYPE_COLOR[t]}`}>
                {EVENT_TYPE_LABELS[t]}
              </span>
            ))}
            <span className="rounded border border-dashed border-slate-600 px-1.5 py-0.5 font-mono text-[9px] text-slate-600">
              Virtual (auto)
            </span>
          </div>
        </div>

        {/* Side panel: Create form or Event detail */}
        <div className="space-y-4">
          {showCreateForm && canWrite && (
            <div className="rmf-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Plus size={15} className="text-cyan-neon" />
                <span className="hud-label">SCHEDULE EVENT</span>
              </div>
              <CreateEventForm
                projectId={project.id}
                initialDate={createDate ?? undefined}
                onClose={() => setShowCreateForm(false)}
                onCreated={() => { setShowCreateForm(false); invalidate() }}
              />
            </div>
          )}

          {selectedEvent && !showCreateForm && (
            <div className="rmf-card p-5">
              <EventDetailPanel
                event={selectedEvent}
                projectId={project.id}
                onClose={() => setSelectedEvent(null)}
                onRefresh={() => { invalidate(); refresh() }}
                canWrite={canWrite}
              />
            </div>
          )}

          {/* Upcoming summary */}
          {!showCreateForm && !selectedEvent && (
            <div className="rmf-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays size={15} className="text-cyan-neon" />
                <span className="hud-label">NEXT 30 DAYS</span>
              </div>
              {(() => {
                const soon = upcomingEvents.filter((e) => {
                  const d = daysUntil(e.dueDate)
                  return d >= -7 && d <= 30 && e.status !== 'COMPLETE' && e.status !== 'CANCELLED'
                })
                if (soon.length === 0)
                  return <p className="font-mono text-xs text-slate-500 py-4 text-center">No events in next 30 days</p>
                return (
                  <div className="divide-y divide-cyan-neon/5">
                    {soon.slice(0, 8).map((e) => {
                      const d = daysUntil(e.dueDate)
                      const overdue = d < 0
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setSelectedEvent(e)}
                          className="w-full flex items-center justify-between gap-2 py-2 px-1 hover:bg-white/5 rounded transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] text-slate-300 truncate">{e.title}</p>
                            <p className={`font-mono text-[9px] mt-0.5 ${overdue ? 'text-red-alert' : 'text-slate-600'}`}>
                              {overdue ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `in ${d}d`}
                            </p>
                          </div>
                          <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] flex-shrink-0 ${EVENT_TYPE_COLOR[e.eventType]}`}>
                            {e.eventType.replace('_', ' ')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
