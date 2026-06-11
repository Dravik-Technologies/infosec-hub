import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileSearch,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi, projectsApi, type AssessmentFinding, type MonitoringTask, type PoamItem, type Step6Dto } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import WizardShell from '@/components/layout/WizardShell'
import type { Project, RmfStepStatus } from '@/types/project'

type MonitorStatus = NonNullable<Step6Dto['monitoringStatus']>
type RiskTrend = NonNullable<Step6Dto['riskTrend']>
type Cadence = NonNullable<Step6Dto['cadence']>

interface Step2Data {
  selectedControlIds?: string[]
  selectedControls?: Array<{ controlId?: string }>
  jsigOverlay?: boolean
}

interface Step3Implementation {
  status?: 'NOT_IMPLEMENTED' | 'PLANNED' | 'PARTIALLY_IMPLEMENTED' | 'IMPLEMENTED' | 'NOT_APPLICABLE'
  statement?: string
  implementationStatement?: string
  inherited?: boolean
}

interface Step3Data {
  implementations?: Record<string, Step3Implementation>
  summary?: {
    total?: number
    implemented?: number
    partial?: number
    planned?: number
    notStarted?: number
    inherited?: number
    percent?: number
  }
}

interface Step4Data {
  findings?: AssessmentFinding[]
  evidenceDiagramIds?: string[]
  summary?: {
    total?: number
    open?: number
    criticalHigh?: number
    closed?: number
  }
}

interface Step6Data extends Step6Dto {}

type ProjectWithWorkflow = Omit<Project, 'rmfSteps'> & {
  diagrams?: unknown[]
  poamItems?: PoamItem[]
  rmfSteps?: Array<{
    stepNumber: number
    status?: RmfStepStatus
    data?: Record<string, unknown> | null
  }>
}

const STATUS_CONFIG: Record<MonitorStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ON_TRACK: {
    label: 'On Track',
    className: 'border-green-matrix/35 bg-green-matrix/10 text-green-matrix',
    icon: CheckCircle2,
  },
  WATCH: {
    label: 'Watch',
    className: 'border-yellow-400/35 bg-yellow-400/10 text-yellow-400',
    icon: AlertTriangle,
  },
  AT_RISK: {
    label: 'At Risk',
    className: 'border-red-alert/35 bg-red-alert/10 text-red-alert',
    icon: AlertTriangle,
  },
}

const TREND_CONFIG: Record<RiskTrend, { label: string; className: string; icon: typeof TrendingUp }> = {
  IMPROVING: {
    label: 'Improving',
    className: 'text-green-matrix',
    icon: TrendingUp,
  },
  STABLE: {
    label: 'Stable',
    className: 'text-cyan-neon',
    icon: Activity,
  },
  DEGRADING: {
    label: 'Degrading',
    className: 'text-red-alert',
    icon: TrendingDown,
  },
}

const CADENCE_LABEL: Record<Cadence, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
}

function getStepData(project: Project, stepNumber: number): Record<string, unknown> {
  return ((project as ProjectWithWorkflow).rmfSteps?.find((step) => step.stepNumber === stepNumber)?.data ?? {}) as Record<string, unknown>
}

function getStep6(project: Project): Step6Data {
  return getStepData(project, 6) as Step6Data
}

function isoToDateInput(value?: string) {
  if (!value) return ''
  return value.slice(0, 10)
}

function dateInputToIso(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined
}

function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function isOpenPoam(item: PoamItem) {
  return item.status === 'OPEN' || item.status === 'IN_REMEDIATION'
}

function isCriticalHigh(value?: string | null) {
  return value === 'CRITICAL' || value === 'HIGH'
}

function deriveMetrics(project: Project) {
  const typed = project as ProjectWithWorkflow
  const step2 = getStepData(project, 2) as Step2Data
  const step3 = getStepData(project, 3) as Step3Data
  const step4 = getStepData(project, 4) as Step4Data
  const implementations = Object.values(step3.implementations ?? {})
  const selectedCount = step2.selectedControlIds?.length ?? step2.selectedControls?.length ?? implementations.length
  const totalControls = step3.summary?.total ?? implementations.length ?? selectedCount
  const implemented = step3.summary?.implemented ?? implementations.filter((item) => item.status === 'IMPLEMENTED' || item.status === 'NOT_APPLICABLE').length
  const partial = step3.summary?.partial ?? implementations.filter((item) => item.status === 'PARTIALLY_IMPLEMENTED').length
  const planned = step3.summary?.planned ?? implementations.filter((item) => item.status === 'PLANNED').length
  const notStarted = step3.summary?.notStarted ?? Math.max(0, totalControls - implemented - partial - planned)
  const inherited = step3.summary?.inherited ?? implementations.filter((item) => item.inherited).length
  const implementationPercent = step3.summary?.percent ?? (totalControls > 0 ? Math.round((implemented / totalControls) * 100) : 0)

  const findings = step4.findings ?? []
  const openFindings = step4.summary?.open ?? findings.filter((item) => item.status === 'OPEN' || item.status === 'IN_REMEDIATION').length
  const criticalHighFindings = step4.summary?.criticalHigh ?? findings.filter((item) => isCriticalHigh(item.severity)).length
  const poams = typed.poamItems ?? []
  const openPoams = poams.filter(isOpenPoam)
  const overduePoams = openPoams.filter((item) => item.scheduledCompletion && new Date(item.scheduledCompletion) < new Date())
  const criticalHighPoams = openPoams.filter((item) => isCriticalHigh(item.severity)).length
  const evidenceItems = (step4.evidenceDiagramIds?.length ?? 0) + (typed.diagrams?.length ?? 0)
  const criticalHighItems = criticalHighFindings + criticalHighPoams
  const penalty = openPoams.length * 2 + overduePoams.length * 6 + openFindings * 3 + criticalHighItems * 5 + (step2.jsigOverlay && criticalHighItems ? 5 : 0)
  const complianceScore = Math.max(0, Math.min(100, Math.round(implementationPercent - penalty)))
  const riskTrend: RiskTrend =
    overduePoams.length > 0 || criticalHighItems > 0 || openFindings > 5
      ? 'DEGRADING'
      : openPoams.length === 0 && openFindings === 0 && implementationPercent >= 90
        ? 'IMPROVING'
        : 'STABLE'
  const monitoringStatus: MonitorStatus = complianceScore >= 85 ? 'ON_TRACK' : complianceScore >= 65 ? 'WATCH' : 'AT_RISK'

  return {
    totalControls,
    implemented,
    partial,
    planned,
    notStarted,
    inherited,
    implementationPercent,
    openFindings,
    criticalHighFindings,
    poams,
    openPoams,
    overduePoams,
    criticalHighPoams,
    criticalHighItems,
    evidenceItems,
    complianceScore,
    riskTrend,
    monitoringStatus,
    jsigOverlay: Boolean(step2.jsigOverlay),
  }
}

function defaultTasks(): MonitoringTask[] {
  return [
    {
      id: `task-${crypto.randomUUID()}`,
      title: 'Review open POA&M milestones and update remediation status',
      owner: 'ISSO',
      dueDate: daysFromNow(30),
      status: 'OPEN',
    },
    {
      id: `task-${crypto.randomUUID()}`,
      title: 'Refresh control evidence and validate implementation status changes',
      owner: 'ISSE',
      dueDate: daysFromNow(45),
      status: 'OPEN',
    },
    {
      id: `task-${crypto.randomUUID()}`,
      title: 'Brief AO/DAO on material risk posture changes',
      owner: 'System Owner',
      dueDate: daysFromNow(90),
      status: 'OPEN',
    },
  ]
}

function taskStatus(task: MonitoringTask): NonNullable<MonitoringTask['status']> {
  if (task.status === 'COMPLETE') return 'COMPLETE'
  if (!task.dueDate) return task.status ?? 'OPEN'
  const due = new Date(task.dueDate)
  const now = new Date()
  const inSevenDays = new Date()
  inSevenDays.setDate(now.getDate() + 7)
  if (due < now) return 'OVERDUE'
  if (due <= inSevenDays) return 'DUE_SOON'
  return task.status ?? 'OPEN'
}

export default function Step6Monitor({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const saved = useMemo(() => getStep6(project), [project])
  const derived = useMemo(() => deriveMetrics(project), [project])

  const [monitoringStatus, setMonitoringStatus] = useState<MonitorStatus>(saved.monitoringStatus ?? derived.monitoringStatus)
  const [riskTrend, setRiskTrend] = useState<RiskTrend>(saved.riskTrend ?? derived.riskTrend)
  const [cadence, setCadence] = useState<Cadence>(saved.cadence ?? 'QUARTERLY')
  const [lastReviewDate, setLastReviewDate] = useState(isoToDateInput(saved.lastReviewDate) || new Date().toISOString().slice(0, 10))
  const [nextReviewDate, setNextReviewDate] = useState(isoToDateInput(saved.nextReviewDate) || daysFromNow(90).slice(0, 10))
  const [recurringTasks, setRecurringTasks] = useState<MonitoringTask[]>(saved.recurringTasks?.length ? saved.recurringTasks : defaultTasks())
  const [monitoringReport, setMonitoringReport] = useState(saved.monitoringReport ?? '')
  const [reportGeneratedAt, setReportGeneratedAt] = useState(saved.reportGeneratedAt)
  const [notes, setNotes] = useState(saved.notes ?? '')

  const complianceScore = saved.complianceScore ?? derived.complianceScore
  const riskMetrics = {
    implementationPercent: derived.implementationPercent,
    openPoams: derived.openPoams.length,
    overduePoams: derived.overduePoams.length,
    openFindings: derived.openFindings,
    criticalHighItems: derived.criticalHighItems,
    evidenceItems: derived.evidenceItems,
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      projectsApi.saveStep6(project.id, {
        monitoringStatus,
        lastReviewDate: dateInputToIso(lastReviewDate),
        nextReviewDate: dateInputToIso(nextReviewDate),
        cadence,
        recurringTasks: recurringTasks
          .filter((task) => task.title.trim().length > 0)
          .map((task) => ({ ...task, status: taskStatus(task) })),
        complianceScore,
        riskTrend,
        riskMetrics: {
          ...riskMetrics,
          implementationPercent: Math.min(100, Math.max(0, Math.round(riskMetrics.implementationPercent ?? 0))),
        },
        monitoringReport: monitoringReport || undefined,
        reportGeneratedAt: reportGeneratedAt || undefined,
        aiGenerated: Boolean(reportGeneratedAt),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('STEP 6 MONITORING RECORD SAVED')
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string; details?: { field: string; message: string }[] } } }
      const serverMsg = axiosErr?.response?.data?.error
      const details = axiosErr?.response?.data?.details
      if (details?.length) {
        console.error('[Step6Monitor] save validation errors:', details)
        toast.error(`SAVE FAILED: ${details[0]?.field} — ${details[0]?.message}`)
      } else {
        toast.error(serverMsg ? `SAVE FAILED: ${serverMsg}` : 'MONITORING SAVE FAILED')
      }
    },
  })

  const generateReport = useMutation({
    mutationFn: () => aiApi.generateMonitoringReport({ projectId: project.id }),
    onSuccess: (result) => {
      setMonitoringReport(result.report)
      setReportGeneratedAt(result.generatedAt)
      setRiskTrend(result.riskTrend)
      setMonitoringStatus(result.complianceScore >= 85 ? 'ON_TRACK' : result.complianceScore >= 65 ? 'WATCH' : 'AT_RISK')
      const recommendedTasks = result.recommendedActions.map((action, index) => ({
        id: `ai-task-${Date.now()}-${index}`,
        title: action,
        owner: index === 0 ? 'ISSO' : 'System Owner',
        dueDate: daysFromNow(index === 0 ? 14 : 30 + index * 15),
        status: 'OPEN' as const,
      }))
      setRecurringTasks((current) => [...current, ...recommendedTasks].slice(0, 12))
      toast.success('AI MONITORING REPORT GENERATED')
    },
    onError: () => toast.error('AI MONITORING REPORT FAILED'),
  })

  function updateTask(id: string, patch: Partial<MonitoringTask>) {
    setRecurringTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)))
  }

  function addTask() {
    setRecurringTasks((current) => [
      ...current,
      {
        id: `task-${crypto.randomUUID()}`,
        title: '',
        owner: '',
        dueDate: daysFromNow(30),
        status: 'OPEN',
      },
    ])
  }

  const StatusIcon = STATUS_CONFIG[monitoringStatus].icon
  const TrendIcon = TREND_CONFIG[riskTrend].icon

  return (
    <WizardShell
      project={project}
      activeStep={6}
      title="Step 6: Monitor"
      eyebrow="CONTINUOUS MONITORING"
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => generateReport.mutate()}
            disabled={generateReport.isPending}
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {generateReport.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            GENERATE REPORT
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            SAVE MONITORING
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rmf-card active p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="hud-label text-slate-600">ONGOING AUTHORIZATION</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">Monitoring Summary</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Maintain the ATO after authorization by tracking control health, assessment refresh, evidence currency, and POA&M execution.
              </p>
            </div>
            <div className={`rounded border px-4 py-3 ${STATUS_CONFIG[monitoringStatus].className}`}>
              <div className="flex items-center gap-2">
                <StatusIcon size={17} />
                <span className="font-mono text-sm">{STATUS_CONFIG[monitoringStatus].label}</span>
              </div>
              <p className="hud-label mt-2 opacity-80">CURRENT POSTURE</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Compliance Score" value={`${complianceScore}%`} icon={Target} tone={complianceScore >= 85 ? 'green' : complianceScore >= 65 ? 'yellow' : 'red'} />
            <MetricCard label="Implemented" value={`${derived.implementationPercent}%`} icon={CheckCircle2} tone="cyan" />
            <MetricCard label="Open POA&Ms" value={String(derived.openPoams.length)} icon={ClipboardList} tone={derived.openPoams.length ? 'yellow' : 'green'} />
            <MetricCard label="Open Findings" value={String(derived.openFindings)} icon={FileSearch} tone={derived.openFindings ? 'red' : 'green'} />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <section className="rmf-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="hud-label text-slate-600">CADENCE</p>
                  <h3 className="mt-1 font-mono text-lg text-slate-100">Review Cycle</h3>
                </div>
                <div className={`inline-flex items-center gap-2 font-mono text-sm ${TREND_CONFIG[riskTrend].className}`}>
                  <TrendIcon size={17} />
                  {TREND_CONFIG[riskTrend].label}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label>
                  <span className="hud-label mb-2 block">STATUS</span>
                  <select value={monitoringStatus} onChange={(event) => setMonitoringStatus(event.target.value as MonitorStatus)} className="select-hud">
                    <option value="ON_TRACK">On Track</option>
                    <option value="WATCH">Watch</option>
                    <option value="AT_RISK">At Risk</option>
                  </select>
                </label>
                <label>
                  <span className="hud-label mb-2 block">CADENCE</span>
                  <select value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)} className="select-hud">
                    {Object.entries(CADENCE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="hud-label mb-2 block">LAST REVIEW</span>
                  <input type="date" value={lastReviewDate} onChange={(event) => setLastReviewDate(event.target.value)} className="input-hud" />
                </label>
                <label>
                  <span className="hud-label mb-2 block">NEXT DUE</span>
                  <input type="date" value={nextReviewDate} onChange={(event) => setNextReviewDate(event.target.value)} className="input-hud" />
                </label>
              </div>
            </section>

            <section className="rmf-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="hud-label text-slate-600">POA&M TRACKING</p>
                  <h3 className="mt-1 font-mono text-lg text-slate-100">Open Remediation Items</h3>
                </div>
                <Link to={`/projects/${project.id}/poam`} className="btn-secondary inline-flex items-center justify-center gap-2 text-xs">
                  OPEN POA&M
                  <ExternalLink size={14} />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {derived.openPoams.length ? (
                  derived.openPoams.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded border border-cyan-neon/10 bg-space-elevated/35 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-mono text-sm text-slate-100">{item.controlId ?? 'UNMAPPED'} — {item.weakness}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{item.description || item.milestonesWithDates || 'No remediation narrative recorded.'}</p>
                        </div>
                        <span className={`rounded border px-2 py-1 font-mono text-[10px] ${isCriticalHigh(item.severity) ? 'border-red-alert/30 bg-red-alert/10 text-red-alert' : 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400'}`}>
                          {item.severity}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Status: {item.status.replace(/_/g, ' ')}</span>
                        <span>Due: {item.scheduledCompletion ? new Date(item.scheduledCompletion).toLocaleDateString() : 'Not scheduled'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={CheckCircle2} title="No Open POA&M Items" body="Current POA&M posture does not show active remediation items." />
                )}
              </div>
            </section>

            <section className="rmf-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="hud-label text-slate-600">RECURRING TASKS</p>
                  <h3 className="mt-1 font-mono text-lg text-slate-100">Monitoring Reminders</h3>
                </div>
                <button type="button" onClick={addTask} className="btn-secondary inline-flex items-center justify-center gap-2 text-xs">
                  <Plus size={14} />
                  ADD TASK
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {recurringTasks.map((task) => {
                  const status = taskStatus(task)
                  return (
                    <div key={task.id} className="grid gap-3 rounded border border-cyan-neon/10 bg-space-elevated/35 p-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_44px]">
                      <input
                        value={task.title}
                        onChange={(event) => updateTask(task.id, { title: event.target.value })}
                        placeholder="Monitoring task"
                        className="input-hud"
                      />
                      <input
                        value={task.owner ?? ''}
                        onChange={(event) => updateTask(task.id, { owner: event.target.value })}
                        placeholder="Owner"
                        className="input-hud"
                      />
                      <input
                        type="date"
                        value={isoToDateInput(task.dueDate)}
                        onChange={(event) => updateTask(task.id, { dueDate: dateInputToIso(event.target.value) })}
                        className="input-hud"
                      />
                      <button
                        type="button"
                        onClick={() => setRecurringTasks((current) => current.filter((item) => item.id !== task.id))}
                        className="inline-flex h-10 items-center justify-center rounded border border-red-alert/25 text-red-alert hover:bg-red-alert/10"
                        aria-label="Remove task"
                      >
                        <Trash2 size={15} />
                      </button>
                      <p className={`hud-label lg:col-span-4 ${status === 'OVERDUE' ? 'text-red-alert' : status === 'DUE_SOON' ? 'text-yellow-400' : status === 'COMPLETE' ? 'text-green-matrix' : 'text-slate-600'}`}>
                        {status.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rmf-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="hud-label text-slate-600">AI-ASSISTED</p>
                  <h3 className="mt-1 font-mono text-lg text-slate-100">Monitoring Report</h3>
                  {reportGeneratedAt && <p className="mt-2 text-xs text-slate-500">Generated {new Date(reportGeneratedAt).toLocaleString()}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => generateReport.mutate()}
                  disabled={generateReport.isPending}
                  className="btn-secondary inline-flex items-center justify-center gap-2 text-xs disabled:opacity-60"
                >
                  {generateReport.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  GENERATE MONITORING REPORT
                </button>
              </div>
              <textarea
                value={monitoringReport}
                onChange={(event) => setMonitoringReport(event.target.value)}
                className="textarea-hud mt-5 min-h-[220px]"
                placeholder="Summarize current authorization posture, POA&M progress, control monitoring, evidence refresh needs, and next actions..."
              />
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rmf-card p-5">
              <p className="hud-label text-slate-600">CONTROL STATUS</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">Implementation Health</h3>
              <div className="mt-5 space-y-3">
                <StatusBar label="Implemented" value={derived.implemented} total={derived.totalControls} className="bg-green-matrix" />
                <StatusBar label="Partial" value={derived.partial} total={derived.totalControls} className="bg-cyan-neon" />
                <StatusBar label="Planned" value={derived.planned} total={derived.totalControls} className="bg-yellow-400" />
                <StatusBar label="Not Started" value={derived.notStarted} total={derived.totalControls} className="bg-red-alert" />
                <StatusBar label="Inherited" value={derived.inherited} total={derived.totalControls} className="bg-purple-electric" />
              </div>
            </section>

            <section className="rmf-card p-5">
              <p className="hud-label text-slate-600">ASSESSMENT REFRESH</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">Evidence & Findings</h3>
              <div className="mt-5 grid gap-3">
                <QuickLink to={`/projects/${project.id}/step/4`} icon={FileSearch} label="Review Step 4 Findings" detail={`${derived.openFindings} open findings`} />
                <QuickLink to={`/projects/${project.id}/step/4`} icon={RefreshCw} label="Refresh Evidence" detail={`${derived.evidenceItems} evidence artifacts tracked`} />
                <QuickLink to={`/projects/${project.id}/poam`} icon={ClipboardList} label="Update POA&M" detail={`${derived.overduePoams.length} overdue milestones`} />
              </div>
            </section>

            <section className="rmf-card p-5">
              <p className="hud-label text-slate-600">RISK METRICS</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">Trend Indicators</h3>
              <div className="mt-5 space-y-3 text-sm">
                <MetricLine label="JSIG Overlay" value={derived.jsigOverlay ? 'Enabled' : 'Disabled'} tone={derived.jsigOverlay ? 'cyan' : 'muted'} />
                <MetricLine label="Critical / High Items" value={String(derived.criticalHighItems)} tone={derived.criticalHighItems ? 'red' : 'green'} />
                <MetricLine label="Overdue POA&Ms" value={String(derived.overduePoams.length)} tone={derived.overduePoams.length ? 'red' : 'green'} />
                <MetricLine label="Next Review" value={nextReviewDate || 'Not set'} tone="cyan" />
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="textarea-hud mt-5"
                placeholder="Add monitoring notes, change summaries, incident observations, or AO/SCA follow-up items..."
              />
            </section>
          </aside>
        </div>
      </div>
    </WizardShell>
  )
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Activity; tone: 'cyan' | 'green' | 'yellow' | 'red' }) {
  const color = {
    cyan: 'text-cyan-neon',
    green: 'text-green-matrix',
    yellow: 'text-yellow-400',
    red: 'text-red-alert',
  }[tone]

  return (
    <div className="rounded border border-cyan-neon/15 bg-space-elevated/35 p-4">
      <div className="flex items-center justify-between">
        <p className="hud-label text-slate-600">{label}</p>
        <Icon size={17} className={color} />
      </div>
      <p className={`mt-4 font-mono text-2xl ${color}`}>{value}</p>
    </div>
  )
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof CheckCircle2; title: string; body: string }) {
  return (
    <div className="rounded border border-cyan-neon/10 bg-space-elevated/35 p-5 text-center">
      <Icon size={20} className="mx-auto text-green-matrix" />
      <p className="mt-3 font-mono text-sm text-slate-100">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{body}</p>
    </div>
  )
}

function StatusBar({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="hud-label text-slate-600">{label}</span>
        <span className="font-mono text-slate-400">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-space">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function QuickLink({ to, icon: Icon, label, detail }: { to: string; icon: typeof FileSearch; label: string; detail: string }) {
  return (
    <Link to={to} className="rounded border border-cyan-neon/10 bg-space-elevated/35 p-4 transition hover:border-cyan-neon/35 hover:bg-cyan-neon/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-slate-100">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <Icon size={18} className="text-cyan-neon" />
      </div>
    </Link>
  )
}

function MetricLine({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'green' | 'red' | 'muted' }) {
  const color = {
    cyan: 'text-cyan-neon',
    green: 'text-green-matrix',
    red: 'text-red-alert',
    muted: 'text-slate-400',
  }[tone]

  return (
    <div className="flex items-center justify-between gap-3 border-b border-cyan-neon/10 pb-3">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  )
}
