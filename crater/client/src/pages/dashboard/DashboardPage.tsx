import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { projectsApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/hooks/useAuth'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FolderOpen,
  Shield,
  ShieldAlert,
  ShieldOff,
  XCircle,
} from 'lucide-react'
import type { Project, RmfStepStatus } from '@/types/project'

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
type PoamStatus = 'OPEN' | 'IN_REMEDIATION' | 'CLOSED' | 'RISK_ACCEPTED'

interface PoamEntry {
  id: string
  weakness: string
  severity: Severity
  status: PoamStatus
  scheduledCompletion?: string | null
  createdAt: string
}

type StepData = {
  roles?: Record<string, string>
  riskTolerance?: string
  organizationalContext?: string
  boundaryConfirmation?: string
  diagrams?: unknown[]
  selectedInformationTypeIds?: string[]
  impactJustification?: string
  objectiveJustification?: string
  confirmedImpactLevel?: string
  selectedControlIds?: string[]
  baselineControlIds?: string[]
  selectedControls?: unknown[]
  removedControls?: unknown[]
  summary?: { selected?: number; baseline?: number }
}

type DashboardProject = Omit<Project, 'rmfSteps'> & {
  atoExpiry?: string | null
  createdAt?: string
  ownerId?: string
  rmfSteps?: Array<{ stepNumber: number; status?: RmfStepStatus; data?: StepData | null }>
  poamItems?: PoamEntry[]
}

// ─── DCSA deadline matrix ─────────────────────────────────────────────────────

type PoamUrgency = 'BLOCKS_ATO' | 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK'

function poamDeadline(item: PoamEntry): Date | null {
  if (item.scheduledCompletion) return new Date(item.scheduledCompletion)
  if (item.severity === 'CRITICAL') return null
  const d = new Date(item.createdAt)
  d.setDate(d.getDate() + (item.severity === 'HIGH' ? 180 : 365))
  return d
}

function poamUrgency(item: PoamEntry): PoamUrgency {
  if (item.severity === 'CRITICAL') return 'BLOCKS_ATO'
  const deadline = poamDeadline(item)
  if (!deadline) return 'ON_TRACK'
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000)
  if (daysLeft < 0) return 'OVERDUE'
  if (daysLeft <= 30) return 'DUE_SOON'
  return 'ON_TRACK'
}

const URGENCY_ORDER: Record<PoamUrgency, number> = {
  BLOCKS_ATO: 0,
  OVERDUE: 1,
  DUE_SOON: 2,
  ON_TRACK: 3,
}

// ─── ATO status ───────────────────────────────────────────────────────────────

type AtoStatus = 'NOT_AUTHORIZED' | 'EXPIRED' | 'EXPIRING' | 'AUTHORIZED'

function atoStatus(p: DashboardProject): { status: AtoStatus; daysLeft?: number } {
  if (p.status === 'EXPIRED') return { status: 'EXPIRED' }
  if (p.status !== 'AUTHORIZED') return { status: 'NOT_AUTHORIZED' }
  if (!p.atoExpiry) return { status: 'AUTHORIZED' }
  const daysLeft = Math.ceil((new Date(p.atoExpiry).getTime() - Date.now()) / 86_400_000)
  if (daysLeft < 0) return { status: 'EXPIRED', daysLeft }
  if (daysLeft <= 90) return { status: 'EXPIRING', daysLeft }
  return { status: 'AUTHORIZED', daysLeft }
}

// ─── ATO progress helpers ─────────────────────────────────────────────────────

const STEP_LABELS = ['PREPARE', 'CATEGORIZE', 'SELECT', 'IMPLEMENT', 'ASSESS', 'AUTHORIZE', 'MONITOR']

function getStep(p: DashboardProject, n: number) {
  return p.rmfSteps?.find((s) => s.stepNumber === n)
}

function getStep0Progress(p: DashboardProject) {
  const d = getStep(p, 0)?.data
  if (!d) return 0
  const roles = Object.values(d.roles ?? {}).filter((r) => r?.trim() && r !== 'Unassigned').length
  return Math.round(
    Math.min(roles / 3, 1) * 8 +
      (d.riskTolerance?.trim() ? 5 : 0) +
      (d.organizationalContext?.trim() ? 5 : 0) +
      ((d.boundaryConfirmation ?? p.authBoundary)?.trim() ? 6 : 0) +
      ((d.diagrams?.length ?? 0) > 0 || (p._count?.diagrams ?? 0) > 0 ? 6 : 0),
  )
}

function getStep1Progress(p: DashboardProject) {
  const d = getStep(p, 1)?.data
  if (!d) return 0
  return (
    ((d.selectedInformationTypeIds?.length ?? 0) > 0 ? 8 : 0) +
    (d.impactJustification?.trim() ? 6 : 0) +
    (d.confirmedImpactLevel ? 3 : 0) +
    (d.objectiveJustification?.trim() ? 3 : 0)
  )
}

function getStep2Progress(p: DashboardProject) {
  const d = getStep(p, 2)?.data
  if (!d) return 0
  const sel = d.selectedControlIds?.length ?? d.summary?.selected ?? d.selectedControls?.length ?? 0
  const base = d.baselineControlIds?.length ?? d.summary?.baseline ?? 0
  const tail = (d.selectedControls?.length ?? 0) + (d.removedControls?.length ?? 0)
  return (sel > 0 ? 6 : 0) + (base > 0 ? 2 : 0) + (tail > 0 ? 2 : 0)
}

function getAtoProgress(p: DashboardProject) {
  const future = [3, 4, 5, 6].filter((n) => getStep(p, n)?.status === 'COMPLETE').length * 10
  return Math.min(100, getStep0Progress(p) + getStep1Progress(p) + getStep2Progress(p) + future)
}

function getComputedStepStatus(p: DashboardProject, n: number): RmfStepStatus {
  if (n === 0 && getStep0Progress(p) === 30) return 'COMPLETE'
  if (n === 1 && getStep1Progress(p) === 20) return 'COMPLETE'
  if (n === 2 && getStep2Progress(p) === 10) return 'COMPLETE'
  return getStep(p, n)?.status ?? 'NOT_STARTED'
}

function getCurrentStep(p: DashboardProject) {
  const idx = STEP_LABELS.findIndex((_, i) => getComputedStepStatus(p, i) !== 'COMPLETE')
  return idx === -1 ? 6 : idx
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ImpactBadge({ level }: { level: string }) {
  const cls =
    level === 'HIGH'
      ? 'text-red-alert border-red-alert/30 bg-red-alert/10'
      : level === 'MODERATE'
        ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
        : 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
  return (
    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{level}</span>
  )
}

function AtoBadge({ status, daysLeft }: { status: AtoStatus; daysLeft?: number }) {
  if (status === 'NOT_AUTHORIZED')
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border text-slate-400 border-slate-400/30 bg-slate-400/10">
        <ShieldOff size={9} />
        NOT AUTHORIZED
      </span>
    )
  if (status === 'EXPIRED')
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border text-red-alert border-red-alert/30 bg-red-alert/10">
        <XCircle size={9} />
        EXPIRED
      </span>
    )
  if (status === 'EXPIRING')
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border text-yellow-400 border-yellow-400/30 bg-yellow-400/10">
        <Clock size={9} />
        {daysLeft}d LEFT
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border text-green-matrix border-green-matrix/30 bg-green-matrix/10">
      <CheckCircle size={9} />
      AUTHORIZED
    </span>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const cls =
    severity === 'CRITICAL'
      ? 'text-red-alert border-red-alert/30 bg-red-alert/10'
      : severity === 'HIGH'
        ? 'text-orange-400 border-orange-400/30 bg-orange-400/10'
        : severity === 'MODERATE'
          ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
          : 'text-slate-400 border-slate-400/30 bg-slate-400/10'
  return (
    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${cls}`}>
      {severity}
    </span>
  )
}

function UrgencyBadge({ urgency }: { urgency: PoamUrgency }) {
  if (urgency === 'BLOCKS_ATO')
    return (
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border text-red-alert border-red-alert/30 bg-red-alert/15 flex-shrink-0">
        BLOCKS ATO
      </span>
    )
  if (urgency === 'OVERDUE')
    return (
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border text-orange-400 border-orange-400/30 bg-orange-400/10 flex-shrink-0">
        OVERDUE
      </span>
    )
  if (urgency === 'DUE_SOON')
    return (
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border text-yellow-400 border-yellow-400/30 bg-yellow-400/10 flex-shrink-0">
        DUE SOON
      </span>
    )
  return null
}

function formatDeadline(item: PoamEntry): string {
  if (item.severity === 'CRITICAL') return '—'
  const d = poamDeadline(item)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: queryKeys.projects.all,
    queryFn: projectsApi.list,
  })

  const projectDetails = useQueries({
    queries: projects.map((p) => ({
      queryKey: queryKeys.projects.detail(p.id),
      queryFn: () => projectsApi.detail(p.id),
      staleTime: 0,
      refetchOnMount: 'always' as const,
    })),
  })

  const hydrated: DashboardProject[] = projects.map((p, i) => {
    const detail = projectDetails[i]?.data as DashboardProject | undefined
    if (!detail) return p as DashboardProject
    return {
      ...p,
      ...detail,
      _count: { ...p._count, ...detail._count },
    }
  })

  // ── Cross-project POA&M urgency list ──────────────────────────────────────
  const allOpenPoams: Array<PoamEntry & { projectId: string; projectName: string }> = hydrated.flatMap(
    (p) =>
      (p.poamItems ?? [])
        .filter((item) => item.status === 'OPEN' || item.status === 'IN_REMEDIATION')
        .map((item) => ({ ...item, projectId: p.id, projectName: p.name })),
  )
  allOpenPoams.sort((a, b) => URGENCY_ORDER[poamUrgency(a)] - URGENCY_ORDER[poamUrgency(b)])

  // ── Summary counts ────────────────────────────────────────────────────────
  const totalOpenPoams = allOpenPoams.length
  const criticalCount = allOpenPoams.filter((item) => item.severity === 'CRITICAL').length
  const overdueCount = allOpenPoams.filter((item) => {
    const u = poamUrgency(item)
    return u === 'OVERDUE'
  }).length
  const atoStatuses = hydrated.map((p) => atoStatus(p))
  const authorizedCount = atoStatuses.filter((s) => s.status === 'AUTHORIZED').length
  const expiringCount = atoStatuses.filter((s) => s.status === 'EXPIRING').length
  const expiredCount = atoStatuses.filter((s) => s.status === 'EXPIRED').length

  // Projects with critical blockers or expiring ATOs (for alert banners)
  const criticalBlockerProjects = [...new Set(allOpenPoams.filter((i) => i.severity === 'CRITICAL').map((i) => i.projectId))].length
  const expiringAtoProjects = hydrated.filter((p) => {
    const s = atoStatus(p)
    return s.status === 'EXPIRING' || s.status === 'EXPIRED'
  })

  const totalControls = hydrated.reduce((sum, p) => {
    const ci = p._count?.controlInstances ?? 0
    if (ci > 0) return sum + ci
    const sel = p.rmfSteps?.find((s) => s.stepNumber === 2)?.data?.selectedControlIds?.length ?? 0
    return sum + sel
  }, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="hud-label text-slate-600">OPERATOR CONSOLE</p>
        <h1 className="font-mono text-xl text-slate-100 mt-1">
          WELCOME BACK, <span className="text-cyan-neon">{user?.firstName?.toUpperCase()}</span>
        </h1>
      </div>

      {/* ── Alert Banners ───────────────────────────────────────────────────── */}
      {(criticalCount > 0 || expiredCount > 0 || expiringCount > 0) && (
        <div className="space-y-2">
          {criticalCount > 0 && (
            <div className="flex items-center gap-3 rounded border border-red-alert/40 bg-red-alert/8 px-4 py-3">
              <ShieldAlert size={16} className="flex-shrink-0 text-red-alert" />
              <p className="font-mono text-xs text-red-alert">
                {criticalCount} CRITICAL FINDING{criticalCount !== 1 ? 'S' : ''} BLOCKING ATO ACROSS{' '}
                {criticalBlockerProjects} SYSTEM{criticalBlockerProjects !== 1 ? 'S' : ''}
                {overdueCount > 0 && ` — ${overdueCount} ADDITIONAL OVERDUE FINDING${overdueCount !== 1 ? 'S' : ''}`}
              </p>
            </div>
          )}
          {expiredCount > 0 && (
            <div className="flex items-center gap-3 rounded border border-red-alert/30 bg-red-alert/5 px-4 py-3">
              <XCircle size={16} className="flex-shrink-0 text-red-alert" />
              <p className="font-mono text-xs text-red-alert">
                {expiredCount} SYSTEM{expiredCount !== 1 ? 'S' : ''} WITH EXPIRED ATO — IMMEDIATE REAUTHORIZATION REQUIRED
              </p>
            </div>
          )}
          {expiringCount > 0 && (
            <div className="flex items-center gap-3 rounded border border-yellow-400/30 bg-yellow-400/5 px-4 py-3">
              <Clock size={16} className="flex-shrink-0 text-yellow-400" />
              <p className="font-mono text-xs text-yellow-400">
                {expiringCount} SYSTEM{expiringCount !== 1 ? 'S' : ''} WITH ATO EXPIRING WITHIN 90 DAYS
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'ACTIVE SYSTEMS', value: hydrated.length, icon: FolderOpen, color: 'text-cyan-neon' },
          { label: 'TOTAL CONTROLS', value: totalControls, icon: Shield, color: 'text-purple-electric' },
          { label: 'OPEN POA&Ms', value: totalOpenPoams, icon: AlertTriangle, color: totalOpenPoams > 0 ? 'text-red-alert' : 'text-slate-500' },
          { label: 'CRITICAL', value: criticalCount, icon: ShieldAlert, color: criticalCount > 0 ? 'text-red-alert' : 'text-slate-500' },
          { label: 'AUTHORIZED', value: authorizedCount, icon: CheckCircle, color: 'text-green-matrix' },
          { label: 'EXPIRING ATOs', value: expiringCount + expiredCount, icon: Clock, color: (expiringCount + expiredCount) > 0 ? 'text-yellow-400' : 'text-slate-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rmf-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="hud-label" style={{ fontSize: 9 }}>{label}</span>
              <Icon size={14} className={color} />
            </div>
            <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Main panels ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">

        {/* POA&M Urgency Board */}
        <div className="rmf-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-alert" />
              <span className="hud-label">POA&amp;M URGENCY BOARD</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">{totalOpenPoams} OPEN</span>
          </div>

          {allOpenPoams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle size={24} className="text-green-matrix/50" />
              <p className="font-mono text-xs text-slate-500">NO OPEN FINDINGS</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-cyan-neon/5 max-h-[420px] overflow-y-auto">
              {allOpenPoams.slice(0, 20).map((item) => {
                const urgency = poamUrgency(item)
                const deadline = formatDeadline(item)
                return (
                  <Link
                    key={item.id}
                    to={`/projects/${item.projectId}/poam`}
                    className="flex items-start gap-2 py-2.5 hover:bg-white/5 rounded px-1 transition-colors group"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-cyan-neon/20 bg-cyan-neon/5 text-cyan-neon truncate max-w-[120px]">
                          {item.projectName}
                        </span>
                        <SeverityBadge severity={item.severity} />
                        {urgency !== 'ON_TRACK' && <UrgencyBadge urgency={urgency} />}
                      </div>
                      <p className="font-mono text-xs text-slate-300 truncate group-hover:text-slate-100">
                        {item.weakness}
                      </p>
                      {item.severity !== 'CRITICAL' && (
                        <p className="font-mono text-[10px] text-slate-600">
                          DEADLINE: {deadline}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
              {allOpenPoams.length > 20 && (
                <p className="pt-2 text-center font-mono text-[10px] text-slate-600">
                  +{allOpenPoams.length - 20} MORE — NAVIGATE TO PROJECT FOR FULL LIST
                </p>
              )}
            </div>
          )}
        </div>

        {/* ATO Status Panel */}
        <div className="rmf-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-cyan-neon" />
              <span className="hud-label">SYSTEMS STATUS</span>
            </div>
            <Link to="/projects" className="btn-primary text-[10px] py-1 px-2.5">+ NEW SYSTEM</Link>
          </div>

          {hydrated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Shield size={32} className="text-slate-700" />
              <p className="font-mono text-sm text-slate-500">NO SYSTEMS REGISTERED</p>
              <Link to="/projects" className="btn-primary text-xs">INITIALIZE SYSTEM</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cyan-neon/10">
                    <th className="text-left pb-2 hud-label font-normal" style={{ fontSize: 9 }}>SYSTEM</th>
                    <th className="text-left pb-2 hud-label font-normal" style={{ fontSize: 9 }}>IMPACT</th>
                    <th className="text-left pb-2 hud-label font-normal" style={{ fontSize: 9 }}>ATO STATUS</th>
                    <th className="text-right pb-2 hud-label font-normal" style={{ fontSize: 9 }}>POA&amp;Ms</th>
                    <th className="text-right pb-2 hud-label font-normal" style={{ fontSize: 9 }}>PROGRESS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-neon/5">
                  {hydrated.map((p) => {
                    const ato = atoStatus(p)
                    const progress = getAtoProgress(p)
                    const currentStep = getCurrentStep(p)
                    const openPoams = p.poamItems?.filter(
                      (i) => i.status === 'OPEN' || i.status === 'IN_REMEDIATION',
                    ).length ?? (p._count?.poamItems ?? 0)

                    return (
                      <tr
                        key={p.id}
                        className="group hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => (window.location.href = `/projects/${p.id}`)}
                      >
                        <td className="py-2.5 pr-3">
                          <p className="font-mono text-slate-200 group-hover:text-cyan-neon transition-colors truncate max-w-[160px]">
                            {p.name}
                          </p>
                          <p className="hud-label text-slate-600 mt-0.5" style={{ fontSize: 9 }}>
                            STEP {currentStep} — {STEP_LABELS[currentStep]}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3">
                          <ImpactBadge level={p.impactLevel} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <AtoBadge status={ato.status} daysLeft={ato.daysLeft} />
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          {openPoams > 0 ? (
                            <span className="font-mono text-red-alert">{openPoams}</span>
                          ) : (
                            <span className="font-mono text-slate-600">0</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right min-w-[80px]">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 bg-space-elevated rounded-full h-1">
                              <div
                                className="h-1 rounded-full transition-all"
                                style={{
                                  width: `${progress}%`,
                                  background: 'rgba(0,245,255,0.55)',
                                }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 w-7 text-right">
                              {progress}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ATO expiry breakdown footer */}
          {expiringAtoProjects.length > 0 && (
            <div className="mt-4 pt-3 border-t border-cyan-neon/10 space-y-1.5">
              <p className="hud-label text-slate-600" style={{ fontSize: 9 }}>ATO EXPIRY DETAIL</p>
              {expiringAtoProjects.map((p) => {
                const ato = atoStatus(p)
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <Link
                      to={`/projects/${p.id}`}
                      className="font-mono text-[11px] text-slate-400 hover:text-cyan-neon truncate max-w-[200px] transition-colors"
                    >
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.atoExpiry && (
                        <span className="font-mono text-[10px] text-slate-600">
                          {new Date(p.atoExpiry).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                      )}
                      <AtoBadge status={ato.status} daysLeft={ato.daysLeft} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
