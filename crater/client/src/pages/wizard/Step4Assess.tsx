import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileUp,
  Loader2,
  Plus,
  Save,
  SearchCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  aiApi,
  projectsApi,
  resolveApiAssetUrl,
  type AiAssessmentFinding,
  type AssessmentFinding,
  type DiagramRecord,
  type Step4Dto,
} from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import WizardShell from '@/components/layout/WizardShell'
import type { Project, RmfStepStatus } from '@/types/project'

type Severity = AssessmentFinding['severity']
type FindingStatus = AssessmentFinding['status']

interface Step4Data {
  findings?: AssessmentFinding[]
  evidenceDiagramIds?: string[]
  testResults?: string
  assessmentSummary?: string
}

type ProjectWithSteps = Omit<Project, 'rmfSteps'> & {
  diagrams?: DiagramRecord[]
  rmfSteps?: Array<{
    stepNumber: number
    status?: RmfStepStatus
    data?: Step4Data | null
  }>
}

const EMPTY_FINDING: AssessmentFinding = {
  id: '',
  controlId: '',
  description: '',
  severity: 'MODERATE',
  status: 'OPEN',
  evidence: '',
  recommendation: '',
}

const SEVERITY_CLASS: Record<Severity, string> = {
  CRITICAL: 'border-red-alert/40 bg-red-alert/15 text-red-alert',
  HIGH: 'border-red-alert/30 bg-red-alert/10 text-red-alert',
  MODERATE: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400',
  LOW: 'border-green-matrix/30 bg-green-matrix/10 text-green-matrix',
}

const STATUS_CLASS: Record<FindingStatus, string> = {
  OPEN: 'border-red-alert/30 bg-red-alert/10 text-red-alert',
  IN_REMEDIATION: 'border-cyan-neon/30 bg-cyan-neon/10 text-cyan-neon',
  CLOSED: 'border-green-matrix/30 bg-green-matrix/10 text-green-matrix',
  RISK_ACCEPTED: 'border-purple-electric/30 bg-purple-electric/10 text-purple-electric',
}

function getStep4(project: Project): Step4Data {
  return ((project as ProjectWithSteps).rmfSteps?.find((step) => step.stepNumber === 4)?.data ?? {}) as Step4Data
}

function buildSummary(findings: AssessmentFinding[]): Step4Dto['summary'] {
  return {
    total: findings.length,
    open: findings.filter((finding) => finding.status === 'OPEN' || finding.status === 'IN_REMEDIATION').length,
    criticalHigh: findings.filter((finding) => finding.severity === 'CRITICAL' || finding.severity === 'HIGH').length,
    closed: findings.filter((finding) => finding.status === 'CLOSED').length,
  }
}

type AssessmentSummary = NonNullable<Step4Dto['summary']>

function findingId() {
  return `finding-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function Step4Assess({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const stigInputRef = useRef<HTMLInputElement | null>(null)
  const saved = useMemo(() => getStep4(project), [project])
  const [findings, setFindings] = useState<AssessmentFinding[]>(saved.findings ?? [])
  const [evidenceDiagramIds, setEvidenceDiagramIds] = useState<string[]>(saved.evidenceDiagramIds ?? [])
  const [testResults, setTestResults] = useState(saved.testResults ?? '')
  const [assessmentSummary, setAssessmentSummary] = useState(saved.assessmentSummary ?? '')
  const [newFinding, setNewFinding] = useState<AssessmentFinding>({ ...EMPTY_FINDING, id: findingId() })
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiFindings, setAiFindings] = useState<AiAssessmentFinding[]>([])
  const [acceptedAiIds, setAcceptedAiIds] = useState<Set<string>>(new Set())
  const [pendingPoamIds, setPendingPoamIds] = useState<Set<string>>(new Set())

  const diagrams = (project as ProjectWithSteps).diagrams ?? []
  const summary = useMemo<AssessmentSummary>(() => buildSummary(findings) ?? {}, [findings])

  const saveMutation = useMutation({
    mutationFn: () =>
      projectsApi.saveStep4(project.id, {
        findings,
        evidenceDiagramIds,
        testResults,
        assessmentSummary,
        summary,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('STEP 4 ASSESSMENT SAVED')
    },
    onError: () => toast.error('STEP 4 SAVE FAILED'),
  })

  const uploadEvidence = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData()
      Array.from(files).forEach((file) => formData.append('files', file))
      formData.append('type', 'Architecture')
      formData.append('stepNumber', '4')
      return projectsApi.uploadDiagrams(project.id, formData)
    },
    onSuccess: (records) => {
      setEvidenceDiagramIds((current) => Array.from(new Set([...current, ...records.map((record) => record.id)])))
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      toast.success(`Uploaded ${records.length} evidence artifact${records.length === 1 ? '' : 's'}`)
    },
    onError: () => toast.error('Evidence upload failed'),
  })

  const importStig = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return projectsApi.importStigChecklist(project.id, formData)
    },
    onSuccess: (result) => {
      setFindings(result.findings)
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success(`Imported ${result.importedCount} ${result.sourceType} finding${result.importedCount === 1 ? '' : 's'}`)
      if (result.duplicateCount > 0) {
        toast(`${result.duplicateCount} duplicate finding${result.duplicateCount === 1 ? '' : 's'} skipped`)
      }
    },
    onError: () => toast.error('STIG checklist import failed'),
  })

  const generateFindings = useMutation({
    mutationFn: () => aiApi.generateAssessmentFindings({ projectId: project.id, maxFindings: 12 }),
    onSuccess: (result) => {
      setAiFindings(result.findings)
      setAcceptedAiIds(new Set())
      setAiPanelOpen(true)
      toast.success(result.findings.length ? `Generated ${result.findings.length} assessment findings` : 'No assessment gaps found')
    },
    onError: () => toast.error('AI finding generation failed'),
  })

  const createPoam = useMutation({
    mutationFn: async (finding: AssessmentFinding) => {
      const item = await projectsApi.createPoam(project.id, {
        controlId: finding.controlId || undefined,
        weakness: finding.description,
        description: finding.recommendation || finding.evidence || undefined,
        severity: finding.severity,
        status: 'OPEN',
        milestonesWithDates: 'Generated from Step 4 assessment finding.',
        resources: finding.evidence || undefined,
      })
      // Immediately persist poamItemId back into Step 4 so the link survives a page refresh.
      const updatedFindings = findings.map((f) =>
        f.id === finding.id ? { ...f, poamItemId: item.id } : f,
      )
      await projectsApi.saveStep4(project.id, {
        findings: updatedFindings,
        evidenceDiagramIds,
        testResults,
        assessmentSummary,
        summary: buildSummary(updatedFindings),
      })
      return { item, findingId: finding.id }
    },
    onSuccess: ({ item, findingId: id }) => {
      setFindings((current) => current.map((f) => (f.id === id ? { ...f, poamItemId: item.id } : f)))
      setPendingPoamIds((current) => { const next = new Set(current); next.delete(id); return next })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('POA&M item created — assessment saved')
    },
    onError: (_err, finding) => {
      setPendingPoamIds((current) => { const next = new Set(current); next.delete(finding.id); return next })
      toast.error('Unable to create POA&M item')
    },
  })

  function addFinding(finding: AssessmentFinding) {
    if (!finding.controlId.trim() || !finding.description.trim()) {
      toast.error('Control ID and finding description are required')
      return
    }
    setFindings((current) => [...current, { ...finding, id: finding.id || findingId() }])
    setNewFinding({ ...EMPTY_FINDING, id: findingId() })
  }

  function acceptAiFinding(finding: AiAssessmentFinding) {
    const accepted: AssessmentFinding = {
      id: finding.id || findingId(),
      controlId: finding.controlId,
      description: finding.description,
      severity: finding.severity,
      status: finding.status,
      evidence: finding.evidence,
      recommendation: finding.recommendation,
      aiGenerated: true,
      aiGeneratedAt: new Date().toISOString(),
    }
    setFindings((current) => (current.some((item) => item.id === accepted.id) ? current : [...current, accepted]))
    setAcceptedAiIds((current) => new Set(current).add(finding.id))
  }

  function acceptAllAiFindings() {
    const pending = aiFindings.filter((finding) => !acceptedAiIds.has(finding.id))
    if (pending.length === 0) return
    if (!window.confirm(`Accept ${pending.length} AI assessment findings?`)) return
    pending.forEach(acceptAiFinding)
    toast.success(`Accepted ${pending.length} AI findings`)
  }

  return (
    <WizardShell
      project={project}
      activeStep={4}
      title="Step 4: Assess"
      eyebrow="FINDINGS, EVIDENCE, AND TEST RESULTS"
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => stigInputRef.current?.click()}
            disabled={importStig.isPending}
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {importStig.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
            IMPORT CKL / XCCDF
          </button>
          <button
            type="button"
            onClick={() => generateFindings.mutate()}
            disabled={generateFindings.isPending}
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {generateFindings.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            GENERATE FINDINGS
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            SAVE ASSESSMENT
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <input
          ref={stigInputRef}
          type="file"
          accept=".ckl,.xml,.xccdf,text/xml,application/xml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) importStig.mutate(file)
            event.target.value = ''
          }}
        />
        <section className="rmf-card active p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="hud-label text-slate-600">NIST SP 800-53A / RMF ASSESS</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">Assessment Workspace</h3>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Record assessment findings, attach evidence, summarize test results, and promote unresolved weaknesses into POA&M.
              </p>
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary inline-flex items-center justify-center gap-2 text-xs">
              <FileUp size={15} />
              UPLOAD EVIDENCE
            </button>
            <Link to={`/projects/${project.id}/artifacts`} className="btn-secondary inline-flex items-center justify-center gap-2 text-xs">
              ARTIFACTS LIBRARY
            </Link>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) uploadEvidence.mutate(event.target.files)
                event.target.value = ''
              }}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="FINDINGS" value={summary.total ?? 0} tone="cyan" />
            <Metric label="OPEN" value={summary.open ?? 0} tone="red" />
            <Metric label="CRITICAL / HIGH" value={summary.criticalHigh ?? 0} tone="yellow" />
            <Metric label="CLOSED" value={summary.closed ?? 0} tone="green" />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="rmf-card p-5">
              <div className="flex items-center gap-2">
                <Plus size={17} className="text-cyan-neon" />
                <span className="hud-label">ADD FINDING</span>
              </div>
              <div className="mt-4 space-y-3">
                <input className="input-hud w-full" placeholder="Control ID, e.g. AC-2" value={newFinding.controlId} onChange={(e) => setNewFinding({ ...newFinding, controlId: e.target.value })} />
                <textarea className="textarea-hud w-full" placeholder="Finding description..." value={newFinding.description} onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })} />
                <textarea className="textarea-hud w-full" placeholder="Evidence observed / missing..." value={newFinding.evidence} onChange={(e) => setNewFinding({ ...newFinding, evidence: e.target.value })} />
                <textarea className="textarea-hud w-full" placeholder="Recommended corrective action..." value={newFinding.recommendation} onChange={(e) => setNewFinding({ ...newFinding, recommendation: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <select className="select-hud" value={newFinding.severity} onChange={(e) => setNewFinding({ ...newFinding, severity: e.target.value as Severity })}>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="LOW">Low</option>
                  </select>
                  <select className="select-hud" value={newFinding.status} onChange={(e) => setNewFinding({ ...newFinding, status: e.target.value as FindingStatus })}>
                    <option value="OPEN">Open</option>
                    <option value="IN_REMEDIATION">In Remediation</option>
                    <option value="RISK_ACCEPTED">Risk Accepted</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <button type="button" onClick={() => addFinding(newFinding)} className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs">
                  <Plus size={15} />
                  ADD FINDING
                </button>
              </div>
            </div>

            <div className="rmf-card p-5">
              <div className="flex items-center gap-2">
                <FileUp size={17} className="text-cyan-neon" />
                <span className="hud-label">EVIDENCE ARTIFACTS</span>
              </div>
              <div className="mt-4 space-y-2">
                {diagrams.length === 0 ? (
                  <p className="text-sm text-slate-500">No uploaded artifacts are available yet.</p>
                ) : (
                  diagrams.map((diagram) => (
                    <label key={diagram.id} className="flex items-center justify-between gap-3 rounded border border-cyan-neon/10 bg-space-elevated/40 p-3">
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-sm text-slate-200">{diagram.fileName}</span>
                        <a className="text-xs text-cyan-neon hover:underline" href={resolveApiAssetUrl(diagram.fileUrl)} target="_blank" rel="noreferrer">
                          Open evidence
                        </a>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-cyan-neon"
                        checked={evidenceDiagramIds.includes(diagram.id)}
                        onChange={(event) => {
                          setEvidenceDiagramIds((current) =>
                            event.target.checked ? [...current, diagram.id] : current.filter((id) => id !== diagram.id),
                          )
                        }}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {findings.length === 0 ? (
              <div className="rmf-card p-8 text-center">
                <SearchCheck size={28} className="mx-auto text-slate-600" />
                <p className="mt-4 font-mono text-sm text-slate-300">NO ASSESSMENT FINDINGS RECORDED</p>
                <p className="mt-2 text-sm text-slate-500">Add findings manually or generate AI findings from Step 3 gaps.</p>
              </div>
            ) : (
              findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  projectId={project.id}
                  onDelete={() => setFindings((current) => current.filter((item) => item.id !== finding.id))}
                  onUpdate={(patch) => setFindings((current) => current.map((item) => (item.id === finding.id ? { ...item, ...patch } : item)))}
                  onCreatePoam={() => {
                    setPendingPoamIds((current) => new Set(current).add(finding.id))
                    createPoam.mutate(finding)
                  }}
                  poamPending={pendingPoamIds.has(finding.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rmf-card p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={17} className="text-cyan-neon" />
              <span className="hud-label">TEST RESULTS</span>
            </div>
            <textarea
              className="textarea-hud mt-4 min-h-40 w-full"
              value={testResults}
              onChange={(event) => setTestResults(event.target.value)}
              placeholder="Document assessment procedures performed, sampled evidence, interviewed roles, tool outputs, and validation results..."
            />
          </div>
          <div className="rmf-card p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-cyan-neon" />
              <span className="hud-label">ASSESSMENT SUMMARY</span>
            </div>
            <textarea
              className="textarea-hud mt-4 min-h-40 w-full"
              value={assessmentSummary}
              onChange={(event) => setAssessmentSummary(event.target.value)}
              placeholder="Summarize assessment posture, residual risk, significant findings, evidence sufficiency, and POA&M follow-up..."
            />
          </div>
        </section>

        {aiPanelOpen && (
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-cyan-neon/25 bg-space-surface p-5 shadow-glow-cyan">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="hud-label text-slate-600">AI ASSESSMENT PANEL</p>
                <h3 className="mt-1 font-mono text-lg text-slate-100">Generated Findings</h3>
                <p className="mt-2 text-sm text-slate-500">Review suggested findings before adding them to the official Step 4 assessment record.</p>
              </div>
              <button type="button" onClick={() => setAiPanelOpen(false)} className="btn-secondary px-3 py-2">
                <X size={16} />
              </button>
            </div>
            <button type="button" onClick={acceptAllAiFindings} className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 text-xs">
              <CheckCircle2 size={15} />
              ACCEPT ALL PENDING FINDINGS
            </button>
            <div className="mt-5 space-y-3">
              {aiFindings.map((finding) => {
                const accepted = acceptedAiIds.has(finding.id)
                return (
                  <div key={finding.id} className="rounded border border-cyan-neon/15 bg-space-elevated/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="control-id">{finding.controlId}</span>
                      <span className={`rounded border px-2 py-1 font-mono text-[10px] ${SEVERITY_CLASS[finding.severity]}`}>{finding.severity}</span>
                      <span className="inline-flex items-center gap-1 rounded border border-purple-electric/25 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] text-purple-electric">
                        <Bot size={12} />
                        {finding.confidenceScore}% CONF
                      </span>
                      {accepted && <span className="rounded border border-green-matrix/30 bg-green-matrix/10 px-2 py-1 font-mono text-[10px] text-green-matrix">ACCEPTED</span>}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-200">{finding.description}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{finding.rationale}</p>
                    <button type="button" onClick={() => acceptAiFinding(finding)} disabled={accepted} className="btn-primary mt-4 inline-flex items-center gap-2 text-xs disabled:opacity-60">
                      <CheckCircle2 size={14} />
                      ACCEPT FINDING
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </WizardShell>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'red' | 'yellow' | 'green' }) {
  const color = {
    cyan: 'text-cyan-neon',
    red: 'text-red-alert',
    yellow: 'text-yellow-400',
    green: 'text-green-matrix',
  }[tone]
  return (
    <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-3">
      <p className="hud-label text-slate-600">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function FindingCard({
  finding,
  projectId,
  onDelete,
  onUpdate,
  onCreatePoam,
  poamPending,
}: {
  finding: AssessmentFinding
  projectId: string
  onDelete: () => void
  onUpdate: (patch: Partial<AssessmentFinding>) => void
  onCreatePoam: () => void
  poamPending: boolean
}) {
  return (
    <article className="rmf-card p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="control-id">{finding.controlId}</span>
            <span className={`rounded border px-2 py-1 font-mono text-[10px] ${SEVERITY_CLASS[finding.severity]}`}>{finding.severity}</span>
            <span className={`rounded border px-2 py-1 font-mono text-[10px] ${STATUS_CLASS[finding.status]}`}>{finding.status.replace(/_/g, ' ')}</span>
            {finding.aiGenerated && <span className="rounded border border-cyan-neon/30 bg-cyan-neon/10 px-2 py-1 font-mono text-[10px] text-cyan-neon">AI</span>}
            {finding.poamItemId && <span className="rounded border border-green-matrix/30 bg-green-matrix/10 px-2 py-1 font-mono text-[10px] text-green-matrix">POA&amp;M LINKED</span>}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-200">{finding.description}</p>
          {finding.evidence && <p className="mt-2 text-xs leading-5 text-slate-500">Evidence: {finding.evidence}</p>}
          {finding.recommendation && <p className="mt-2 text-xs leading-5 text-slate-500">Recommendation: {finding.recommendation}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <select className="select-hud" value={finding.status} onChange={(event) => onUpdate({ status: event.target.value as FindingStatus })}>
            <option value="OPEN">Open</option>
            <option value="IN_REMEDIATION">In Remediation</option>
            <option value="RISK_ACCEPTED">Risk Accepted</option>
            <option value="CLOSED">Closed</option>
          </select>
          {finding.poamItemId ? (
            <Link
              to={`/projects/${projectId}/poam`}
              className="btn-secondary inline-flex items-center justify-center gap-2 text-xs text-green-matrix"
            >
              <ExternalLink size={14} />
              VIEW POA&amp;M
            </Link>
          ) : (
            <button
              type="button"
              onClick={onCreatePoam}
              disabled={poamPending}
              className="btn-primary inline-flex items-center justify-center gap-2 text-xs disabled:opacity-60"
            >
              {poamPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
              CREATE POA&amp;M
            </button>
          )}
          <button type="button" onClick={onDelete} className="btn-secondary inline-flex items-center justify-center gap-2 text-xs text-red-alert">
            <Trash2 size={14} />
            REMOVE
          </button>
        </div>
      </div>
    </article>
  )
}
