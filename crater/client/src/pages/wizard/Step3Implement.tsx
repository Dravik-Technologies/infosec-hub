import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Filter,
  Info,
  LayoutList,
  Loader2,
  Paperclip,
  Rows3,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Unlink,
  Wand2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi, projectsApi, type ArtifactRecord, type Step3Dto } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import WizardShell from '@/components/layout/WizardShell'
import type { Project, RmfStepStatus } from '@/types/project'

type ControlStatus = 'NOT_IMPLEMENTED' | 'PLANNED' | 'PARTIALLY_IMPLEMENTED' | 'IMPLEMENTED' | 'NOT_APPLICABLE'
type TailoringAction = 'BASELINE' | 'ADDED' | 'REMOVED'

interface ControlRef {
  controlId: string
  family?: string
  title?: string
  description?: string
  action?: TailoringAction
  inherited?: boolean
  inheritedFrom?: string
  justification?: string
}

interface Step2Data {
  selectedControlIds?: string[]
  selectedControls?: ControlRef[]
  baselineControlIds?: string[]
  tailoring?: Record<string, Partial<ControlRef>>
  jsigOverlay?: boolean
}

interface ImplementationRecord {
  status: ControlStatus
  implementationStatement: string
  inherited: boolean
  inheritedFrom: string
  evidenceNotes: string
  aiGenerated?: boolean
  aiGeneratedAt?: string
}

interface Step3Draft {
  controls: Record<string, ImplementationRecord>
  notes: string
}

interface Step3Data {
  implementations?: Record<string, Partial<ImplementationRecord>>
  controls?: Record<string, Partial<ImplementationRecord>>
  notes?: string
}

interface AiSuggestion {
  text: string
  suggestedStatus: ControlStatus
  generatedAt: string
  provider: string
  model: string
  fallback?: boolean
  fromCache?: boolean
  sources?: Array<{ controlId: string; family: string; title: string }>
}

type ProjectWithSteps = Omit<Project, 'rmfSteps'> & {
  rmfSteps?: Array<{
    id?: string
    stepNumber: number
    status?: RmfStepStatus
    data?: Step2Data | Step3Data | null
  }>
}

const STATUS_OPTIONS: Array<{ value: ControlStatus; label: string }> = [
  { value: 'NOT_IMPLEMENTED', label: 'Not Implemented' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'PARTIALLY_IMPLEMENTED', label: 'Partially Implemented' },
  { value: 'IMPLEMENTED', label: 'Implemented' },
  { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
]

const EMPTY_RECORD: ImplementationRecord = {
  status: 'NOT_IMPLEMENTED',
  implementationStatement: '',
  inherited: false,
  inheritedFrom: '',
  evidenceNotes: '',
}

function getStorageKey(projectId: string) {
  return `crater-step-3-implement:${projectId}`
}

function getStepData<T>(project: Project, stepNumber: number): T | null {
  return ((project as ProjectWithSteps).rmfSteps?.find((step) => step.stepNumber === stepNumber)?.data ?? null) as T | null
}

function readCachedDraft(projectId: string): Step3Draft | null {
  const raw = localStorage.getItem(getStorageKey(projectId))
  if (!raw) return null

  try {
    return JSON.parse(raw) as Step3Draft
  } catch {
    localStorage.removeItem(getStorageKey(projectId))
    return null
  }
}

function getSelectedControls(project: Project): ControlRef[] {
  const step2 = getStepData<Step2Data>(project, 2)
  const selectedControls = step2?.selectedControls ?? []

  if (selectedControls.length > 0) {
    return selectedControls
      .filter((control) => control.action !== 'REMOVED')
      .map((control) => ({
        ...control,
        family: control.family ?? control.controlId.split('-')[0],
        title: control.title ?? control.controlId,
      }))
      .sort((a, b) => a.controlId.localeCompare(b.controlId, undefined, { numeric: true }))
  }

  return (step2?.selectedControlIds ?? [])
    .map((controlId) => {
      const tailoring = step2?.tailoring?.[controlId]
      const action: TailoringAction = step2?.baselineControlIds?.includes(controlId) ? 'BASELINE' : 'ADDED'

      return {
        controlId,
        family: controlId.split('-')[0],
        title: controlId,
        action,
        inherited: tailoring?.inherited,
        inheritedFrom: tailoring?.inheritedFrom,
        justification: tailoring?.justification,
      }
    })
    .sort((a, b) => a.controlId.localeCompare(b.controlId, undefined, { numeric: true }))
}

function normalizeStep3Data(data?: Step3Data | null): Step3Draft | null {
  if (!data) return null

  const controls = Object.fromEntries(
    Object.entries(data.implementations ?? data.controls ?? {}).map(([controlId, record]) => [
      controlId,
      {
        ...record,
        implementationStatement:
          record.implementationStatement ?? (record as { statement?: string }).statement ?? '',
      },
    ]),
  ) as Record<string, ImplementationRecord>

  return {
    controls,
    notes: data.notes ?? '',
  }
}

function getInitialDraft(project: Project, controls: ControlRef[]): Step3Draft {
  const saved = normalizeStep3Data(getStepData<Step3Data>(project, 3)) ?? readCachedDraft(project.id)
  const records = { ...(saved?.controls ?? {}) }

  controls.forEach((control) => {
    records[control.controlId] = {
      ...EMPTY_RECORD,
      ...records[control.controlId],
      inherited: records[control.controlId]?.inherited ?? Boolean(control.inherited),
      inheritedFrom: records[control.controlId]?.inheritedFrom ?? control.inheritedFrom ?? '',
    }
  })

  return { controls: records, notes: saved?.notes ?? '' }
}

function statusClass(status: ControlStatus) {
  if (status === 'IMPLEMENTED') return 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
  if (status === 'PARTIALLY_IMPLEMENTED') return 'text-cyan-neon border-cyan-neon/30 bg-cyan-neon/10'
  if (status === 'PLANNED') return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
  if (status === 'NOT_APPLICABLE') return 'text-slate-300 border-slate-500/30 bg-slate-500/10'
  return 'text-red-alert border-red-alert/30 bg-red-alert/10'
}

function formatStatus(status: ControlStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

function buildPayload(draft: Step3Draft, summary: Step3Dto['summary']): Step3Dto {
  const implementations = Object.fromEntries(
    Object.entries(draft.controls).map(([controlId, record]) => [
      controlId,
      {
        ...record,
        statement: record.implementationStatement,
      },
    ]),
  )

  return {
    implementations,
    summary,
    notes: draft.notes,
  }
}

function getStep2Data(project: Project) {
  return getStepData<Step2Data>(project, 2)
}

function formatAiTimestamp(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getSuggestedStatus(record: ImplementationRecord): ControlStatus {
  if (record.inherited) return 'IMPLEMENTED'
  if (record.status === 'IMPLEMENTED' || record.status === 'NOT_APPLICABLE') return record.status
  return 'PARTIALLY_IMPLEMENTED'
}

export default function Step3Implement({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const selectedControls = useMemo(() => getSelectedControls(project), [project])
  const step2Data = useMemo(() => getStep2Data(project), [project])
  const jsigOverlay = Boolean(step2Data?.jsigOverlay)
  const families = useMemo(() => ['ALL', ...Array.from(new Set(selectedControls.map((control) => control.family ?? 'UNKNOWN'))).sort()], [selectedControls])
  const [draft, setDraft] = useState<Step3Draft>(() => getInitialDraft(project, selectedControls))
  const [search, setSearch] = useState('')
  const [activeFamily, setActiveFamily] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<ControlStatus | 'ALL'>('ALL')
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiSuggestion>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [aiStreamText, setAiStreamText] = useState<Record<string, string>>({})
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkAcceptOpen, setBulkAcceptOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<ControlStatus>('IMPLEMENTED')
  const [compactView, setCompactView] = useState(false)

  useEffect(() => {
    setDraft((current) => {
      const records = { ...current.controls }
      selectedControls.forEach((control) => {
        records[control.controlId] = {
          ...EMPTY_RECORD,
          ...records[control.controlId],
          inherited: records[control.controlId]?.inherited ?? Boolean(control.inherited),
          inheritedFrom: records[control.controlId]?.inheritedFrom ?? control.inheritedFrom ?? '',
        }
      })

      return { ...current, controls: records }
    })
  }, [selectedControls])

  useEffect(() => {
    localStorage.setItem(getStorageKey(project.id), JSON.stringify(draft))
  }, [draft, project.id])

  const filteredControls = useMemo(() => {
    const term = search.trim().toLowerCase()

    return selectedControls.filter((control) => {
      const record = draft.controls[control.controlId] ?? EMPTY_RECORD
      const matchesFamily = activeFamily === 'ALL' || control.family === activeFamily
      const matchesStatus = statusFilter === 'ALL' || record.status === statusFilter
      const matchesSearch =
        !term ||
        control.controlId.toLowerCase().includes(term) ||
        (control.title ?? '').toLowerCase().includes(term) ||
        (control.description ?? '').toLowerCase().includes(term)

      return matchesFamily && matchesStatus && matchesSearch
    })
  }, [activeFamily, draft.controls, search, selectedControls, statusFilter])

  const summary = useMemo(() => {
    const records = selectedControls.map((control) => draft.controls[control.controlId] ?? EMPTY_RECORD)
    const implemented = records.filter((record) => record.status === 'IMPLEMENTED').length
    const partial = records.filter((record) => record.status === 'PARTIALLY_IMPLEMENTED').length
    const planned = records.filter((record) => record.status === 'PLANNED').length
    const inherited = records.filter((record) => record.inherited).length
    const documented = records.filter((record) => record.implementationStatement.trim()).length
    const percent = records.length ? Math.round((implemented / records.length) * 100) : 0

    return { total: records.length, implemented, partial, planned, inherited, documented, percent }
  }, [draft.controls, selectedControls])

  const familyBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; implemented: number; partial: number }>()
    for (const control of selectedControls) {
      const fam = control.family ?? 'UNKNOWN'
      if (!map.has(fam)) map.set(fam, { total: 0, implemented: 0, partial: 0 })
      const entry = map.get(fam)!
      entry.total++
      const rec = draft.controls[control.controlId] ?? EMPTY_RECORD
      if (rec.status === 'IMPLEMENTED' || rec.status === 'NOT_APPLICABLE') entry.implemented++
      else if (rec.status === 'PARTIALLY_IMPLEMENTED') entry.partial++
    }
    return [...map.entries()]
      .map(([family, counts]) => ({ family, ...counts, percent: Math.round((counts.implemented / counts.total) * 100) }))
      .sort((a, b) => a.family.localeCompare(b.family))
  }, [selectedControls, draft.controls])

  const pendingAiSuggestionCount = useMemo(
    () => selectedControls.filter((control) => aiSuggestions[control.controlId]).length,
    [aiSuggestions, selectedControls],
  )

  const { data: projectArtifacts = [] } = useQuery<ArtifactRecord[]>({
    queryKey: [...queryKeys.projects.detail(project.id), 'artifacts'],
    queryFn: () => projectsApi.listArtifacts(project.id),
    staleTime: 30_000,
  })

  const linkArtifactMutation = useMutation({
    mutationFn: ({ artifactId, controlId }: { artifactId: string; controlId: string | null }) =>
      projectsApi.updateArtifact(project.id, artifactId, { controlId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(project.id), 'artifacts'] })
    },
    onError: () => toast.error('Failed to update artifact link'),
  })

  const step3Mutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(draft, summary)

      localStorage.setItem(getStorageKey(project.id), JSON.stringify(draft))
      await projectsApi.saveStep3(project.id, payload)
      return payload
    },
    onSuccess: (payload) => {
      localStorage.removeItem(getStorageKey(project.id))
      queryClient.setQueryData<ProjectWithSteps>(queryKeys.projects.detail(project.id), (current) => {
        if (!current) return current

        const steps = current.rmfSteps ?? []
        const status: RmfStepStatus = (payload.summary?.percent ?? 0) >= 95 && (payload.summary?.total ?? 0) > 0 ? 'COMPLETE' : 'IN_PROGRESS'
        const step3 = {
          id: steps.find((step) => step.stepNumber === 3)?.id ?? `local-step-3-${project.id}`,
          stepNumber: 3,
          status,
          data: payload,
        }

        return {
          ...current,
          rmfSteps: [...steps.filter((step) => step.stepNumber !== 3), step3],
        }
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('STEP 3 IMPLEMENTATION SAVED')
    },
    onError: () => toast.error('STEP 3 SAVE FAILED'),
  })

  function updateRecord(controlId: string, patch: Partial<ImplementationRecord>) {
    setDraft((current) => ({
      ...current,
      controls: {
        ...current.controls,
        [controlId]: {
          ...EMPTY_RECORD,
          ...current.controls[controlId],
          ...patch,
        },
      },
    }))
  }

  async function generateForControl(control: ControlRef, options?: { silent?: boolean }) {
    const record = draft.controls[control.controlId] ?? EMPTY_RECORD
    const generatedAt = new Date().toISOString()

    setAiLoading((current) => ({ ...current, [control.controlId]: true }))
    setAiStreamText((current) => ({ ...current, [control.controlId]: '' }))

    try {
      await aiApi.streamGenerateImplementation(
        {
          controlId: control.controlId,
          projectId: project.id,
          purpose: jsigOverlay ? 'JSIG_SAP_ENHANCEMENT' : 'IMPLEMENTATION_STATEMENT',
          impactLevel: project.impactLevel,
          inherited: record.inherited,
          inheritedFrom: record.inheritedFrom,
          systemContext: [
            `Project: ${project.name}`,
            project.description ? `Description: ${project.description}` : undefined,
            project.authBoundary ? `Authorization boundary: ${project.authBoundary}` : undefined,
            `Step 2 JSIG overlay: ${jsigOverlay ? 'enabled' : 'disabled'}`,
            control.action ? `Tailoring action: ${control.action}` : undefined,
            control.justification ? `Tailoring justification: ${control.justification}` : undefined,
          ]
            .filter(Boolean)
            .join('\n'),
        },
        {
          onToken: (token) => {
            setAiStreamText((current) => ({
              ...current,
              [control.controlId]: (current[control.controlId] ?? '') + token,
            }))
          },
          onDone: (result) => {
            setAiSuggestions((current) => ({
              ...current,
              [control.controlId]: {
                text: result.generatedText,
                suggestedStatus: getSuggestedStatus(record),
                generatedAt,
                provider: result.provider,
                model: result.model,
                fallback: result.fallback,
                fromCache: result.fromCache,
              },
            }))
            setAiStreamText((current) => {
              const next = { ...current }
              delete next[control.controlId]
              return next
            })
            if (!options?.silent) {
              toast.success(result.fromCache ? 'Loaded from cache' : result.fallback ? 'AI fallback generated' : 'AI suggestion ready')
            }
          },
        },
      )
    } catch (error) {
      setAiStreamText((current) => {
        const next = { ...current }
        delete next[control.controlId]
        return next
      })
      if (!options?.silent) toast.error('AI generation failed')
      throw error
    } finally {
      setAiLoading((current) => ({ ...current, [control.controlId]: false }))
    }
  }

  function acceptAiSuggestion(controlId: string) {
    const suggestion = aiSuggestions[controlId]
    if (!suggestion) return

    updateRecord(controlId, {
      implementationStatement: suggestion.text,
      status: suggestion.suggestedStatus,
      aiGenerated: true,
      aiGeneratedAt: suggestion.generatedAt,
    })

    setAiSuggestions((current) => {
      const next = { ...current }
      delete next[controlId]
      return next
    })
  }

  function acceptAllAiSuggestions() {
    const acceptedControlIds = selectedControls
      .map((control) => control.controlId)
      .filter((controlId) => aiSuggestions[controlId])

    if (acceptedControlIds.length === 0) {
      toast('No pending AI suggestions to accept')
      return
    }

    setDraft((current) => {
      const controls = { ...current.controls }

      acceptedControlIds.forEach((controlId) => {
        const suggestion = aiSuggestions[controlId]
        if (!suggestion) return

        controls[controlId] = {
          ...EMPTY_RECORD,
          ...controls[controlId],
          implementationStatement: suggestion.text,
          status: suggestion.suggestedStatus,
          aiGenerated: true,
          aiGeneratedAt: suggestion.generatedAt,
        }
      })

      return { ...current, controls }
    })

    setAiSuggestions((current) => {
      const next = { ...current }
      acceptedControlIds.forEach((controlId) => {
        delete next[controlId]
      })
      return next
    })

    setBulkAcceptOpen(false)
    toast.success(`Accepted AI suggestions for ${acceptedControlIds.length} controls`)
  }

  function applyBulkStatus() {
    if (!selected.size) return
    setDraft((current) => {
      const controls = { ...current.controls }
      for (const controlId of selected) {
        controls[controlId] = { ...EMPTY_RECORD, ...controls[controlId], status: bulkStatus }
      }
      return { ...current, controls }
    })
    toast.success(`${selected.size} control${selected.size > 1 ? 's' : ''} set to ${formatStatus(bulkStatus)}`)
    setSelected(new Set())
  }

  const allFilteredSelected =
    filteredControls.length > 0 && filteredControls.every((c) => selected.has(c.controlId))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((s) => {
        const next = new Set(s)
        filteredControls.forEach((c) => next.delete(c.controlId))
        return next
      })
    } else {
      setSelected((s) => {
        const next = new Set(s)
        filteredControls.forEach((c) => next.add(c.controlId))
        return next
      })
    }
  }

  async function generateAllMissing() {
    const missing = selectedControls.filter((control) => {
      const record = draft.controls[control.controlId] ?? EMPTY_RECORD
      return !record.implementationStatement.trim() && !aiSuggestions[control.controlId]
    })

    if (missing.length === 0) {
      toast('No missing implementation statements to generate')
      return
    }

    setBulkGenerating(true)
    const toastId = toast.loading(`Generating ${missing.length} implementation suggestions...`)
    let generated = 0
    let failed = 0

    // Run 3 concurrent streams — fast model + keep_alive means parallelism helps.
    const CONCURRENCY = 3
    try {
      for (let i = 0; i < missing.length; i += CONCURRENCY) {
        const batch = missing.slice(i, i + CONCURRENCY)
        const results = await Promise.allSettled(batch.map((control) => generateForControl(control, { silent: true })))
        for (const result of results) {
          if (result.status === 'fulfilled') generated += 1
          else failed += 1
        }
        toast.loading(`Generated ${generated}/${missing.length}...`, { id: toastId })
      }
      if (failed > 0 && generated > 0) {
        toast.success(`Generated ${generated} suggestions; ${failed} controls need review`, { id: toastId })
      } else if (failed > 0) {
        toast.error(`AI could not generate suggestions for ${failed} controls`, { id: toastId })
      } else {
        toast.success(`Generated ${generated} AI suggestions`, { id: toastId })
      }
    } finally {
      setBulkGenerating(false)
    }
  }

  return (
    <WizardShell
      project={project}
      activeStep={3}
      title="Step 3: Implement"
      eyebrow="CONTROL IMPLEMENTATION"
      actions={
        <div className="flex flex-col gap-2">
          <Link
            to={`/projects/${project.id}/poam`}
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs"
          >
            <AlertTriangle size={15} />
            POA&M
          </Link>
          <button
            type="button"
            onClick={generateAllMissing}
            disabled={bulkGenerating || selectedControls.length === 0}
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkGenerating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            GENERATE ALL MISSING
          </button>
          <button
            type="button"
            onClick={() => step3Mutation.mutate()}
            disabled={step3Mutation.isPending}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step3Mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {step3Mutation.isPending ? 'SAVING...' : 'SAVE IMPLEMENTATION'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_360px] gap-5">
          <div className="rmf-card active p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="hud-label text-slate-600">NIST SP 800-53 REV. 5</p>
                <h3 className="mt-1 font-mono text-lg text-slate-100">Implementation Workspace</h3>
                <p className="mt-2 max-w-3xl text-sm text-slate-500">
                  Document how each selected control is implemented, inherited, or planned for this system.
                </p>
              </div>
              <span className="rounded border border-cyan-neon/30 bg-cyan-neon/10 px-2 py-1 font-mono text-xs text-cyan-neon">
                {summary.percent}% IMPLEMENTED
              </span>
              {jsigOverlay && (
                <span className="rounded border border-purple-electric/30 bg-purple-electric/10 px-2 py-1 font-mono text-xs text-purple-electric">
                  JSIG AI CONTEXT
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 lg:grid-cols-6 gap-3">
              <SummaryTile label="CONTROLS" value={summary.total} tone="cyan" />
              <SummaryTile label="IMPLEMENTED" value={summary.implemented} tone="green" />
              <SummaryTile label="PARTIAL" value={summary.partial} tone="cyan" />
              <SummaryTile label="PLANNED" value={summary.planned} tone="yellow" />
              <SummaryTile label="INHERITED" value={summary.inherited} tone="purple" />
              <SummaryTile label="DOCS" value={summary.documented} tone="slate" />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="hud-label text-slate-600">IMPLEMENTED COVERAGE</span>
                <span className="font-mono text-sm text-cyan-neon">{summary.percent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-space-elevated">
                <div className="progress-glow-bar h-2 rounded-full" style={{ width: `${summary.percent}%` }} />
              </div>
            </div>
          </div>

          <div className="rmf-card p-5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={17} className="text-cyan-neon" />
              <span className="hud-label">FILTERS</span>
            </div>

            <label className="relative mt-4 block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search controls..."
                className="input-hud w-full pl-9"
              />
            </label>

            <div className="mt-4">
              <p className="hud-label text-slate-600 mb-2">FAMILY</p>
              <select value={activeFamily} onChange={(event) => setActiveFamily(event.target.value)} className="select-hud w-full">
                {families.map((family) => (
                  <option key={family} value={family}>{family}</option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <p className="hud-label text-slate-600 mb-2">STATUS</p>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ControlStatus | 'ALL')} className="select-hud w-full">
                <option value="ALL">All Statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 rounded border border-cyan-neon/15 bg-space-elevated/40 p-3">
              <div className="flex gap-2">
                <Info size={15} className="mt-0.5 flex-shrink-0 text-cyan-neon" />
                <p className="text-xs leading-5 text-slate-500">
                  Use the Evidence panel on each control to link uploaded artifacts. Upload artifacts first via the Artifacts tab, then link them here by control ID.
                </p>
              </div>
            </div>

            {familyBreakdown.length > 0 && (
              <div className="mt-4">
                <p className="hud-label text-slate-600 mb-2">COVERAGE BY FAMILY</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {familyBreakdown.map(({ family, total, implemented, partial, percent }) => (
                    <button
                      key={family}
                      type="button"
                      onClick={() => setActiveFamily(activeFamily === family ? 'ALL' : family)}
                      className={`w-full rounded px-2 py-1.5 text-left transition-colors hover:bg-white/5 ${activeFamily === family ? 'bg-cyan-neon/10' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[11px] text-slate-300">{family}</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {implemented}/{total}
                          {partial > 0 && <span className="text-cyan-neon ml-1">+{partial}p</span>}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-space-elevated overflow-hidden">
                        <div
                          className="h-1 rounded-full transition-all"
                          style={{
                            width: `${percent}%`,
                            background: percent === 100 ? 'rgb(var(--color-green-matrix))' : 'rgba(0,245,255,0.55)',
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {selectedControls.length === 0 ? (
          <section className="rmf-card p-8 text-center">
            <Shield size={28} className="mx-auto text-slate-600" />
            <p className="mt-4 font-mono text-sm text-slate-300">NO SELECTED CONTROLS FOUND</p>
            <p className="mt-2 text-sm text-slate-500">Complete Step 2: Select before documenting implementation.</p>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="rmf-card active p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Bot size={17} className="text-cyan-neon" />
                    <span className="hud-label">AI SUGGESTION QUEUE</span>
                    <span className="rounded border border-cyan-neon/25 bg-cyan-neon/10 px-2 py-1 font-mono text-xs text-cyan-neon">
                      {pendingAiSuggestionCount} PENDING
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Accept generated implementation statements in one pass, then review and save Step 3.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkAcceptOpen(true)}
                  disabled={pendingAiSuggestionCount === 0}
                  className="btn-primary inline-flex items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  ACCEPT ALL AI SUGGESTIONS
                </button>
              </div>
            </div>

            {/* ── Bulk + view toolbar ─────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 accent-cyan-neon"
                />
                <span className="hud-label text-slate-600">SELECT ALL</span>
                <span className="font-mono text-xs text-slate-600">
                  ({filteredControls.length})
                </span>
              </div>

              {selected.size > 0 && (
                <div className="flex items-center gap-2 ml-2">
                  <span className="font-mono text-xs text-cyan-neon">{selected.size} SELECTED</span>
                  <select
                    className="select-hud text-xs"
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as ControlStatus)}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={applyBulkStatus}
                    className="btn-primary text-xs inline-flex items-center gap-1.5 px-3 py-1.5"
                  >
                    <CheckCircle2 size={12} />
                    APPLY
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="btn-secondary text-xs px-2 py-1.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="ml-auto flex rounded border border-cyan-neon/15 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCompactView(false)}
                  className={`px-2.5 py-1.5 transition-colors ${!compactView ? 'bg-cyan-neon/15 text-cyan-neon' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Expanded view"
                >
                  <LayoutList size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setCompactView(true)}
                  className={`px-2.5 py-1.5 border-l border-cyan-neon/15 transition-colors ${compactView ? 'bg-cyan-neon/15 text-cyan-neon' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Compact view"
                >
                  <Rows3 size={13} />
                </button>
              </div>
            </div>

            {/* ── Controls ────────────────────────────────────────────── */}
            {filteredControls.map((control) => {
              const record = draft.controls[control.controlId] ?? EMPTY_RECORD

              return compactView ? (
                <CompactControlRow
                  key={control.controlId}
                  control={control}
                  record={record}
                  selected={selected.has(control.controlId)}
                  hasSuggestion={Boolean(aiSuggestions[control.controlId])}
                  aiLoading={Boolean(aiLoading[control.controlId])}
                  onSelect={(checked) =>
                    setSelected((s) => { const n = new Set(s); checked ? n.add(control.controlId) : n.delete(control.controlId); return n })
                  }
                  onStatusChange={(status) => updateRecord(control.controlId, { status })}
                  onExpand={() => setCompactView(false)}
                />
              ) : (
                <ControlImplementationCard
                  key={control.controlId}
                  control={control}
                  record={record}
                  selected={selected.has(control.controlId)}
                  aiSuggestion={aiSuggestions[control.controlId]}
                  aiLoading={Boolean(aiLoading[control.controlId])}
                  aiStreamText={aiStreamText[control.controlId]}
                  artifacts={projectArtifacts}
                  onSelect={(checked) =>
                    setSelected((s) => { const n = new Set(s); checked ? n.add(control.controlId) : n.delete(control.controlId); return n })
                  }
                  onLinkArtifact={(artifactId, controlId) => linkArtifactMutation.mutate({ artifactId, controlId })}
                  onGenerate={() => generateForControl(control)}
                  onAcceptSuggestion={() => acceptAiSuggestion(control.controlId)}
                  onChange={(patch) => updateRecord(control.controlId, patch)}
                />
              )
            })}

            {filteredControls.length === 0 && (
              <div className="rmf-card p-8 text-center">
                <Filter size={24} className="mx-auto text-slate-600" />
                <p className="mt-4 font-mono text-sm text-slate-300">NO CONTROLS MATCH THE CURRENT FILTERS</p>
              </div>
            )}
          </section>
        )}

        <section className="rmf-card p-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={17} className="text-cyan-neon" />
            <span className="hud-label">IMPLEMENTATION SUMMARY NOTES</span>
          </div>
          <textarea
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            className="textarea-hud mt-4 min-h-28"
            placeholder="Document implementation strategy, assumptions, common control inheritance, residual gaps, or evidence collection notes..."
          />
        </section>

        {bulkAcceptOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-space-deep/80 px-4 backdrop-blur-sm">
            <div className="rmf-card active w-full max-w-lg p-5 shadow-[0_0_40px_rgba(0,229,255,0.12)]">
              <div className="flex items-start gap-3">
                <div className="rounded border border-cyan-neon/30 bg-cyan-neon/10 p-2 text-cyan-neon">
                  <Bot size={20} />
                </div>
                <div className="min-w-0">
                  <p className="hud-label">BULK ACCEPT AI SUGGESTIONS</p>
                  <h3 className="mt-2 font-mono text-lg text-slate-100">
                    Accept AI suggestions for {pendingAiSuggestionCount} controls?
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    This will apply each pending AI implementation statement, status, and AI timestamp to the draft, then remove the AI suggestion banners. You can still edit anything before saving Step 3.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setBulkAcceptOpen(false)}
                  className="btn-secondary inline-flex items-center justify-center gap-2 text-xs"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={acceptAllAiSuggestions}
                  className="btn-primary inline-flex items-center justify-center gap-2 text-xs"
                >
                  <CheckCircle2 size={15} />
                  ACCEPT {pendingAiSuggestionCount}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WizardShell>
  )
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'green' | 'purple' | 'yellow' | 'slate' }) {
  const toneClass = {
    cyan: 'text-cyan-neon',
    green: 'text-green-matrix',
    purple: 'text-purple-electric',
    yellow: 'text-yellow-400',
    slate: 'text-slate-300',
  }[tone]

  return (
    <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-3">
      <p className="hud-label text-slate-600">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function ControlImplementationCard({
  control,
  record,
  selected,
  aiSuggestion,
  aiLoading,
  aiStreamText,
  artifacts,
  onSelect,
  onLinkArtifact,
  onGenerate,
  onAcceptSuggestion,
  onChange,
}: {
  control: ControlRef
  record: ImplementationRecord
  selected: boolean
  aiSuggestion?: AiSuggestion
  aiLoading: boolean
  aiStreamText?: string
  artifacts: ArtifactRecord[]
  onSelect: (checked: boolean) => void
  onLinkArtifact: (artifactId: string, controlId: string | null) => void
  onGenerate: () => void
  onAcceptSuggestion: () => void
  onChange: (patch: Partial<ImplementationRecord>) => void
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [artifactSearch, setArtifactSearch] = useState('')
  const linked = artifacts.filter((a) => a.controlId === control.controlId)
  const unlinked = artifacts.filter(
    (a) => a.controlId !== control.controlId && a.fileName.toLowerCase().includes(artifactSearch.toLowerCase()),
  )

  return (
    <article className={`rmf-card p-4 transition-all hover:border-cyan-neon/35 ${selected ? 'border-cyan-neon/40 bg-cyan-neon/5' : ''}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              className="h-3.5 w-3.5 accent-cyan-neon flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="control-id">{control.controlId}</span>
            <span className="hud-label text-slate-600">{control.family}</span>
            <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase ${statusClass(record.status)}`}>
              {formatStatus(record.status)}
            </span>
            {record.inherited && (
              <span className="inline-flex items-center gap-1 rounded border border-purple-electric/30 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] uppercase text-purple-electric">
                <Shield size={12} />
                Inherited
              </span>
            )}
            {record.aiGenerated && (
              <span className="inline-flex items-center gap-1 rounded border border-cyan-neon/30 bg-cyan-neon/10 px-2 py-1 font-mono text-[10px] uppercase text-cyan-neon">
                <Bot size={12} />
                AI {record.aiGeneratedAt ? formatAiTimestamp(record.aiGeneratedAt) : ''}
              </span>
            )}
          </div>
          <h4 className="mt-3 font-mono text-sm text-slate-100">{control.title}</h4>
          {control.description && <p className="mt-2 text-xs leading-5 text-slate-500">{control.description}</p>}
          {control.justification && <p className="mt-2 text-xs leading-5 text-yellow-100/70">Tailoring: {control.justification}</p>}
        </div>

        <select
          value={record.status}
          onChange={(event) => onChange({ status: event.target.value as ControlStatus })}
          className="select-hud xl:w-64"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <label className="flex items-center justify-between gap-3 rounded border border-cyan-neon/10 bg-space-deep/50 px-3 py-2">
          <span>
            <span className="hud-label block">INHERITED</span>
            <span className="text-xs text-slate-600">Common control provider</span>
          </span>
          <input
            type="checkbox"
            checked={record.inherited}
            onChange={(event) => onChange({ inherited: event.target.checked })}
            className="h-4 w-4 accent-cyan-neon"
          />
        </label>

        <input
          value={record.inheritedFrom}
          disabled={!record.inherited}
          onChange={(event) => onChange({ inheritedFrom: event.target.value })}
          className="input-hud"
          placeholder="Inherited from organization, cloud provider, enclave, shared service..."
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="hud-label text-slate-600">IMPLEMENTATION STATEMENT</p>
          {aiSuggestion && (
            <p className="mt-1 text-xs text-slate-500">
              AI suggestion ready from {aiSuggestion.provider} / {aiSuggestion.model}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={aiLoading}
          className="btn-secondary inline-flex items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {aiSuggestion ? 'REGENERATE' : 'GENERATE WITH AI'}
        </button>
      </div>

      <textarea
        value={record.implementationStatement}
        onChange={(event) => onChange({ implementationStatement: event.target.value, aiGenerated: false })}
        rows={3}
        className="textarea-hud mt-3"
        placeholder="Implementation statement / description..."
      />

      {aiLoading && aiStreamText !== undefined && (
        <div className="mt-3 rounded border border-cyan-neon/20 bg-cyan-neon/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={11} className="text-cyan-neon animate-spin flex-shrink-0" />
            <span className="hud-label text-cyan-neon" style={{ fontSize: 9 }}>GENERATING</span>
          </div>
          <p className="text-sm leading-6 text-slate-300 whitespace-pre-wrap">
            {aiStreamText}
            <span className="inline-block w-0.5 h-[14px] bg-cyan-neon/70 ml-0.5 align-middle animate-pulse" />
          </p>
        </div>
      )}

      {aiSuggestion && (
        <div className="mt-3 rounded border border-cyan-neon/25 bg-cyan-neon/5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded border border-cyan-neon/30 bg-cyan-neon/10 px-2 py-1 font-mono text-[10px] uppercase text-cyan-neon">
                  <Bot size={12} />
                  AI Suggestion
                </span>
                <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase ${statusClass(aiSuggestion.suggestedStatus)}`}>
                  {formatStatus(aiSuggestion.suggestedStatus)}
                </span>
                <span className="hud-label text-slate-600">{formatAiTimestamp(aiSuggestion.generatedAt)}</span>
                {aiSuggestion.fromCache && (
                  <span className="rounded border border-green-matrix/30 bg-green-matrix/10 px-2 py-1 font-mono text-[10px] uppercase text-green-matrix">
                    Cached
                  </span>
                )}
                {aiSuggestion.fallback && !aiSuggestion.fromCache && (
                  <span className="rounded border border-yellow-400/30 bg-yellow-400/10 px-2 py-1 font-mono text-[10px] uppercase text-yellow-400">
                    Template fallback
                  </span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{aiSuggestion.text}</p>
              {aiSuggestion.sources && aiSuggestion.sources.length > 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  RAG context: {aiSuggestion.sources.slice(0, 5).map((source) => source.controlId).join(', ')}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <button
                type="button"
                onClick={onAcceptSuggestion}
                className="btn-primary inline-flex items-center justify-center gap-2 text-xs"
              >
                <CheckCircle2 size={15} />
                ACCEPT AI SUGGESTION
              </button>
              <button
                type="button"
                onClick={onGenerate}
                disabled={aiLoading}
                className="btn-secondary inline-flex items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                REGENERATE
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <input
          value={record.evidenceNotes}
          onChange={(event) => onChange({ evidenceNotes: event.target.value })}
          className="input-hud"
          placeholder="Evidence notes, ticket, repository path, or collection reminder..."
        />
        <button
          type="button"
          onClick={() => setEvidenceOpen((open) => !open)}
          className={`btn-secondary inline-flex items-center justify-center gap-2 text-xs ${evidenceOpen ? 'border-cyan-neon/50 text-cyan-neon' : ''}`}
        >
          <Paperclip size={15} />
          EVIDENCE
          {linked.length > 0 && (
            <span className="rounded-full bg-cyan-neon/20 px-1.5 py-0.5 font-mono text-[10px] text-cyan-neon">{linked.length}</span>
          )}
        </button>
      </div>

      {evidenceOpen && (
        <div className="mt-3 rounded border border-cyan-neon/20 bg-space-deep/50 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <FileCheck2 size={14} className="text-cyan-neon" />
              <span className="hud-label">LINKED EVIDENCE ARTIFACTS</span>
            </div>
            <button type="button" onClick={() => setEvidenceOpen(false)} className="text-slate-600 hover:text-slate-300">
              <X size={14} />
            </button>
          </div>

          {linked.length === 0 ? (
            <p className="text-xs text-slate-600 mb-3">No artifacts linked to {control.controlId} yet.</p>
          ) : (
            <ul className="mb-3 space-y-1">
              {linked.map((artifact) => (
                <li key={artifact.id} className="flex items-center justify-between gap-2 rounded border border-cyan-neon/15 bg-space-elevated/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-slate-200">{artifact.title || artifact.fileName}</p>
                    <p className="text-[10px] text-slate-500">{artifact.type.replace(/_/g, ' ')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLinkArtifact(artifact.id, null)}
                    className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-alert"
                  >
                    <Unlink size={12} />
                    UNLINK
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-cyan-neon/10 pt-3">
            <p className="hud-label text-slate-600 mb-2">LINK FROM PROJECT ARTIFACTS</p>
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={artifactSearch}
                onChange={(e) => setArtifactSearch(e.target.value)}
                className="input-hud w-full pl-8 py-1.5 text-xs"
                placeholder="Search artifacts..."
              />
            </div>
            {artifacts.length === 0 ? (
              <p className="text-xs text-slate-600">No artifacts uploaded yet. Upload via the Artifacts tab.</p>
            ) : unlinked.length === 0 ? (
              <p className="text-xs text-slate-600">{artifactSearch ? 'No matching artifacts.' : 'All project artifacts are already linked.'}</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {unlinked.map((artifact) => (
                  <li key={artifact.id} className="flex items-center justify-between gap-2 rounded border border-slate-700/40 bg-space-elevated/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-300">{artifact.title || artifact.fileName}</p>
                      <p className="text-[10px] text-slate-500">{artifact.type.replace(/_/g, ' ')}{artifact.controlId ? ` · linked to ${artifact.controlId}` : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLinkArtifact(artifact.id, control.controlId)}
                      className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] text-cyan-neon/70 hover:text-cyan-neon"
                    >
                      <Paperclip size={12} />
                      LINK
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function CompactControlRow({
  control,
  record,
  selected,
  hasSuggestion,
  aiLoading,
  onSelect,
  onStatusChange,
  onExpand,
}: {
  control: ControlRef
  record: ImplementationRecord
  selected: boolean
  hasSuggestion: boolean
  aiLoading: boolean
  onSelect: (checked: boolean) => void
  onStatusChange: (status: ControlStatus) => void
  onExpand: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded border px-3 py-2 transition-colors ${
        selected
          ? 'border-cyan-neon/40 bg-cyan-neon/5'
          : 'border-cyan-neon/10 bg-space-elevated/30 hover:border-cyan-neon/25'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        className="h-3.5 w-3.5 flex-shrink-0 accent-cyan-neon"
      />

      <span className="control-id flex-shrink-0 text-[11px]">{control.controlId}</span>

      <span
        className={`hidden sm:inline-flex flex-shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${statusClass(record.status)}`}
      >
        {formatStatus(record.status)}
      </span>

      <p className="min-w-0 flex-1 truncate font-mono text-xs text-slate-400">
        {control.title ?? control.controlId}
      </p>

      <div className="flex flex-shrink-0 items-center gap-2">
        {record.inherited && (
          <span title="Inherited">
            <Shield size={12} className="text-purple-electric" />
          </span>
        )}
        {aiLoading && <Loader2 size={12} className="animate-spin text-cyan-neon" />}
        {hasSuggestion && !aiLoading && (
          <span title="AI suggestion pending">
            <Bot size={12} className="text-cyan-neon" />
          </span>
        )}

        <select
          value={record.status}
          onChange={(e) => onStatusChange(e.target.value as ControlStatus)}
          className="select-hud py-0.5 text-[11px]"
          onClick={(e) => e.stopPropagation()}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={onExpand}
          className="text-slate-600 hover:text-cyan-neon transition-colors"
          title="Expand to full view"
        >
          <LayoutList size={13} />
        </button>
      </div>
    </div>
  )
}
