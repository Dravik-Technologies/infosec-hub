import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  FileCheck2,
  FileText,
  GitBranch,
  Loader2,
  Play,
  Shield,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import Step0Prepare from '@/pages/wizard/Step0Prepare'
import Step1Categorize from '@/pages/wizard/Step1Categorize'
import Step2Select from '@/pages/wizard/Step2Select'
import Step3Implement from '@/pages/wizard/Step3Implement'
import Step4Assess from '@/pages/wizard/Step4Assess'
import Step5Authorize from '@/pages/wizard/Step5Authorize'
import Step6Monitor from '@/pages/wizard/Step6Monitor'
import PoamPage from '@/pages/projects/PoamPage'
import ArtifactsPage from '@/pages/projects/ArtifactsPage'
import InventoryPage from '@/pages/projects/InventoryPage'
import PpsmPage from '@/pages/projects/PpsmPage'
import AuditLogPage from '@/pages/projects/AuditLogPage'
import TeamPage from '@/pages/projects/TeamPage'
import ConMonPage from '@/pages/projects/ConMonPage'
import type { Project, RmfStep, RmfStepStatus } from '@/types/project'

const projectEditSchema = z.object({
  name: z.string().min(1, 'Required').max(100, 'Max 100 characters'),
  description: z.string().max(2000).optional(),
  impactLevel: z.enum(['LOW', 'MODERATE', 'HIGH']),
  authBoundary: z.string().max(2000).optional(),
})
type ProjectEditFormData = z.infer<typeof projectEditSchema>

const RMF_STEPS = [
  { n: 0, label: 'PREPARE', objective: 'Scope mission, roles, assets, and risk context.' },
  { n: 1, label: 'CATEGORIZE', objective: 'Confirm impact level and information types.' },
  { n: 2, label: 'SELECT', objective: 'Select baseline controls and tailoring decisions.' },
  { n: 3, label: 'IMPLEMENT', objective: 'Document implementation and inherited controls.' },
  { n: 4, label: 'ASSESS', objective: 'Track assessment results and findings.' },
  { n: 5, label: 'AUTHORIZE', objective: 'Prepare authorization package and risk decision.' },
  { n: 6, label: 'MONITOR', objective: 'Maintain continuous monitoring and POA&M cadence.' },
] as const

const STEP_LABEL: Record<RmfStepStatus, string> = {
  COMPLETE: 'Complete',
  IN_PROGRESS: 'In Progress',
  PENDING_REVIEW: 'Pending Review',
  NOT_STARTED: 'Not Started',
}

type ProjectDetailStep = RmfStep & {
  evidence?: unknown[]
  notes?: string | null
  data?: StepData | null
}

interface Step0Data {
  roles?: Record<string, string>
  riskTolerance?: string
  organizationalContext?: string
  boundaryConfirmation?: string
  diagrams?: unknown[]
  artifacts?: unknown[]
}

interface Step1Data {
  selectedInformationTypeIds?: string[]
  impactJustification?: string
  objectiveJustification?: string
  confirmedImpactLevel?: string
  calculatedImpact?: {
    overall?: string
  }
}

interface Step2Data {
  selectedControlIds?: string[]
  baselineControlIds?: string[]
  selectedControls?: unknown[]
  summary?: {
    selected?: number
    baseline?: number
  }
}

type StepData = Step0Data & Step1Data & Step2Data

type ProjectDetail = Omit<Project, 'rmfSteps' | '_count'> & {
  ownerId?: string
  diagrams?: unknown[]
  artifacts?: unknown[]
  poamItems?: unknown[]
  sspLastGeneratedAt?: string | null
  rmfSteps?: ProjectDetailStep[]
  _count?: Project['_count'] & {
    evidence?: number
    evidenceItems?: number
  }
}

function getImpactClass(impactLevel: Project['impactLevel']) {
  if (impactLevel === 'HIGH') return 'text-red-alert border-red-alert/30 bg-red-alert/10'
  if (impactLevel === 'MODERATE') return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
  return 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
}

function getStatusClass(status: Project['status']) {
  if (status === 'AUTHORIZED') return 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
  if (status === 'DENIED' || status === 'EXPIRED') return 'text-red-alert border-red-alert/30 bg-red-alert/10'
  if (status === 'IN_PROGRESS' || status === 'PENDING_ATO') return 'text-cyan-neon border-cyan-neon/30 bg-cyan-neon/10'
  return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
}

function getStep(project: ProjectDetail, stepNumber: number): ProjectDetailStep | undefined {
  return project.rmfSteps?.find((step) => step.stepNumber === stepNumber)
}

function isAssignedRole(role: string | undefined) {
  return Boolean(role?.trim()) && role !== 'Unassigned'
}

function isStep0Complete(project: ProjectDetail) {
  return getStep0Progress(project) === 30
}

function isStep1Complete(project: ProjectDetail) {
  return getStep1Progress(project) === 20
}

function isStep2Complete(project: ProjectDetail) {
  return getStep2Progress(project) === 10
}

function getComputedStepStatus(project: ProjectDetail, stepNumber: number): RmfStepStatus {
  if (stepNumber === 0 && isStep0Complete(project)) return 'COMPLETE'
  if (stepNumber === 1 && isStep1Complete(project)) return 'COMPLETE'
  if (stepNumber === 2 && isStep2Complete(project)) return 'COMPLETE'
  return getStep(project, stepNumber)?.status ?? 'NOT_STARTED'
}

function getStep0Progress(project: ProjectDetail) {
  const data = getStep(project, 0)?.data
  if (!data) return 0

  const assignedRoles = Object.values(data.roles ?? {}).filter(isAssignedRole).length
  const roleProgress = Math.min(assignedRoles / 3, 1) * 8
  const riskProgress = data.riskTolerance?.trim() ? 5 : 0
  const contextProgress = data.organizationalContext?.trim() ? 5 : 0
  const boundaryProgress = data.boundaryConfirmation?.trim() ? 6 : 0
  const diagramProgress = (data.diagrams?.length ?? 0) > 0 ? 6 : 0

  return Math.round(roleProgress + riskProgress + contextProgress + boundaryProgress + diagramProgress)
}

function getStep1Progress(project: ProjectDetail) {
  const data = getStep(project, 1)?.data
  if (!data) return 0

  const informationTypeProgress = (data.selectedInformationTypeIds?.length ?? 0) > 0 ? 8 : 0
  const impactJustificationProgress = data.impactJustification?.trim() ? 6 : 0
  const confirmedImpactProgress = data.confirmedImpactLevel ? 3 : 0
  const objectiveNotesProgress = data.objectiveJustification?.trim() ? 3 : 0

  return informationTypeProgress + impactJustificationProgress + confirmedImpactProgress + objectiveNotesProgress
}

function getStep2Progress(project: ProjectDetail) {
  const data = getStep(project, 2)?.data
  if (!data) return 0

  const selectedCount = data.selectedControlIds?.length ?? data.summary?.selected ?? data.selectedControls?.length ?? 0
  const baselineCount = data.baselineControlIds?.length ?? data.summary?.baseline ?? 0

  return selectedCount > 0 && baselineCount > 0 ? 10 : 0
}

function getFutureStepProgress(project: ProjectDetail) {
  return RMF_STEPS.filter(({ n }) => n >= 3 && getStep(project, n)?.status === 'COMPLETE').length * 10
}

function getAtoProgress(project: ProjectDetail) {
  return Math.min(100, getStep0Progress(project) + getStep1Progress(project) + getStep2Progress(project) + getFutureStepProgress(project))
}

function getEvidenceCount(project: ProjectDetail) {
  const countedEvidence = project._count?.evidence ?? project._count?.evidenceItems
  if (typeof countedEvidence === 'number') return countedEvidence

  return project.rmfSteps?.reduce((sum, step) => sum + (step.evidence?.length ?? 0), 0) ?? 0
}

function getSspStorageKey(projectId: string) {
  return `crater-ssp-last-generated:${projectId}`
}

function parseFilename(contentDisposition: string | undefined) {
  if (!contentDisposition) return 'Crater-SSP.docx'

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])

  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  return filenameMatch?.[1] ?? 'Crater-SSP.docx'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  return url
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not generated yet'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [includeSspDiagrams, setIncludeSspDiagrams] = useState(true)
  const [lastSspGeneratedAt, setLastSspGeneratedAt] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const { data: project, isLoading, isError } = useQuery<ProjectDetail>({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => projectsApi.detail(id!),
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (!project?.id) return

    setLastSspGeneratedAt(project.sspLastGeneratedAt ?? localStorage.getItem(getSspStorageKey(project.id)))
  }, [project?.id, project?.sspLastGeneratedAt])

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<ProjectEditFormData>({ resolver: zodResolver(projectEditSchema) })

  const updateProject = useMutation({
    mutationFn: (data: ProjectEditFormData) =>
      projectsApi.update(project!.id, {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        impactLevel: data.impactLevel,
        authBoundary: data.authBoundary?.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project!.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('SYSTEM UPDATED')
      setIsEditModalOpen(false)
    },
    onError: () => toast.error('UPDATE FAILED'),
  })

  function openEditModal() {
    if (!project) return
    resetEdit({
      name: project.name,
      description: project.description ?? '',
      impactLevel: project.impactLevel,
      authBoundary: project.authBoundary ?? '',
    })
    setIsEditModalOpen(true)
  }

  const workflow = useMemo(() => {
    if (!project) return { completed: 0, percent: 0, currentStep: 0, step0: 0, step1: 0, step2: 0 }

    const completed = RMF_STEPS.filter(({ n }) => getComputedStepStatus(project, n) === 'COMPLETE').length
    const nextStep = RMF_STEPS.find(({ n }) => getComputedStepStatus(project, n) !== 'COMPLETE')?.n ?? 6

    return {
      completed,
      percent: getAtoProgress(project),
      currentStep: nextStep,
      step0: getStep0Progress(project),
      step1: getStep1Progress(project),
      step2: getStep2Progress(project),
    }
  }, [project])

  const generateSsp = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error('Project is not loaded')

      const response = await projectsApi.generateSsp(project.id, includeSspDiagrams)
      const filename = parseFilename(response.headers['content-disposition'])
      const url = downloadBlob(response.data, filename)
      const generatedAt = new Date().toISOString()

      localStorage.setItem(getSspStorageKey(project.id), generatedAt)
      setLastSspGeneratedAt(generatedAt)

      return { filename, url }
    },
    onSuccess: ({ filename, url }) => {
      toast.custom((t) => (
        <div className="rmf-card p-4 shadow-glow-cyan max-w-md">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-green-matrix mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm text-slate-100">SSP GENERATED</p>
              <p className="text-xs text-slate-500 mt-1 truncate">{filename}</p>
              <div className="flex items-center gap-2 mt-3">
                <a href={url} download={filename} className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-xs">
                  <Download size={14} />
                  DOWNLOAD
                </a>
                <button type="button" onClick={() => toast.dismiss(t.id)} className="btn-secondary px-3 py-1.5 text-xs">
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      ))
    },
    onError: () => toast.error('SSP GENERATION FAILED'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-cyan-neon text-sm animate-pulse">LOADING SYSTEM DATA...</span>
      </div>
    )
  }

  if (isError || !project) {
    return (
      <div className="rmf-card p-8 text-center">
        <p className="font-mono text-red-alert">SYSTEM NOT FOUND</p>
        <Link to="/projects" className="btn-secondary inline-flex items-center gap-2 mt-4">
          <ArrowLeft size={16} />
          BACK TO REGISTRY
        </Link>
      </div>
    )
  }

  const controlInstanceCount = project._count?.controlInstances ?? 0
  const totalControlsValue =
    controlInstanceCount > 0
      ? controlInstanceCount
      : (getStep(project, 2)?.data?.selectedControlIds?.length ?? 0)

  const stats = [
    {
      label: 'TOTAL CONTROLS',
      value: totalControlsValue,
      icon: Shield,
      color: 'text-purple-electric',
    },
    {
      label: 'EVIDENCE ITEMS',
      value: project._count?.artifacts ?? project.artifacts?.length ?? getEvidenceCount(project),
      icon: FileCheck2,
      color: 'text-cyan-neon',
    },
    {
      label: 'DIAGRAMS',
      value: project._count?.diagrams ?? project.diagrams?.length ?? 0,
      icon: GitBranch,
      color: 'text-green-matrix',
    },
    {
      label: 'OPEN POA&Ms',
      value: project._count?.poamItems ?? 0,
      icon: AlertTriangle,
      color: 'text-red-alert',
    },
  ]

  return (
    <div className="space-y-6">
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(11,15,25,0.85)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-project-title"
        >
          <div className="rmf-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <span id="edit-project-title" className="hud-label">EDIT SYSTEM</span>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit((data) => updateProject.mutate(data))} className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="hud-label mb-1.5 block">SYSTEM NAME</label>
                <input id="edit-name" {...registerEdit('name')} className="input-hud" />
                {editErrors.name && <p className="font-mono text-red-alert text-xs mt-1">{editErrors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="edit-impact" className="hud-label mb-1.5 block">IMPACT LEVEL (FIPS 199)</label>
                <select id="edit-impact" {...registerEdit('impactLevel')} className="input-hud">
                  <option value="LOW">LOW</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-description" className="hud-label mb-1.5 block">SYSTEM DESCRIPTION</label>
                <textarea id="edit-description" {...registerEdit('description')} className="input-hud" rows={3} />
              </div>
              <div>
                <label htmlFor="edit-boundary" className="hud-label mb-1.5 block">AUTHORIZATION BOUNDARY</label>
                <textarea id="edit-boundary" {...registerEdit('authBoundary')} className="input-hud" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={updateProject.isPending} className="btn-primary flex-1">
                  {updateProject.isPending ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary flex-1">
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            to="/projects"
            className="hud-label inline-flex items-center gap-2 text-slate-600 hover:text-cyan-neon transition-colors"
          >
            <ArrowLeft size={14} />
            REGISTRY
          </Link>
          <h1 className="font-mono text-2xl text-slate-100 mt-3 break-words">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={`font-mono text-xs px-2 py-1 rounded border ${getImpactClass(project.impactLevel)}`}>
              {project.impactLevel} IMPACT
            </span>
            <span className={`font-mono text-xs px-2 py-1 rounded border ${getStatusClass(project.status)}`}>
              {project.status.replace('_', ' ')}
            </span>
            <span className="font-mono text-xs text-slate-600">
              STEP {workflow.currentStep} / 6
            </span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={openEditModal}
            className="btn-secondary inline-flex items-center justify-center gap-2 text-xs"
          >
            <Edit3 size={15} />
            EDIT SYSTEM INFO
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)] gap-4">
        <div className="rmf-card active p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="hud-label text-slate-600">SYSTEM PROFILE</p>
              <h2 className="font-mono text-base text-slate-100 mt-1">AUTHORIZATION BOUNDARY</h2>
            </div>
            <ClipboardCheck size={18} className="text-cyan-neon" />
          </div>

          <div className="space-y-5">
            <InfoBlock label="DESCRIPTION" value={project.description || 'No system description has been recorded.'} />
            <InfoBlock label="AUTHORIZATION BOUNDARY" value={project.authBoundary || 'No authorization boundary has been recorded.'} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rmf-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="hud-label text-slate-600">ATO READINESS</p>
                <p className="font-mono text-3xl font-bold text-cyan-neon mt-2">{workflow.percent}%</p>
              </div>
              <BarChart3 size={24} className="text-cyan-neon" />
            </div>
            <div className="mt-5 h-2 rounded-full bg-space-elevated overflow-hidden">
              <div className="progress-glow-bar h-2 rounded-full" style={{ width: `${workflow.percent}%` }} />
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="hud-label text-slate-600">{workflow.completed} OF 7 STEPS COMPLETE</p>
              <p className="hud-label text-slate-600">CURRENT: STEP {workflow.currentStep}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-2">
                <p className="hud-label text-slate-600">STEP 0</p>
                <p className="font-mono text-sm text-cyan-neon mt-1">{workflow.step0} / 30</p>
              </div>
              <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-2">
                <p className="hud-label text-slate-600">STEP 1</p>
                <p className="font-mono text-sm text-cyan-neon mt-1">{workflow.step1} / 20</p>
              </div>
              <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-2">
                <p className="hud-label text-slate-600">STEP 2</p>
                <p className="font-mono text-sm text-cyan-neon mt-1">{workflow.step2} / 10</p>
              </div>
            </div>
          </div>

          <div className="rmf-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="hud-label text-slate-600">AUTHORIZATION PACKAGE</p>
                <h2 className="font-mono text-base text-slate-100 mt-1">System Security Plan</h2>
                <p className="text-xs text-slate-500 mt-2">
                  Generate a polished DOCX SSP from project profile, RMF steps, controls, POA&Ms, and uploaded diagrams.
                </p>
              </div>
              <FileText size={22} className="text-cyan-neon flex-shrink-0" />
            </div>

            <label className="mt-4 flex items-center justify-between gap-4 rounded border border-cyan-neon/15 bg-space-elevated/40 p-3">
              <span>
                <span className="hud-label block">INCLUDE DIAGRAMS</span>
                <span className="text-xs text-slate-500">Embed supported architecture images when available.</span>
              </span>
              <input
                type="checkbox"
                checked={includeSspDiagrams}
                onChange={(event) => setIncludeSspDiagrams(event.target.checked)}
                className="h-4 w-4 accent-cyan-neon"
              />
            </label>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="hud-label text-slate-600">LAST GENERATED</p>
                <p className="font-mono text-xs text-slate-400 mt-1">{formatDateTime(lastSspGeneratedAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => generateSsp.mutate()}
                disabled={generateSsp.isPending}
                className="btn-primary inline-flex items-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generateSsp.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {generateSsp.isPending ? 'GENERATING...' : 'GENERATE SSP'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rmf-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="hud-label">{label}</span>
              <Icon size={17} className={color} />
            </div>
            <p className={`font-mono text-3xl font-bold mt-4 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <Routes>
        <Route path="step/0" element={<Step0Prepare project={project} />} />
        <Route path="step/1" element={<Step1Categorize project={project} />} />
        <Route path="step/2" element={<Step2Select project={project} />} />
        <Route path="step/3" element={<Step3Implement project={project} />} />
        <Route path="step/4" element={<Step4Assess project={project} />} />
        <Route path="step/5" element={<Step5Authorize project={project} />} />
        <Route path="step/6" element={<Step6Monitor project={project} />} />
        <Route path="poam" element={<PoamPage project={project} />} />
        <Route path="artifacts" element={<ArtifactsPage project={project} />} />
        <Route path="inventory" element={<InventoryPage project={project} />} />
        <Route path="ppsm" element={<PpsmPage project={project} />} />
        <Route path="audit" element={<AuditLogPage project={project} />} />
        <Route path="team" element={<TeamPage project={project} />} />
        <Route path="conmon" element={<ConMonPage project={project} />} />
        <Route path="step/:step" element={<StepWorkspace project={project} />} />
        <Route
          path="*"
          element={
            <div className="rmf-card p-6 text-center">
              <p className="hud-label text-slate-600">SELECT AN RMF STEP FROM THE SIDEBAR TO OPEN ITS WORKSPACE</p>
            </div>
          }
        />
      </Routes>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="hud-label text-slate-600 mb-2">{label}</p>
      <p className="text-sm text-slate-400 leading-6 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function StepWorkspace({ project }: { project: ProjectDetail }) {
  const { step } = useParams<{ step: string }>()
  const stepNumber = Number(step)
  const stepMeta = RMF_STEPS.find((item) => item.n === stepNumber)
  const stepData = Number.isInteger(stepNumber) ? getStep(project, stepNumber) : undefined
  const status = stepData?.status ?? 'NOT_STARTED'

  if (!stepMeta) {
    return (
      <div className="rmf-card p-6">
        <p className="font-mono text-red-alert text-sm">UNKNOWN RMF STEP</p>
      </div>
    )
  }

  return (
    <div className="rmf-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="hud-label text-slate-600">STEP WORKSPACE</p>
          <h3 className="font-mono text-lg text-slate-100 mt-1">
            STEP {stepMeta.n}: {stepMeta.label}
          </h3>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">{stepMeta.objective}</p>
        </div>
        <span className={`font-mono text-xs px-2 py-1 rounded border ${status === 'COMPLETE' ? 'text-green-matrix border-green-matrix/30 bg-green-matrix/10' : 'text-cyan-neon border-cyan-neon/30 bg-cyan-neon/10'}`}>
          {STEP_LABEL[status]}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-4">
          <p className="hud-label">EVIDENCE</p>
          <p className="font-mono text-2xl text-cyan-neon mt-3">{stepData?.evidence?.length ?? 0}</p>
        </div>
        <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-4">
          <p className="hud-label">NOTES</p>
          <p className="text-sm text-slate-500 mt-3">{stepData?.notes || 'No notes recorded.'}</p>
        </div>
        <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-4">
          <p className="hud-label">NEXT ACTION</p>
          <button
            type="button"
            onClick={() => toast('Step workflow actions are queued for Sprint 2')}
            className="btn-primary inline-flex items-center gap-2 mt-3 text-xs"
          >
            <Play size={14} />
            OPEN WIZARD
          </button>
        </div>
      </div>
    </div>
  )
}
