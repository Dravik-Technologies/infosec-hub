import { NavLink, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  FileArchive,
  HardDrive,
  Loader2,
  Network,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { RmfStepStatus } from '@/types/project'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepData {
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
  summary?: { selected?: number; baseline?: number }
}

type ProjectWithData = {
  id: string
  name: string
  impactLevel: 'LOW' | 'MODERATE' | 'HIGH'
  status: string
  _count?: { poamItems?: number; inventoryItems?: number; ppsmEntries?: number }
  rmfSteps?: Array<{
    stepNumber: number
    status?: RmfStepStatus
    data?: StepData | null
  }>
}

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { n: 0, label: 'Prepare' },
  { n: 1, label: 'Categorize' },
  { n: 2, label: 'Select' },
  { n: 3, label: 'Implement' },
  { n: 4, label: 'Assess' },
  { n: 5, label: 'Authorize' },
  { n: 6, label: 'Monitor' },
] as const

// ─── Progress helpers (mirrors WizardShell / ProjectDetailPage) ───────────────

function getStep(p: ProjectWithData, n: number) {
  return p.rmfSteps?.find((s) => s.stepNumber === n)
}

function getStep0Progress(p: ProjectWithData) {
  const d = getStep(p, 0)?.data
  if (!d) return 0
  const roles = Object.values(d.roles ?? {}).filter((r) => r?.trim() && r !== 'Unassigned').length
  return Math.round(
    Math.min(roles / 3, 1) * 8 +
      (d.riskTolerance?.trim() ? 5 : 0) +
      (d.organizationalContext?.trim() ? 5 : 0) +
      (d.boundaryConfirmation?.trim() ? 6 : 0) +
      ((d.diagrams?.length ?? 0) > 0 ? 6 : 0),
  )
}

function getStep1Progress(p: ProjectWithData) {
  const d = getStep(p, 1)?.data
  if (!d) return 0
  return (
    ((d.selectedInformationTypeIds?.length ?? 0) > 0 ? 8 : 0) +
    (d.impactJustification?.trim() ? 6 : 0) +
    (d.confirmedImpactLevel ? 3 : 0) +
    (d.objectiveJustification?.trim() ? 3 : 0)
  )
}

function getStep2Progress(p: ProjectWithData) {
  const d = getStep(p, 2)?.data
  if (!d) return 0
  const sel = d.selectedControlIds?.length ?? d.summary?.selected ?? d.selectedControls?.length ?? 0
  const base = d.baselineControlIds?.length ?? d.summary?.baseline ?? 0
  return sel > 0 && base > 0 ? 10 : 0
}

function getAtoProgress(p: ProjectWithData) {
  const future = [3, 4, 5, 6].filter((n) => getStep(p, n)?.status === 'COMPLETE').length * 10
  return Math.min(100, getStep0Progress(p) + getStep1Progress(p) + getStep2Progress(p) + future)
}

function getComputedStepStatus(p: ProjectWithData, n: number): RmfStepStatus {
  if (n === 0 && getStep0Progress(p) === 30) return 'COMPLETE'
  if (n === 1 && getStep1Progress(p) === 20) return 'COMPLETE'
  if (n === 2 && getStep2Progress(p) === 10) return 'COMPLETE'
  return getStep(p, n)?.status ?? 'NOT_STARTED'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: RmfStepStatus }) {
  if (status === 'COMPLETE')
    return <CheckCircle2 size={11} className="flex-shrink-0 text-green-matrix" />
  if (status === 'IN_PROGRESS' || status === 'PENDING_REVIEW')
    return <Clock3 size={11} className="flex-shrink-0 text-cyan-neon" />
  return <Circle size={11} className="flex-shrink-0 text-slate-600" />
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors border ${
    isActive
      ? 'bg-cyan-neon/10 text-cyan-neon border-cyan-neon/20'
      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-transparent'
  }`

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectSubnav({ projectId }: { projectId: string }) {
  const { data: project } = useQuery<ProjectWithData>({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectsApi.detail(projectId) as Promise<ProjectWithData>,
    staleTime: 1000 * 30,
  })

  const downloadPackage = useMutation({
    mutationFn: () => projectsApi.generatePackage(projectId),
    onSuccess: (response) => {
      const blob = response.data as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name ?? 'rmf'}-package.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
    onError: () => toast.error('PACKAGE EXPORT FAILED'),
  })

  const progress = project ? getAtoProgress(project) : 0

  const impactCls =
    project?.impactLevel === 'HIGH'
      ? 'text-red-alert border-red-alert/30 bg-red-alert/10'
      : project?.impactLevel === 'MODERATE'
        ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
        : 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'

  const openPoams = project?._count?.poamItems ?? 0

  return (
    <aside
      className="w-[212px] flex-shrink-0 flex flex-col z-10"
      style={{
        background: 'rgb(var(--surface-sidebar) / 0.88)',
        borderRight: '1px solid var(--aegis-border)',
      }}
    >
      {/* ── Project header ──────────────────────────────────────── */}
      <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--aegis-border)' }}>
        <Link
          to={`/projects/${projectId}`}
          className="block group mb-1.5"
          title={project?.name}
        >
          <p className="font-mono text-xs text-slate-100 group-hover:text-cyan-neon transition-colors truncate leading-5">
            {project?.name ?? '—'}
          </p>
        </Link>

        {project && (
          <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border ${impactCls}`}>
            {project.impactLevel} IMPACT
          </span>
        )}

        {/* ATO progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="hud-label text-slate-600" style={{ fontSize: 9 }}>
              ATO PROGRESS
            </span>
            <span className="font-mono text-cyan-neon" style={{ fontSize: 9 }}>
              {progress}%
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-1 rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'rgba(0,245,255,0.55)' }}
            />
          </div>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* RMF Steps */}
        <p
          className="hud-label text-slate-600 px-2 pt-1 pb-1.5"
          style={{ fontSize: 9 }}
        >
          RMF STEPS
        </p>

        {STEPS.map(({ n, label }) => {
          const status = project ? getComputedStepStatus(project, n) : 'NOT_STARTED'
          return (
            <NavLink key={n} to={`/projects/${projectId}/step/${n}`} className={navCls}>
              <StepStatusIcon status={status} />
              <span className="font-mono truncate">
                <span className="text-slate-600 mr-1">{n}.</span>
                {label}
              </span>
            </NavLink>
          )
        })}

        {/* Workspace */}
        <p
          className="hud-label text-slate-600 px-2 pt-3 pb-1.5"
          style={{ fontSize: 9 }}
        >
          WORKSPACE
        </p>

        <NavLink to={`/projects/${projectId}/artifacts`} className={navCls}>
          <FileArchive size={12} className="flex-shrink-0" />
          <span className="font-mono">Artifacts</span>
        </NavLink>

        <NavLink to={`/projects/${projectId}/inventory`} className={navCls}>
          <HardDrive size={12} className="flex-shrink-0" />
          <span className="font-mono">Inventory</span>
          {(project?._count?.inventoryItems ?? 0) > 0 && (
            <span className="ml-auto font-mono text-[9px] text-cyan-neon bg-cyan-neon/10 border border-cyan-neon/20 rounded px-1 flex-shrink-0">
              {project?._count?.inventoryItems}
            </span>
          )}
        </NavLink>

        <NavLink to={`/projects/${projectId}/ppsm`} className={navCls}>
          <Network size={12} className="flex-shrink-0" />
          <span className="font-mono">PPSM</span>
          {(project?._count?.ppsmEntries ?? 0) > 0 && (
            <span className="ml-auto font-mono text-[9px] text-cyan-neon bg-cyan-neon/10 border border-cyan-neon/20 rounded px-1 flex-shrink-0">
              {project?._count?.ppsmEntries}
            </span>
          )}
        </NavLink>

        <NavLink to={`/projects/${projectId}/poam`} className={navCls}>
          <AlertTriangle size={12} className="flex-shrink-0" />
          <span className="font-mono">POA&amp;M</span>
          {openPoams > 0 && (
            <span className="ml-auto font-mono text-[9px] text-red-alert bg-red-alert/10 border border-red-alert/20 rounded px-1 flex-shrink-0">
              {openPoams}
            </span>
          )}
        </NavLink>

        <NavLink to={`/projects/${projectId}/conmon`} className={navCls}>
          <CalendarDays size={12} className="flex-shrink-0" />
          <span className="font-mono">ConMon</span>
        </NavLink>

        <NavLink to={`/projects/${projectId}/team`} className={navCls}>
          <Users size={12} className="flex-shrink-0" />
          <span className="font-mono">Team</span>
        </NavLink>

        <NavLink to={`/projects/${projectId}/audit`} className={navCls}>
          <Activity size={12} className="flex-shrink-0" />
          <span className="font-mono">Audit Log</span>
        </NavLink>

        <button
          type="button"
          onClick={() => downloadPackage.mutate()}
          disabled={downloadPackage.isPending}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent transition-colors disabled:opacity-50"
        >
          {downloadPackage.isPending ? (
            <Loader2 size={12} className="flex-shrink-0 animate-spin" />
          ) : (
            <Download size={12} className="flex-shrink-0" />
          )}
          <span className="font-mono">Export Package</span>
        </button>
      </nav>
    </aside>
  )
}
