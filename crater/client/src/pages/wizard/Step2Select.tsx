import { type ChangeEvent, type DragEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  Info,
  Loader2,
  MinusCircle,
  PlusCircle,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Wand2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi, api, projectsApi, type AiTailoringRecommendation, type AiTailorControlsResponse } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import WizardShell from '@/components/layout/WizardShell'
import type { ImpactLevel, Project, RmfStepStatus } from '@/types/project'

type TailoringAction = 'BASELINE' | 'ADDED' | 'REMOVED'

interface ControlRecord {
  id: string
  controlId: string
  family: string
  title: string
  description: string
  lowBaseline: boolean
  modBaseline: boolean
  highBaseline: boolean
}

interface ControlResponse {
  id?: string
  controlId?: string
  family?: string
  title?: string
  description?: string
  lowBaseline?: boolean
  modBaseline?: boolean
  highBaseline?: boolean
}

interface TailoringDecision {
  action: TailoringAction
  justification: string
  inherited: boolean
  inheritedFrom: string
}

interface Step2Draft {
  impactLevel: ImpactLevel
  jsigOverlay: boolean
  selectedControlIds: string[]
  tailoring: Record<string, TailoringDecision>
  notes: string
}

interface Step2Payload extends Step2Draft {
  baselineControlIds: string[]
  overlayControlIds: string[]
  selectedControls: Array<{
    controlId: string
    action: TailoringAction
    inherited: boolean
    inheritedFrom?: string
    justification?: string
  }>
  removedControls: Array<{
    controlId: string
    justification: string
  }>
  summary: {
    baseline: number
    selected: number
    added: number
    removed: number
    inherited: number
    jsig: number
  }
}

interface OscalImportSummary {
  baseline: ImpactLevel
  controlsUpdated: number
  controlsAdded: number
  totalControls: number
  importedControlIds: string[]
  message: string
}

type ProjectWithStep2Data = Omit<Project, 'rmfSteps'> & {
  rmfSteps?: Array<{
    id?: string
    stepNumber: number
    status?: RmfStepStatus
    data?: Partial<Step2Draft> | null
  }>
}

const CONTROL_FAMILIES = [
  { id: 'ALL', label: 'All' },
  { id: 'AC', label: 'Access Control' },
  { id: 'AT', label: 'Awareness' },
  { id: 'AU', label: 'Audit' },
  { id: 'CA', label: 'Assessment' },
  { id: 'CM', label: 'Configuration' },
  { id: 'CP', label: 'Contingency' },
  { id: 'IA', label: 'Identity' },
  { id: 'IR', label: 'Incident' },
  { id: 'MA', label: 'Maintenance' },
  { id: 'MP', label: 'Media' },
  { id: 'PE', label: 'Physical' },
  { id: 'PL', label: 'Planning' },
  { id: 'PM', label: 'Program' },
  { id: 'PS', label: 'Personnel' },
  { id: 'PT', label: 'Privacy' },
  { id: 'RA', label: 'Risk' },
  { id: 'SA', label: 'Acquisition' },
  { id: 'SC', label: 'Protection' },
  { id: 'SI', label: 'Integrity' },
  { id: 'SR', label: 'Supply Chain' },
] as const

const JSIG_OVERLAY_CONTROL_IDS = new Set([
  'AC-3(10)',
  'AC-4(1)',
  'AC-4(2)',
  'AC-4(6)',
  'AC-4(8)',
  'AC-4(10)',
  'AC-4(12)',
  'AC-4(17)',
  'AC-4(19)',
  'AC-4(21)',
  'AC-16(1)',
  'AC-16(2)',
  'AC-16(6)',
  'AU-10(1)',
  'AU-10(2)',
  'AU-10(3)',
  'AU-10(4)',
  'AT-2(1)',
  'PS-3(1)',
  'PS-3(2)',
  'PS-6(3)',
  'IA-2(3)',
  'IA-2(4)',
  'IA-3(1)',
  'IA-5(3)',
  'IA-5(4)',
  'SC-3(1)',
  'SC-3(2)',
  'SC-3(3)',
  'SC-3(4)',
  'SC-3(5)',
  'SC-31(1)',
  'SC-31(2)',
  'SC-32(1)',
  'SC-46',
  'SI-6(1)',
  'SI-6(2)',
  'SI-13(1)',
  'SI-13(4)',
])

const FALLBACK_CONTROLS: ControlRecord[] = [
  control('AC-1', 'AC', 'Policy and Procedures', true, true, true),
  control('AC-2', 'AC', 'Account Management', true, true, true),
  control('AC-3', 'AC', 'Access Enforcement', true, true, true),
  control('AC-6', 'AC', 'Least Privilege', false, true, true),
  control('AC-17', 'AC', 'Remote Access', true, true, true),
  control('AT-2', 'AT', 'Literacy Training and Awareness', true, true, true),
  control('AT-3', 'AT', 'Role-Based Training', false, true, true),
  control('AU-1', 'AU', 'Policy and Procedures', true, true, true),
  control('AU-2', 'AU', 'Event Logging', true, true, true),
  control('AU-6', 'AU', 'Audit Record Review, Analysis, and Reporting', false, true, true),
  control('AU-9', 'AU', 'Protection of Audit Information', false, true, true),
  control('AU-12', 'AU', 'Audit Record Generation', true, true, true),
  control('CA-2', 'CA', 'Control Assessments', true, true, true),
  control('CA-7', 'CA', 'Continuous Monitoring', false, true, true),
  control('CM-1', 'CM', 'Policy and Procedures', true, true, true),
  control('CM-2', 'CM', 'Baseline Configuration', true, true, true),
  control('CM-6', 'CM', 'Configuration Settings', true, true, true),
  control('CM-7', 'CM', 'Least Functionality', true, true, true),
  control('CP-2', 'CP', 'Contingency Plan', true, true, true),
  control('IA-1', 'IA', 'Policy and Procedures', true, true, true),
  control('IA-2', 'IA', 'Identification and Authentication', true, true, true),
  control('IA-5', 'IA', 'Authenticator Management', true, true, true),
  control('IA-8', 'IA', 'Non-Organizational User Identification', true, true, true),
  control('IR-1', 'IR', 'Policy and Procedures', true, true, true),
  control('IR-4', 'IR', 'Incident Handling', true, true, true),
  control('IR-6', 'IR', 'Incident Reporting', true, true, true),
  control('PL-2', 'PL', 'System Security and Privacy Plans', true, true, true),
  control('RA-1', 'RA', 'Policy and Procedures', true, true, true),
  control('RA-3', 'RA', 'Risk Assessment', true, true, true),
  control('RA-5', 'RA', 'Vulnerability Monitoring and Scanning', false, true, true),
  control('SA-9', 'SA', 'External System Services', false, true, true),
  control('SC-1', 'SC', 'Policy and Procedures', true, true, true),
  control('SC-7', 'SC', 'Boundary Protection', true, true, true),
  control('SC-13', 'SC', 'Cryptographic Protection', false, true, true),
  control('SC-28', 'SC', 'Protection of Information at Rest', false, true, true),
  control('SI-1', 'SI', 'Policy and Procedures', true, true, true),
  control('SI-2', 'SI', 'Flaw Remediation', true, true, true),
  control('SI-3', 'SI', 'Malicious Code Protection', true, true, true),
  control('SI-4', 'SI', 'System Monitoring', false, true, true),
]

function control(
  controlId: string,
  family: string,
  title: string,
  lowBaseline: boolean,
  modBaseline: boolean,
  highBaseline: boolean,
): ControlRecord {
  return {
    id: controlId,
    controlId,
    family,
    title,
    description: `${title} - NIST SP 800-53 Rev. 5, ${controlId}`,
    lowBaseline,
    modBaseline,
    highBaseline,
  }
}

function getStorageKey(projectId: string) {
  return `crater-step-2-select:${projectId}`
}

function isControlInBaseline(controlItem: ControlRecord, impactLevel: ImpactLevel) {
  if (impactLevel === 'LOW') return controlItem.lowBaseline
  if (impactLevel === 'MODERATE') return controlItem.lowBaseline || controlItem.modBaseline
  return controlItem.lowBaseline || controlItem.modBaseline || controlItem.highBaseline
}

function isJsigOverlayControl(controlId: string) {
  return JSIG_OVERLAY_CONTROL_IDS.has(controlId)
}

function isControlInSelectedBaseline(controlItem: ControlRecord, draft: Pick<Step2Draft, 'impactLevel' | 'jsigOverlay'>) {
  return isControlInBaseline(controlItem, draft.impactLevel) || (draft.jsigOverlay && isJsigOverlayControl(controlItem.controlId))
}

function normalizeControl(item: ControlResponse): ControlRecord | null {
  if (!item.controlId || !item.family || !item.title) return null
  if (!item.controlId.includes('-')) return null

  return {
    id: item.id ?? item.controlId,
    controlId: item.controlId,
    family: item.family,
    title: item.title,
    description: item.description ?? `${item.title} - NIST SP 800-53 Rev. 5, ${item.controlId}`,
    lowBaseline: Boolean(item.lowBaseline),
    modBaseline: Boolean(item.modBaseline),
    highBaseline: Boolean(item.highBaseline),
  }
}

async function fetchControls() {
  const response = await api.get<ControlResponse[] | { data: ControlResponse[] }>('/controls')
  const records = Array.isArray(response.data) ? response.data : response.data.data
  const normalized = records.map(normalizeControl).filter((item): item is ControlRecord => Boolean(item))

  if (!normalized.length) throw new Error('No NIST 800-53 controls returned')
  return normalized.sort((a, b) => a.controlId.localeCompare(b.controlId, undefined, { numeric: true }))
}

function getBackendStep2Data(project: Project) {
  return (project as ProjectWithStep2Data).rmfSteps?.find((step) => step.stepNumber === 2)?.data ?? null
}

function normalizeDraft(project: Project, draft?: Partial<Step2Draft> | null): Step2Draft {
  return {
    impactLevel: draft?.impactLevel ?? project.impactLevel,
    jsigOverlay: draft?.jsigOverlay ?? false,
    selectedControlIds: draft?.selectedControlIds ?? [],
    tailoring: draft?.tailoring ?? {},
    notes: draft?.notes ?? '',
  }
}

function readCachedDraft(project: Project): Step2Draft | null {
  const raw = localStorage.getItem(getStorageKey(project.id))
  if (!raw) return null

  try {
    return normalizeDraft(project, JSON.parse(raw) as Partial<Step2Draft>)
  } catch {
    localStorage.removeItem(getStorageKey(project.id))
    return null
  }
}

function getInitialDraft(project: Project): Step2Draft {
  const backendData = getBackendStep2Data(project)
  if (backendData) return normalizeDraft(project, backendData)

  return readCachedDraft(project) ?? normalizeDraft(project)
}

function getDefaultDecision(action: TailoringAction): TailoringDecision {
  return {
    action,
    justification: '',
    inherited: false,
    inheritedFrom: '',
  }
}

function getDecision(draft: Step2Draft, controlId: string, baseline: boolean): TailoringDecision {
  return draft.tailoring[controlId] ?? getDefaultDecision(baseline ? 'BASELINE' : 'ADDED')
}

function getBaselineControlIds(controls: ControlRecord[], draft: Pick<Step2Draft, 'impactLevel' | 'jsigOverlay'>) {
  return controls.filter((item) => isControlInSelectedBaseline(item, draft)).map((item) => item.controlId)
}

function buildPayload(draft: Step2Draft, controls: ControlRecord[]): Step2Payload {
  const baselineControlIds = getBaselineControlIds(controls, draft)
  const overlayControlIds = draft.jsigOverlay
    ? controls.filter((item) => isJsigOverlayControl(item.controlId)).map((item) => item.controlId)
    : []
  const selectedSet = new Set(draft.selectedControlIds)
  const baselineSet = new Set(baselineControlIds)
  const selectedControls = draft.selectedControlIds.map((controlId) => {
    const action: TailoringAction = baselineSet.has(controlId) ? 'BASELINE' : 'ADDED'
    const decision = draft.tailoring[controlId] ?? getDefaultDecision(action)

    return {
      controlId,
      action,
      inherited: decision.inherited,
      inheritedFrom: decision.inheritedFrom || undefined,
      justification: decision.justification || undefined,
    }
  })
  const removedControls = baselineControlIds
    .filter((controlId) => !selectedSet.has(controlId))
    .map((controlId) => ({
      controlId,
      justification: draft.tailoring[controlId]?.justification ?? '',
    }))

  return {
    ...draft,
    baselineControlIds,
    overlayControlIds,
    selectedControls,
    removedControls,
    summary: {
      baseline: baselineControlIds.length,
      selected: draft.selectedControlIds.length,
      added: selectedControls.filter((item) => item.action === 'ADDED').length,
      removed: removedControls.length,
      inherited: selectedControls.filter((item) => item.inherited).length,
      jsig: overlayControlIds.length,
    },
  }
}

function upsertStep2InProject(project: Project, payload: Step2Payload): Project {
  const existingSteps = (project as ProjectWithStep2Data).rmfSteps ?? []
  const status: RmfStepStatus = payload.selectedControlIds.length > 0 ? 'COMPLETE' : 'IN_PROGRESS'
  const step2 = {
    id: existingSteps.find((step) => step.stepNumber === 2)?.id ?? `local-step-2-${project.id}`,
    stepNumber: 2,
    status,
    data: payload,
  }

  return {
    ...project,
    rmfSteps: [...existingSteps.filter((step) => step.stepNumber !== 2), step2],
    _count: {
      ...project._count,
      controlInstances: payload.selectedControlIds.length,
    },
  } as Project
}

function impactClass(impactLevel: ImpactLevel) {
  if (impactLevel === 'HIGH') return 'text-red-alert border-red-alert/30 bg-red-alert/10'
  if (impactLevel === 'MODERATE') return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
  return 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
}

function formatActionLabel(action: TailoringAction) {
  if (action === 'BASELINE') return 'Baseline'
  if (action === 'ADDED') return 'Added'
  return 'Removed'
}

export default function Step2Select({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Step2Draft>(() => getInitialDraft(project))
  const [search, setSearch] = useState('')
  const [activeFamily, setActiveFamily] = useState<(typeof CONTROL_FAMILIES)[number]['id']>('ALL')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [oscalFile, setOscalFile] = useState<File | null>(null)
  const [applyImportedBaseline, setApplyImportedBaseline] = useState(true)
  const [isImportDragOver, setIsImportDragOver] = useState(false)
  const [importSummary, setImportSummary] = useState<OscalImportSummary | null>(null)
  const [tailoringPanelOpen, setTailoringPanelOpen] = useState(false)
  const [tailoringRecommendations, setTailoringRecommendations] = useState<AiTailorControlsResponse | null>(null)
  const [selectedRecommendationIds, setSelectedRecommendationIds] = useState<Set<string>>(new Set())

  const controlsQuery = useQuery({
    queryKey: ['nist-800-53-controls'],
    queryFn: fetchControls,
    retry: false,
  })

  const controls = controlsQuery.data ?? FALLBACK_CONTROLS
  const baselineControlIds = useMemo(
    () => getBaselineControlIds(controls, draft),
    [controls, draft],
  )
  const baselineSet = useMemo(() => new Set(baselineControlIds), [baselineControlIds])
  const selectedSet = useMemo(() => new Set(draft.selectedControlIds), [draft.selectedControlIds])
  const jsigOverlayControlIds = useMemo(
    () => controls.filter((item) => isJsigOverlayControl(item.controlId)).map((item) => item.controlId),
    [controls],
  )

  useEffect(() => {
    setDraft((current) => {
      if (current.selectedControlIds.length > 0) return current

      return {
        ...current,
        selectedControlIds: baselineControlIds,
      }
    })
  }, [baselineControlIds])

  useEffect(() => {
    localStorage.setItem(getStorageKey(project.id), JSON.stringify(draft))
  }, [draft, project.id])

  const filteredControls = useMemo(() => {
    const term = search.trim().toLowerCase()

    return controls.filter((item) => {
      const selected = selectedSet.has(item.controlId)
      const matchesFamily = activeFamily === 'ALL' || item.family === activeFamily
      const matchesSearch =
        !term ||
        item.controlId.toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)

      return matchesFamily && matchesSearch && (!showSelectedOnly || selected)
    })
  }, [activeFamily, controls, search, selectedSet, showSelectedOnly])

  const summary = useMemo(() => buildPayload(draft, controls).summary, [controls, draft])
  const coverage = baselineControlIds.length ? Math.round(((summary.baseline - summary.removed) / baselineControlIds.length) * 100) : 0
  const jsigEnabled = draft.jsigOverlay

  const saveStep2 = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(draft, controls)

      localStorage.setItem(getStorageKey(project.id), JSON.stringify(payload))
      await projectsApi.saveStep2(project.id, payload)
      return payload
    },
    onSuccess: (payload) => {
      queryClient.setQueryData<Project>(queryKeys.projects.detail(project.id), (current) =>
        current ? upsertStep2InProject(current, payload) : current,
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      toast.success('STEP 2 CONTROL SELECTION SAVED')
    },
    onError: () => toast.error('STEP 2 SAVE FAILED'),
  })

  const importOscalBaseline = useMutation({
    mutationFn: async () => {
      if (!oscalFile) throw new Error('No OSCAL file selected')

      const formData = new FormData()
      formData.append('file', oscalFile)
      formData.append('baseline', draft.impactLevel)

      const response = await api.post<OscalImportSummary>('/oscal/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      return response.data
    },
    onSuccess: (summary) => {
      setImportSummary(summary)
      setOscalFile(null)
      queryClient.invalidateQueries({ queryKey: ['nist-800-53-controls'] })

      if (applyImportedBaseline) {
        applyImportedControlIds(summary.importedControlIds)
      }

      toast.success(`${summary.controlsUpdated} CONTROLS UPDATED, ${summary.controlsAdded} ADDED`)
    },
    onError: () => toast.error('OSCAL IMPORT FAILED'),
  })

  const aiTailoring = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(draft, controls)

      return aiApi.tailorControls({
        projectId: project.id,
        impactLevel: draft.impactLevel,
        jsigOverlay: draft.jsigOverlay,
        selectedControlIds: draft.selectedControlIds,
        baselineControlIds: payload.baselineControlIds,
        overlayControlIds: payload.overlayControlIds,
        tailoring: draft.tailoring,
        systemContext: [
          project.description ? `Project description: ${project.description}` : undefined,
          project.authBoundary ? `Authorization boundary: ${project.authBoundary}` : undefined,
          draft.notes ? `Tailoring notes: ${draft.notes}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
      })
    },
    onSuccess: (response) => {
      setTailoringRecommendations(response)
      setSelectedRecommendationIds(new Set(response.recommendations.map((item) => item.id)))
      setTailoringPanelOpen(true)
      toast.success(`${response.recommendations.length} AI tailoring recommendations ready`)
    },
    onError: () => toast.error('AI tailoring recommendations failed'),
  })

  function toggleControl(controlItem: ControlRecord) {
    const baseline = baselineSet.has(controlItem.controlId)
    const selected = selectedSet.has(controlItem.controlId)

    if (draft.jsigOverlay && baseline && isJsigOverlayControl(controlItem.controlId) && selected) {
      toast.error('JSIG overlay controls are required while the overlay is enabled')
      return
    }

    setDraft((current) => {
      const nextSelected = selected
        ? current.selectedControlIds.filter((id) => id !== controlItem.controlId)
        : [...current.selectedControlIds, controlItem.controlId]
      const action: TailoringAction = selected ? 'REMOVED' : baseline ? 'BASELINE' : 'ADDED'

      return {
        ...current,
        selectedControlIds: nextSelected,
        tailoring: {
          ...current.tailoring,
          [controlItem.controlId]: {
            ...getDecision(current, controlItem.controlId, baseline),
            action,
          },
        },
      }
    })
  }

  function updateDecision(controlId: string, patch: Partial<TailoringDecision>) {
    setDraft((current) => {
      const baseline = baselineSet.has(controlId)

      return {
        ...current,
        tailoring: {
          ...current.tailoring,
          [controlId]: {
            ...getDecision(current, controlId, baseline),
            ...patch,
          },
        },
      }
    })
  }

  function resetToBaseline() {
    setDraft((current) => ({
      ...current,
      selectedControlIds: baselineControlIds,
      tailoring: {},
    }))
    toast.success('BASELINE RESTORED')
  }

  function applyImportedControlIds(controlIds: string[]) {
    const nextSelected = Array.from(
      new Set([
        ...controlIds,
        ...(draft.jsigOverlay ? controls.filter((item) => isJsigOverlayControl(item.controlId)).map((item) => item.controlId) : []),
      ]),
    )

    setDraft((current) => {
      const nextSelectedSet = new Set(nextSelected)
      const nextTailoring = Object.fromEntries(
        Object.entries(current.tailoring).filter(([controlId]) => nextSelectedSet.has(controlId)),
      )

      return {
        ...current,
        selectedControlIds: nextSelected,
        tailoring: nextTailoring,
      }
    })
  }

  function selectOscalFile(file?: File | null) {
    if (!file) return
    const name = file.name.toLowerCase()

    if (!name.endsWith('.json') && !name.endsWith('.xml')) {
      toast.error('UPLOAD AN OSCAL .JSON OR .XML FILE')
      return
    }

    setOscalFile(file)
    setImportSummary(null)
  }

  function handleOscalInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectOscalFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleOscalDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsImportDragOver(false)
    selectOscalFile(event.dataTransfer.files?.[0])
  }

  function toggleJsigOverlay(enabled: boolean) {
    setDraft((current) => {
      const nextBaselineIds = getBaselineControlIds(controls, { ...current, jsigOverlay: enabled })
      const controlMap = new Map(controls.map((item) => [item.controlId, item]))
      const nextSelected = enabled
        ? Array.from(new Set([...current.selectedControlIds, ...nextBaselineIds.filter((id) => isJsigOverlayControl(id))]))
        : current.selectedControlIds.filter((id) => {
            if (!isJsigOverlayControl(id)) return true
            const controlItem = controlMap.get(id)
            return controlItem ? isControlInBaseline(controlItem, current.impactLevel) : false
          })

      const nextTailoring = { ...current.tailoring }
      jsigOverlayControlIds.forEach((id) => {
        if (!enabled && !nextSelected.includes(id)) delete nextTailoring[id]
      })

      return {
        ...current,
        jsigOverlay: enabled,
        selectedControlIds: nextSelected.length > 0 ? nextSelected : nextBaselineIds,
        tailoring: nextTailoring,
      }
    })

    toast.success(enabled ? 'JSIG OVERLAY APPLIED' : 'JSIG OVERLAY REMOVED')
  }

  function toggleRecommendation(id: string) {
    setSelectedRecommendationIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applyRecommendation(recommendation: AiTailoringRecommendation) {
    setDraft((current) => {
      const selected = new Set(current.selectedControlIds)
      const baseline = baselineSet.has(recommendation.controlId)
      const currentDecision = getDecision(current, recommendation.controlId, baseline)
      const nextTailoring = { ...current.tailoring }

      if (recommendation.type === 'ADD') {
        selected.add(recommendation.controlId)
        nextTailoring[recommendation.controlId] = {
          ...currentDecision,
          action: baseline ? 'BASELINE' : 'ADDED',
          justification: recommendation.justification,
        }
      }

      if (recommendation.type === 'REMOVE') {
        selected.delete(recommendation.controlId)
        nextTailoring[recommendation.controlId] = {
          ...currentDecision,
          action: 'REMOVED',
          inherited: false,
          inheritedFrom: '',
          justification: recommendation.justification,
        }
      }

      if (recommendation.type === 'INHERIT') {
        selected.add(recommendation.controlId)
        nextTailoring[recommendation.controlId] = {
          ...currentDecision,
          action: baseline ? 'BASELINE' : 'ADDED',
          inherited: true,
          inheritedFrom: recommendation.inheritedFrom ?? currentDecision.inheritedFrom,
          justification: recommendation.justification,
        }
      }

      return {
        ...current,
        selectedControlIds: Array.from(selected).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
        tailoring: nextTailoring,
      }
    })
  }

  function applySelectedRecommendations() {
    const recommendations = tailoringRecommendations?.recommendations.filter((item) => selectedRecommendationIds.has(item.id)) ?? []

    if (recommendations.length === 0) {
      toast('Select at least one recommendation to apply')
      return
    }

    recommendations.forEach(applyRecommendation)
    setTailoringRecommendations((current) =>
      current
        ? {
            ...current,
            recommendations: current.recommendations.filter((item) => !selectedRecommendationIds.has(item.id)),
          }
        : current,
    )
    setSelectedRecommendationIds(new Set())
    toast.success(`${recommendations.length} AI recommendations applied`)
  }

  function rejectRecommendation(id: string) {
    setTailoringRecommendations((current) =>
      current
        ? {
            ...current,
            recommendations: current.recommendations.filter((item) => item.id !== id),
          }
        : current,
    )
    setSelectedRecommendationIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  return (
    <WizardShell
      project={project}
      activeStep={2}
      title="Step 2: Select"
      eyebrow="CONTROL BASELINE AND TAILORING"
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => aiTailoring.mutate()}
            disabled={aiTailoring.isPending || controlsQuery.isLoading}
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiTailoring.isPending ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            AI TAILORING
          </button>
          <button
            type="button"
            onClick={() => saveStep2.mutate()}
            disabled={saveStep2.isPending}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveStep2.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saveStep2.isPending ? 'SAVING...' : 'SAVE STEP 2'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rmf-card active p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded border border-cyan-neon/30 bg-cyan-neon/10 p-2 text-cyan-neon">
                <Bot size={20} />
              </div>
              <div>
                <p className="hud-label text-slate-600">INTELLIGENT TAILORING</p>
                <h3 className="mt-1 font-mono text-base text-slate-100">AI Risk-Based Control Recommendations</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Analyze Step 0 context, Step 1 categorization, current tailoring, JSIG status, and system description to recommend
                  additions, removals, and inherited common controls. Nothing is applied until you approve it.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => aiTailoring.mutate()}
              disabled={aiTailoring.isPending || controlsQuery.isLoading}
              className="btn-primary inline-flex items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiTailoring.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {aiTailoring.isPending ? 'ANALYZING...' : 'GET AI TAILORING RECOMMENDATIONS'}
            </button>
          </div>
        </section>

        {tailoringPanelOpen && tailoringRecommendations && (
          <AiTailoringPanel
            response={tailoringRecommendations}
            selectedIds={selectedRecommendationIds}
            onToggle={toggleRecommendation}
            onAcceptAll={() => setSelectedRecommendationIds(new Set(tailoringRecommendations.recommendations.map((item) => item.id)))}
            onApplySelected={applySelectedRecommendations}
            onApplyOne={(recommendation) => {
              applyRecommendation(recommendation)
              rejectRecommendation(recommendation.id)
              toast.success(`${recommendation.controlId} recommendation applied`)
            }}
            onReject={rejectRecommendation}
            onClose={() => setTailoringPanelOpen(false)}
          />
        )}

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_360px] gap-5">
          <div className="rmf-card active p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="hud-label text-slate-600">NIST SP 800-53 REV. 5</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-mono text-lg text-slate-100">Security Control Baseline</h3>
                  {jsigEnabled && (
                    <span className="inline-flex items-center gap-1 rounded border border-purple-electric/40 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] uppercase text-purple-electric">
                      <ShieldAlert size={12} />
                      JSIG Enhanced
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-2 max-w-3xl">
                  Confirm the control baseline for this system, document tailoring decisions, and mark controls inherited
                  from common providers.
                </p>
              </div>
              <span className={`font-mono text-xs rounded border px-2 py-1 ${impactClass(draft.impactLevel)}`}>
                {draft.impactLevel} IMPACT
              </span>
            </div>

            <div className="mt-5 rounded border border-purple-electric/30 bg-purple-electric/10 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldAlert size={19} className="mt-0.5 text-purple-electric" />
                  <div>
                    <p className="font-mono text-sm text-slate-100">Apply JSIG Overlay (SAP/SCI)</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Adds SAP/SCI-focused enhancements and locks JSIG-required controls into the selected baseline.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.jsigOverlay}
                  onClick={() => toggleJsigOverlay(!draft.jsigOverlay)}
                  className={`relative h-7 w-14 rounded-full border transition-all ${
                    draft.jsigOverlay
                      ? 'border-purple-electric bg-purple-electric/30 shadow-[0_0_18px_rgba(124,58,237,0.35)]'
                      : 'border-slate-700 bg-space-deep'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full transition-all ${
                      draft.jsigOverlay ? 'left-8 bg-purple-electric' : 'left-1 bg-slate-500'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-5">
              <SummaryTile label="BASELINE" value={summary.baseline} tone="cyan" />
              <SummaryTile label="SELECTED" value={summary.selected} tone="green" />
              <SummaryTile label="ADDED" value={summary.added} tone="purple" />
              <SummaryTile label="REMOVED" value={summary.removed} tone="red" />
              <SummaryTile label="INHERITED" value={summary.inherited} tone="slate" />
              <SummaryTile label="JSIG" value={summary.jsig} tone="purple" />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="hud-label text-slate-600">BASELINE COVERAGE</span>
                <span className="font-mono text-sm text-cyan-neon">{coverage}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-space-elevated overflow-hidden">
                <div className="progress-glow-bar h-2 rounded-full" style={{ width: `${coverage}%` }} />
              </div>
            </div>
          </div>

          <div className="rmf-card p-5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={17} className="text-cyan-neon" />
              <span className="hud-label">BASELINE SETTINGS</span>
            </div>

            <div className="mt-4 space-y-3">
              {(['LOW', 'MODERATE', 'HIGH'] satisfies ImpactLevel[]).map((impactLevel) => (
                <button
                  key={impactLevel}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, impactLevel }))}
                  className={`w-full rounded border p-3 text-left transition-all ${
                    draft.impactLevel === impactLevel
                      ? 'border-cyan-neon/50 bg-cyan-neon/10 shadow-glow-cyan'
                      : 'border-cyan-neon/10 bg-space-elevated/30 hover:border-cyan-neon/30'
                  }`}
                >
                  <span className="font-mono text-sm text-slate-100">{impactLevel}</span>
                  <span className="hud-label ml-2 text-slate-600">BASELINE</span>
                </button>
              ))}
            </div>

            <button type="button" onClick={resetToBaseline} className="btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 text-xs">
              <ShieldCheck size={15} />
              RESTORE BASELINE
            </button>

            <div className="mt-5 border-t border-cyan-neon/10 pt-5">
              <div className="flex items-center gap-2">
                <UploadCloud size={17} className="text-cyan-neon" />
                <span className="hud-label">IMPORT OSCAL BASELINE</span>
              </div>

              <label
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsImportDragOver(true)
                }}
                onDragLeave={() => setIsImportDragOver(false)}
                onDrop={handleOscalDrop}
                className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded border border-dashed p-4 text-center transition-all ${
                  isImportDragOver
                    ? 'border-cyan-neon bg-cyan-neon/10 shadow-glow-cyan'
                    : 'border-cyan-neon/20 bg-space-deep/50 hover:border-cyan-neon/45'
                }`}
              >
                <UploadCloud size={24} className="text-cyan-neon" />
                <span className="mt-2 font-mono text-xs text-slate-300">
                  {oscalFile ? oscalFile.name : 'DROP OSCAL PROFILE OR CATALOG'}
                </span>
                <span className="mt-1 text-xs text-slate-600">JSON or XML</span>
                <input type="file" accept=".json,.xml,application/json,application/xml,text/xml" className="hidden" onChange={handleOscalInputChange} />
              </label>

              <label className="mt-3 flex items-center justify-between gap-3 rounded border border-cyan-neon/10 bg-space-deep/50 px-3 py-2">
                <span>
                  <span className="hud-label block">APPLY IMMEDIATELY</span>
                  <span className="text-xs text-slate-600">Replace selected controls after import</span>
                </span>
                <input
                  type="checkbox"
                  checked={applyImportedBaseline}
                  onChange={(event) => setApplyImportedBaseline(event.target.checked)}
                  className="h-4 w-4 accent-cyan-neon"
                />
              </label>

              <button
                type="button"
                onClick={() => importOscalBaseline.mutate()}
                disabled={!oscalFile || importOscalBaseline.isPending}
                className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importOscalBaseline.isPending ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {importOscalBaseline.isPending ? 'IMPORTING...' : `IMPORT INTO ${draft.impactLevel}`}
              </button>

              {importSummary && (
                <div className="mt-3 rounded border border-green-matrix/25 bg-green-matrix/10 p-3">
                  <p className="font-mono text-xs text-green-matrix">{importSummary.message.toUpperCase()}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {importSummary.totalControls} controls now define the {importSummary.baseline} baseline.
                  </p>
                </div>
              )}
            </div>

            {controlsQuery.isError && (
              <div className="mt-4 rounded border border-yellow-400/20 bg-yellow-400/10 p-3">
                <div className="flex gap-2">
                  <Info size={15} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-100/80 leading-5">
                    Unable to reach the control catalog. Using bundled controls until the backend responds.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rmf-card p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="hud-label text-slate-600">CONTROL CATALOG</p>
              <h3 className="font-mono text-base text-slate-100 mt-1">Baseline, Added, Removed, and Inherited Controls</h3>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block sm:w-80">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search controls..."
                  className="input-hud w-full pl-9"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowSelectedOnly((value) => !value)}
                className={`btn-secondary inline-flex items-center justify-center gap-2 text-xs ${
                  showSelectedOnly ? 'border-cyan-neon/50 bg-cyan-neon/10 text-cyan-neon' : ''
                }`}
              >
                <Filter size={15} />
                SELECTED
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {CONTROL_FAMILIES.map((family) => (
              <button
                key={family.id}
                type="button"
                onClick={() => setActiveFamily(family.id)}
                className={`shrink-0 rounded border px-3 py-2 text-left transition-all ${
                  activeFamily === family.id
                    ? 'border-cyan-neon/55 bg-cyan-neon/10 text-cyan-neon'
                    : 'border-cyan-neon/10 bg-space-elevated/30 text-slate-500 hover:border-cyan-neon/30 hover:text-slate-300'
                }`}
              >
                <span className="font-mono text-xs">{family.id}</span>
              </button>
            ))}
          </div>

          {controlsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={18} className="animate-spin text-cyan-neon" />
              <span className="hud-label ml-3 text-slate-600">LOADING CONTROL CATALOG</span>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredControls.map((controlItem) => {
                const baseline = baselineSet.has(controlItem.controlId)
                const selected = selectedSet.has(controlItem.controlId)
                const decision = getDecision(draft, controlItem.controlId, baseline)
                const action: TailoringAction = selected ? (baseline ? 'BASELINE' : 'ADDED') : 'REMOVED'

                return (
                  <ControlCard
                    key={controlItem.controlId}
                    controlItem={controlItem}
                    action={action}
                    selected={selected}
                    baseline={baseline}
                    jsigEnhanced={draft.jsigOverlay && isJsigOverlayControl(controlItem.controlId)}
                    locked={draft.jsigOverlay && baseline && isJsigOverlayControl(controlItem.controlId)}
                    decision={decision}
                    onToggle={() => toggleControl(controlItem)}
                    onDecisionChange={(patch) => updateDecision(controlItem.controlId, patch)}
                  />
                )
              })}

              {filteredControls.length === 0 && (
                <div className="rounded border border-cyan-neon/10 bg-space-elevated/30 p-8 text-center">
                  <p className="font-mono text-sm text-slate-400">NO CONTROLS MATCH THE CURRENT FILTERS</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rmf-card p-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={17} className="text-cyan-neon" />
            <span className="hud-label">TAILORING SUMMARY NOTES</span>
          </div>
          <textarea
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            className="textarea-hud mt-4 min-h-28"
            placeholder="Document assumptions, overlays, mission-specific tailoring rationale, or common control inheritance strategy..."
          />
        </section>
      </div>
    </WizardShell>
  )
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'green' | 'purple' | 'red' | 'slate' }) {
  const toneClass = {
    cyan: 'text-cyan-neon',
    green: 'text-green-matrix',
    purple: 'text-purple-electric',
    red: 'text-red-alert',
    slate: 'text-slate-300',
  }[tone]

  return (
    <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-3">
      <p className="hud-label text-slate-600">{label}</p>
      <p className={`font-mono text-2xl font-bold mt-2 ${toneClass}`}>{value}</p>
    </div>
  )
}

function AiTailoringPanel({
  response,
  selectedIds,
  onToggle,
  onAcceptAll,
  onApplySelected,
  onApplyOne,
  onReject,
  onClose,
}: {
  response: AiTailorControlsResponse
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onAcceptAll: () => void
  onApplySelected: () => void
  onApplyOne: (recommendation: AiTailoringRecommendation) => void
  onReject: (id: string) => void
  onClose: () => void
}) {
  const grouped = {
    ADD: response.recommendations.filter((item) => item.type === 'ADD'),
    REMOVE: response.recommendations.filter((item) => item.type === 'REMOVE'),
    INHERIT: response.recommendations.filter((item) => item.type === 'INHERIT'),
  }

  return (
    <section className="rmf-card border-cyan-neon/40 p-5 shadow-glow-cyan">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded border border-cyan-neon/30 bg-cyan-neon/10 px-2 py-1 font-mono text-[10px] uppercase text-cyan-neon">
              <Bot size={13} />
              AI Tailoring
            </span>
            <span className="rounded border border-purple-electric/30 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] uppercase text-purple-electric">
              {response.confidenceScore}% Confidence
            </span>
            {response.jsigContextApplied && (
              <span className="rounded border border-purple-electric/30 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] uppercase text-purple-electric">
                JSIG Context
              </span>
            )}
          </div>
          <h3 className="mt-3 font-mono text-base text-slate-100">Risk-Based Tailoring Recommendations</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review each recommendation before applying it. Accepted recommendations update the Step 2 working draft only; save Step 2
            when you are ready to persist them.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onAcceptAll} className="btn-secondary inline-flex items-center gap-2 text-xs">
            <CheckCircle2 size={15} />
            SELECT ALL
          </button>
          <button type="button" onClick={onApplySelected} className="btn-primary inline-flex items-center gap-2 text-xs">
            <Sparkles size={15} />
            APPLY SELECTED
          </button>
          <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center gap-2 text-xs">
            <X size={15} />
            CLOSE
          </button>
        </div>
      </div>

      {response.recommendations.length === 0 ? (
        <div className="mt-5 rounded border border-cyan-neon/10 bg-space-elevated/30 p-5 text-center">
          <p className="font-mono text-sm text-slate-300">NO AI TAILORING CHANGES RECOMMENDED</p>
          <p className="mt-2 text-sm text-slate-500">The current selection appears aligned with the available project context.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {(['ADD', 'REMOVE', 'INHERIT'] as const).map((type) => (
            <div key={type} className="rounded border border-cyan-neon/15 bg-space-deep/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="hud-label">{type === 'ADD' ? 'CONTROLS TO ADD' : type === 'REMOVE' ? 'CONTROLS TO REMOVE' : 'MARK INHERITED'}</span>
                <span className="font-mono text-xs text-cyan-neon">{grouped[type].length}</span>
              </div>

              <div className="space-y-3">
                {grouped[type].map((recommendation) => (
                  <article key={recommendation.id} className="rounded border border-cyan-neon/10 bg-space-elevated/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(recommendation.id)}
                          onChange={() => onToggle(recommendation.id)}
                          className="mt-1 h-4 w-4 accent-cyan-neon"
                        />
                        <span className="min-w-0">
                          <span className="control-id">{recommendation.controlId}</span>
                          <span className="ml-2 hud-label text-slate-600">{recommendation.family}</span>
                          <span className="mt-2 block font-mono text-xs text-slate-100">{recommendation.title}</span>
                        </span>
                      </label>
                      <span className="shrink-0 rounded border border-cyan-neon/20 px-2 py-1 font-mono text-[10px] text-cyan-neon">
                        {recommendation.confidenceScore}%
                      </span>
                    </div>

                    {recommendation.inheritedFrom && (
                      <p className="mt-3 rounded border border-purple-electric/20 bg-purple-electric/10 px-2 py-1 text-xs text-purple-electric">
                        Suggested provider: {recommendation.inheritedFrom}
                      </p>
                    )}

                    <p className="mt-3 text-xs leading-5 text-slate-500">{recommendation.justification}</p>

                    {recommendation.evidence && recommendation.evidence.length > 0 && (
                      <p className="mt-3 text-[11px] leading-5 text-slate-600">
                        Evidence: {recommendation.evidence.slice(0, 3).join(', ')}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => onApplyOne(recommendation)} className="btn-secondary flex-1 text-xs">
                        APPLY
                      </button>
                      <button type="button" onClick={() => onReject(recommendation.id)} className="btn-secondary flex-1 text-xs hover:border-red-alert/40 hover:text-red-alert">
                        REJECT
                      </button>
                    </div>
                  </article>
                ))}

                {grouped[type].length === 0 && (
                  <p className="rounded border border-cyan-neon/10 bg-space-elevated/20 p-3 text-xs text-slate-600">
                    No {type.toLowerCase()} recommendations.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

interface ControlCardProps {
  controlItem: ControlRecord
  action: TailoringAction
  selected: boolean
  baseline: boolean
  jsigEnhanced: boolean
  locked: boolean
  decision: TailoringDecision
  onToggle: () => void
  onDecisionChange: (patch: Partial<TailoringDecision>) => void
}

function ControlCard({
  controlItem,
  action,
  selected,
  baseline,
  jsigEnhanced,
  locked,
  decision,
  onToggle,
  onDecisionChange,
}: ControlCardProps) {
  const needsJustification = action === 'ADDED' || action === 'REMOVED' || decision.inherited

  return (
    <article
      className={`rounded border p-4 transition-all ${
        selected
          ? 'border-cyan-neon/25 bg-space-elevated/50 hover:border-cyan-neon/45'
          : 'border-red-alert/20 bg-red-alert/5 hover:border-red-alert/35'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="control-id">{controlItem.controlId}</span>
            <span className="hud-label text-slate-600">{controlItem.family}</span>
            <StatusBadge action={action} baseline={baseline} inherited={decision.inherited} />
            {jsigEnhanced && (
              <span className="inline-flex items-center gap-1 rounded border border-purple-electric/30 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] uppercase text-purple-electric">
                <ShieldAlert size={12} />
                JSIG
              </span>
            )}
          </div>
          <h4 className="font-mono text-sm text-slate-100 mt-3">{controlItem.title}</h4>
          <p className="text-xs text-slate-500 leading-5 mt-2">{controlItem.description}</p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={locked}
          className={`btn-secondary inline-flex items-center justify-center gap-2 text-xs lg:w-32 ${
            locked
              ? 'cursor-not-allowed opacity-50'
              : selected
                ? 'hover:border-red-alert/40 hover:text-red-alert'
                : 'border-cyan-neon/40 text-cyan-neon'
          }`}
        >
          {selected ? <MinusCircle size={15} /> : <PlusCircle size={15} />}
          {locked ? 'LOCKED' : selected ? 'REMOVE' : 'ADD'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <label className="flex items-center justify-between gap-3 rounded border border-cyan-neon/10 bg-space-deep/50 px-3 py-2">
          <span>
            <span className="hud-label block">INHERITED</span>
            <span className="text-xs text-slate-600">Common control provider</span>
          </span>
          <input
            type="checkbox"
            checked={decision.inherited}
            disabled={!selected}
            onChange={(event) => onDecisionChange({ inherited: event.target.checked })}
            className="h-4 w-4 accent-cyan-neon disabled:opacity-40"
          />
        </label>

        <input
          value={decision.inheritedFrom}
          disabled={!selected || !decision.inherited}
          onChange={(event) => onDecisionChange({ inheritedFrom: event.target.value })}
          className="input-hud"
          placeholder="Inherited from organization, cloud provider, enclave, or shared service..."
        />
      </div>

      {needsJustification && (
        <textarea
          value={decision.justification}
          onChange={(event) => onDecisionChange({ justification: event.target.value })}
          rows={2}
          className="textarea-hud mt-3"
          placeholder={`${formatActionLabel(action)} justification...`}
        />
      )}
    </article>
  )
}

function StatusBadge({ action, baseline, inherited }: { action: TailoringAction; baseline: boolean; inherited: boolean }) {
  if (inherited) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-purple-electric/30 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] uppercase text-purple-electric">
        <Shield size={12} />
        Inherited
      </span>
    )
  }

  if (action === 'ADDED') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-green-matrix/30 bg-green-matrix/10 px-2 py-1 font-mono text-[10px] uppercase text-green-matrix">
        <PlusCircle size={12} />
        Added
      </span>
    )
  }

  if (action === 'REMOVED') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-red-alert/30 bg-red-alert/10 px-2 py-1 font-mono text-[10px] uppercase text-red-alert">
        <MinusCircle size={12} />
        Removed
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded border border-cyan-neon/25 bg-cyan-neon/10 px-2 py-1 font-mono text-[10px] uppercase text-cyan-neon">
      {baseline ? <CheckCircle2 size={12} /> : <PlusCircle size={12} />}
      Baseline
    </span>
  )
}
