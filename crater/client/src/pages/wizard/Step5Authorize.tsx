import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  Package,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  aiApi,
  projectsApi,
  type AiRiskRationaleResponse,
  type DiagramRecord,
  type Step5Dto,
} from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import WizardShell from '@/components/layout/WizardShell'
import type { Project, RmfStepStatus } from '@/types/project'

type AuthDecision = 'APPROVE' | 'DENY' | 'CONDITIONAL'

interface Step2Data {
  selectedControlIds?: string[]
  jsigOverlay?: boolean
}

interface Step3Summary {
  total?: number
  implemented?: number
  partial?: number
  planned?: number
  percent?: number
}

interface Step4Summary {
  total?: number
  open?: number
  criticalHigh?: number
  closed?: number
}

interface Step4Finding {
  id: string
  severity?: string
  status?: string
}

interface Step5Data {
  residualRisk?: string
  riskAcceptanceRationale?: string
  decision?: AuthDecision
  decisionDate?: string
  decisionRationale?: string
  conditions?: string
  atoExpiryDate?: string
  signatures?: {
    ao?: string
    aoDate?: string
    dao?: string
    daoDate?: string
    isso?: string
    issoDate?: string
  }
  packageGenerated?: boolean
  packageGeneratedAt?: string
  notes?: string
}

interface ProjectWithSteps extends Omit<Project, 'rmfSteps'> {
  diagrams?: DiagramRecord[]
  rmfSteps?: Array<{
    stepNumber: number
    status?: RmfStepStatus
    data?: Record<string, unknown> | null
  }>
  atoExpiry?: string | null
}

function getStepData(project: Project, stepNumber: number): Record<string, unknown> {
  return ((project as ProjectWithSteps).rmfSteps?.find((s) => s.stepNumber === stepNumber)?.data ?? {}) as Record<string, unknown>
}

function getStep5(project: Project): Step5Data {
  return getStepData(project, 5) as Step5Data
}

function computeRiskMetrics(project: Project) {
  const step2 = getStepData(project, 2) as Step2Data
  const step3Data = getStepData(project, 3)
  const step3Summary = (step3Data.summary ?? {}) as Step3Summary
  const step4Data = getStepData(project, 4)
  const step4Summary = (step4Data.summary ?? {}) as Step4Summary
  const step4Findings = (step4Data.findings ?? []) as Step4Finding[]

  const controlsSelected = step2.selectedControlIds?.length ?? 0
  const implTotal = step3Summary.total ?? controlsSelected
  const implImplemented = step3Summary.implemented ?? 0
  const implPercent = step3Summary.percent ?? (implTotal > 0 ? Math.round((implImplemented / implTotal) * 100) : 0)

  const findingsTotal = step4Summary.total ?? step4Findings.length
  const findingsOpen = step4Summary.open ?? step4Findings.filter((f) => f.status === 'OPEN' || f.status === 'IN_REMEDIATION').length
  const findingsCritHigh = step4Summary.criticalHigh ?? step4Findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH').length
  const findingsClosed = step4Summary.closed ?? step4Findings.filter((f) => f.status === 'CLOSED' || f.status === 'RISK_ACCEPTED').length

  const poamTotal = (project as Project & { _count?: { poamItems?: number } })._count?.poamItems ?? 0

  return {
    impactLevel: project.impactLevel,
    jsigOverlay: Boolean(step2.jsigOverlay),
    controlsSelected,
    implImplemented,
    implTotal,
    implPercent,
    findingsTotal,
    findingsOpen,
    findingsCritHigh,
    findingsClosed,
    poamTotal,
  }
}

function isoToDateInput(iso?: string): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function dateInputToIso(dateStr: string): string | undefined {
  if (!dateStr) return undefined
  return new Date(dateStr + 'T00:00:00.000Z').toISOString()
}

const DECISION_CONFIG = {
  APPROVE: {
    label: 'APPROVE',
    icon: ShieldCheck,
    color: 'text-green-matrix',
    border: 'border-green-matrix/40 bg-green-matrix/10',
    activeBorder: 'border-green-matrix bg-green-matrix/20 shadow-[0_0_12px_rgba(0,255,65,0.2)]',
  },
  DENY: {
    label: 'DENY',
    icon: ShieldX,
    color: 'text-red-alert',
    border: 'border-red-alert/40 bg-red-alert/10',
    activeBorder: 'border-red-alert bg-red-alert/20 shadow-[0_0_12px_rgba(255,59,48,0.2)]',
  },
  CONDITIONAL: {
    label: 'CONDITIONAL',
    icon: ShieldAlert,
    color: 'text-yellow-400',
    border: 'border-yellow-400/40 bg-yellow-400/10',
    activeBorder: 'border-yellow-400 bg-yellow-400/20 shadow-[0_0_12px_rgba(250,204,21,0.2)]',
  },
} as const

export default function Step5Authorize({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const saved = useMemo(() => getStep5(project), [project])
  const metrics = useMemo(() => computeRiskMetrics(project), [project])

  const [decision, setDecision] = useState<AuthDecision | undefined>(saved.decision)
  const [decisionDate, setDecisionDate] = useState(isoToDateInput(saved.decisionDate))
  const [atoExpiryDate, setAtoExpiryDate] = useState(isoToDateInput(saved.atoExpiryDate))
  const [decisionRationale, setDecisionRationale] = useState(saved.decisionRationale ?? '')
  const [conditions, setConditions] = useState(saved.conditions ?? '')
  const [residualRisk, setResidualRisk] = useState(saved.residualRisk ?? '')
  const [riskAcceptanceRationale, setRiskAcceptanceRationale] = useState(saved.riskAcceptanceRationale ?? '')
  const [signatures, setSignatures] = useState(saved.signatures ?? {})
  const [notes, setNotes] = useState(saved.notes ?? '')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiResult, setAiResult] = useState<AiRiskRationaleResponse | null>(null)

  const saveMutation = useMutation({
    mutationFn: () =>
      projectsApi.saveStep5(project.id, {
        decision,
        decisionDate: dateInputToIso(decisionDate),
        atoExpiryDate: dateInputToIso(atoExpiryDate),
        decisionRationale: decisionRationale || undefined,
        conditions: conditions || undefined,
        residualRisk: residualRisk || undefined,
        riskAcceptanceRationale: riskAcceptanceRationale || undefined,
        signatures: Object.keys(signatures).length ? signatures : undefined,
        notes: notes || undefined,
      } as Step5Dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('AUTHORIZATION RECORD SAVED')
    },
    onError: () => toast.error('SAVE FAILED'),
  })

  const generateRationale = useMutation({
    mutationFn: () =>
      aiApi.generateRiskRationale({
        projectId: project.id,
        decisionType: decision,
      }),
    onSuccess: (result) => {
      setAiResult(result)
      setAiPanelOpen(true)
      toast.success('AI risk rationale drafted')
    },
    onError: () => toast.error('AI generation failed'),
  })

  const downloadSsp = useMutation({
    mutationFn: () => projectsApi.generateSsp(project.id, true),
    onSuccess: (response) => {
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/\s+/g, '_')}_SSP.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('SSP downloaded')
    },
    onError: () => toast.error('SSP generation failed'),
  })

  const downloadPackage = useMutation({
    mutationFn: () => projectsApi.generatePackage(project.id),
    onSuccess: (response) => {
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/\s+/g, '_')}_RMF_Package.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('RMF package downloaded')
    },
    onError: () => toast.error('RMF package export failed'),
  })

  function patchSig(key: keyof NonNullable<Step5Data['signatures']>, value: string) {
    setSignatures((prev) => ({ ...prev, [key]: value || undefined }))
  }

  const riskColor =
    metrics.findingsOpen > 0 && metrics.findingsCritHigh > 0
      ? 'text-red-alert'
      : metrics.findingsOpen > 0
        ? 'text-yellow-400'
        : 'text-green-matrix'

  return (
    <WizardShell
      project={project}
      activeStep={5}
      title="Step 5: Authorize"
      eyebrow="RISK DECISION AND ATO PACKAGE"
      actions={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => generateRationale.mutate()}
            disabled={generateRationale.isPending}
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {generateRationale.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            AI DRAFT RATIONALE
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            SAVE AUTHORIZATION
          </button>
        </div>
      }
    >
      <div className="space-y-5">

        {/* Risk Overview */}
        <section className="rmf-card active p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="hud-label text-slate-600">NIST SP 800-37 REV. 2 / AUTHORIZE STEP</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">Risk Overview</h3>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Review the aggregated risk posture from all prior RMF steps before recording the authorization decision.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Shield size={17} className="text-cyan-neon" />
              <span className={`font-mono text-sm font-bold ${metrics.impactLevel === 'HIGH' ? 'text-red-alert' : metrics.impactLevel === 'MODERATE' ? 'text-yellow-400' : 'text-green-matrix'}`}>
                {metrics.impactLevel} IMPACT
              </span>
              {metrics.jsigOverlay && (
                <span className="ml-2 rounded border border-purple-electric/40 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] text-purple-electric">
                  JSIG/SAP
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="CONTROLS SELECTED" value={String(metrics.controlsSelected)} tone="cyan" />
            <MetricCard label="IMPLEMENTED" value={`${metrics.implImplemented} (${metrics.implPercent}%)`} tone={metrics.implPercent >= 80 ? 'green' : metrics.implPercent >= 50 ? 'yellow' : 'red'} />
            <MetricCard label="OPEN FINDINGS" value={String(metrics.findingsOpen)} tone={metrics.findingsOpen === 0 ? 'green' : metrics.findingsCritHigh > 0 ? 'red' : 'yellow'} />
            <MetricCard label="POA&M ITEMS" value={String(metrics.poamTotal)} tone={metrics.poamTotal === 0 ? 'green' : 'cyan'} />
          </div>

          {metrics.findingsCritHigh > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded border border-red-alert/25 bg-red-alert/5 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-alert" />
              <p className="text-sm text-red-alert">
                {metrics.findingsCritHigh} Critical/High finding{metrics.findingsCritHigh !== 1 ? 's' : ''} detected — these require documented disposition before authorization.
              </p>
            </div>
          )}
        </section>

        {/* Authorization Decision */}
        <section className="rmf-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={17} className="text-cyan-neon" />
            <span className="hud-label">AUTHORIZATION DECISION</span>
          </div>

          <p className="mb-4 text-sm text-slate-500">Select the Authorizing Official's decision. This will update the project status.</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(['APPROVE', 'DENY', 'CONDITIONAL'] as AuthDecision[]).map((opt) => {
              const cfg = DECISION_CONFIG[opt]
              const Icon = cfg.icon
              const active = decision === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDecision(active ? undefined : opt)}
                  className={`flex items-center gap-3 rounded border p-4 text-left transition-all ${active ? cfg.activeBorder : cfg.border} hover:opacity-90`}
                >
                  <Icon size={22} className={cfg.color} />
                  <div>
                    <p className={`font-mono text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {opt === 'APPROVE' && 'Full ATO granted'}
                      {opt === 'DENY' && 'Authorization refused'}
                      {opt === 'CONDITIONAL' && 'ATO with conditions'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="hud-label mb-2 block text-slate-600">DECISION DATE</label>
              <input
                type="date"
                className="input-hud w-full"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
              />
            </div>
            {(decision === 'APPROVE' || decision === 'CONDITIONAL') && (
              <div>
                <label className="hud-label mb-2 block text-slate-600">ATO EXPIRY DATE</label>
                <input
                  type="date"
                  className="input-hud w-full"
                  value={atoExpiryDate}
                  onChange={(e) => setAtoExpiryDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </section>

        {/* Decision Rationale */}
        <section className="rmf-card p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <FileText size={17} className="text-cyan-neon" />
              <span className="hud-label">RISK DECISION RATIONALE</span>
            </div>
            <button
              type="button"
              onClick={() => generateRationale.mutate()}
              disabled={generateRationale.isPending}
              className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-60"
            >
              {generateRationale.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              AI DRAFT
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500">Formally document the AO's basis for the decision, referencing the system risk posture, residual risk, and POA&M disposition.</p>
          <textarea
            className="textarea-hud min-h-48 w-full"
            value={decisionRationale}
            onChange={(e) => setDecisionRationale(e.target.value)}
            placeholder="Following a comprehensive review of the system authorization package, the Authorizing Official has determined that..."
          />
        </section>

        {/* Conditions — only visible for CONDITIONAL */}
        {decision === 'CONDITIONAL' && (
          <section className="rmf-card p-5 border-yellow-400/20">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert size={17} className="text-yellow-400" />
              <span className="hud-label text-yellow-400">CONDITIONS FOR AUTHORIZATION</span>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Enumerate the specific conditions, milestones, and timeframes that must be satisfied for this authorization to remain valid or convert to a full ATO.
            </p>
            <textarea
              className="textarea-hud min-h-40 w-full"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="1. All Critical and High findings must be resolved within 60 days of authorization date.&#10;2. Quarterly POA&M status reports must be provided to the ISSO and AO.&#10;3. Any significant change to the authorization boundary requires immediate AO notification..."
            />
          </section>
        )}

        {/* Residual Risk */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rmf-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={17} className={riskColor} />
              <span className="hud-label">RESIDUAL RISK STATEMENT</span>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Describe the residual risk accepted by the AO — open findings, POA&M items, known weaknesses, and environmental constraints not fully mitigated by implemented controls.
            </p>
            <textarea
              className="textarea-hud min-h-40 w-full"
              value={residualRisk}
              onChange={(e) => setResidualRisk(e.target.value)}
              placeholder="The following residual risks have been identified and are accepted by the Authorizing Official for the authorization period..."
            />
          </div>
          <div className="rmf-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={17} className="text-cyan-neon" />
              <span className="hud-label">RISK ACCEPTANCE RATIONALE</span>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Document why the identified residual risks are acceptable given the mission need, operational context, compensating controls, and continuous monitoring posture.
            </p>
            <textarea
              className="textarea-hud min-h-40 w-full"
              value={riskAcceptanceRationale}
              onChange={(e) => setRiskAcceptanceRationale(e.target.value)}
              placeholder="The residual risk posture is deemed acceptable based on the mission criticality of the system, the compensating controls in place, and the documented remediation timeline..."
            />
          </div>
        </section>

        {/* Signature Block */}
        <section className="rmf-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <FileCheck2 size={17} className="text-cyan-neon" />
            <span className="hud-label">SIGNATURE BLOCK</span>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Record the names and dates for each signing official. These will appear in the ATO package cover sheet.
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <SignatureField
              role="Authorizing Official (AO)"
              nameValue={signatures.ao ?? ''}
              dateValue={isoToDateInput(signatures.aoDate)}
              onNameChange={(v) => patchSig('ao', v)}
              onDateChange={(v) => patchSig('aoDate', dateInputToIso(v) ?? '')}
            />
            <SignatureField
              role="Deputy AO (DAO)"
              nameValue={signatures.dao ?? ''}
              dateValue={isoToDateInput(signatures.daoDate)}
              onNameChange={(v) => patchSig('dao', v)}
              onDateChange={(v) => patchSig('daoDate', dateInputToIso(v) ?? '')}
            />
            <SignatureField
              role="ISSO"
              nameValue={signatures.isso ?? ''}
              dateValue={isoToDateInput(signatures.issoDate)}
              onNameChange={(v) => patchSig('isso', v)}
              onDateChange={(v) => patchSig('issoDate', dateInputToIso(v) ?? '')}
            />
          </div>
        </section>

        {/* ATO Package */}
        <section className="rmf-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={17} className="text-cyan-neon" />
            <span className="hud-label">ATO PACKAGE</span>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Generate and download the authorization artifacts. The SSP bundles all step data, control narratives, and uploaded diagrams into a Word document.
          </p>

          <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: FileText, label: 'System Security Plan (SSP)', note: 'Word document, all steps' },
              { icon: AlertTriangle, label: 'Plan of Action & Milestones (POA&M)', note: 'From Step 4 + POA&M page' },
              { icon: FileCheck2, label: 'Security Assessment Report', note: 'Findings and evidence' },
              { icon: Shield, label: 'Authorization Decision Letter', note: 'Decision record from this step' },
              { icon: Bot, label: 'Control Implementation Summary', note: 'Step 3 narratives' },
            ].map(({ icon: Icon, label, note }) => (
              <div key={label} className="flex items-start gap-3 rounded border border-cyan-neon/10 bg-space-elevated/40 p-3">
                <Icon size={15} className="mt-0.5 shrink-0 text-cyan-neon" />
                <div>
                  <p className="font-mono text-xs text-slate-200">{label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{note}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to={`/projects/${project.id}/artifacts`} className="btn-secondary inline-flex items-center gap-2 text-xs">
              <FileCheck2 size={15} />
              ARTIFACTS LIBRARY
            </Link>
            <button
              type="button"
              onClick={() => downloadPackage.mutate()}
              disabled={downloadPackage.isPending}
              className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-60"
            >
              {downloadPackage.isPending ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
              EXPORT PACKAGE ZIP
            </button>
            <button
              type="button"
              onClick={() => downloadSsp.mutate()}
              disabled={downloadSsp.isPending}
              className="btn-primary inline-flex items-center gap-2 text-xs disabled:opacity-60"
            >
              {downloadSsp.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              DOWNLOAD SSP (.docx)
            </button>
          </div>
        </section>

        {/* Notes */}
        <section className="rmf-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={17} className="text-cyan-neon" />
            <span className="hud-label">AUTHORIZATION NOTES</span>
          </div>
          <textarea
            className="textarea-hud min-h-28 w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes, AO communications, escalation history, or other authorization context..."
          />
        </section>

        {/* AI Panel */}
        {aiPanelOpen && aiResult && (
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-cyan-neon/25 bg-space-surface p-5 shadow-glow-cyan">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="hud-label text-slate-600">AI AUTHORIZATION PANEL</p>
                <h3 className="mt-1 font-mono text-lg text-slate-100">Drafted Risk Rationale</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Review and edit the AI-drafted rationale before accepting it into the authorization record.
                </p>
              </div>
              <button type="button" onClick={() => setAiPanelOpen(false)} className="btn-secondary px-3 py-2">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-1 font-mono text-[10px] ${aiResult.decisionType === 'APPROVE' ? 'border-green-matrix/30 bg-green-matrix/10 text-green-matrix' : aiResult.decisionType === 'DENY' ? 'border-red-alert/30 bg-red-alert/10 text-red-alert' : 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400'}`}>
                {aiResult.decisionType}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-purple-electric/25 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] text-purple-electric">
                <Bot size={12} />
                {aiResult.fallback ? 'TEMPLATE' : 'AI'}
              </span>
              {aiResult.jsigContextApplied && (
                <span className="rounded border border-purple-electric/25 bg-purple-electric/10 px-2 py-1 font-mono text-[10px] text-purple-electric">
                  JSIG
                </span>
              )}
            </div>

            <div className="mt-5 rounded border border-cyan-neon/15 bg-space-elevated/60 p-4">
              <p className="text-sm leading-7 text-slate-200 whitespace-pre-wrap">{aiResult.generatedText}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setDecisionRationale(aiResult.generatedText)
                setAiPanelOpen(false)
                toast.success('Rationale accepted — review and save')
              }}
              className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 text-xs"
            >
              <CheckCircle2 size={15} />
              ACCEPT INTO DECISION RATIONALE
            </button>

            <p className="mt-3 text-center text-xs text-slate-600">
              Always review AI-generated content before signing. AO attestation is the authoritative record.
            </p>
          </div>
        )}
      </div>
    </WizardShell>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'red' | 'yellow' | 'green' }) {
  const color = { cyan: 'text-cyan-neon', red: 'text-red-alert', yellow: 'text-yellow-400', green: 'text-green-matrix' }[tone]
  return (
    <div className="rounded border border-cyan-neon/15 bg-space-elevated/40 p-3">
      <p className="hud-label text-slate-600">{label}</p>
      <p className={`mt-2 font-mono text-xl font-bold leading-tight ${color}`}>{value}</p>
    </div>
  )
}

function SignatureField({
  role,
  nameValue,
  dateValue,
  onNameChange,
  onDateChange,
}: {
  role: string
  nameValue: string
  dateValue: string
  onNameChange: (v: string) => void
  onDateChange: (v: string) => void
}) {
  return (
    <div className="space-y-3 rounded border border-cyan-neon/10 bg-space-elevated/30 p-4">
      <p className="hud-label text-cyan-neon">{role}</p>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Name / Title</label>
        <input
          type="text"
          className="input-hud w-full"
          placeholder="Full name and title"
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Date Signed</label>
        <input
          type="date"
          className="input-hud w-full"
          value={dateValue}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>
      <div className="mt-2 border-t border-slate-700 pt-3">
        <p className="text-xs text-slate-600 italic">Signature: ___________________________</p>
      </div>
    </div>
  )
}
