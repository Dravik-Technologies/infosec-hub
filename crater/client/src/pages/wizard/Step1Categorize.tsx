import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Save,
  Search,
  ShieldAlert,
  Target,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api, projectsApi, type Step1Dto } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import WizardShell from '@/components/layout/WizardShell'
import type { ImpactLevel, Project, RmfStepStatus } from '@/types/project'

// ─── Types ────────────────────────────────────────────────────────────────────

type ImpactScore = 'LOW' | 'MODERATE' | 'HIGH'

interface InformationType {
  id: string
  name: string
  family: string
  description: string
  confidentiality: ImpactScore
  integrity: ImpactScore
  availability: ImpactScore
}

interface InformationTypeResponse {
  id?: string
  controlId?: string
  name?: string
  title?: string
  family?: string
  description?: string
  confidentiality?: ImpactScore
  integrity?: ImpactScore
  availability?: ImpactScore
  lowBaseline?: boolean
  modBaseline?: boolean
  highBaseline?: boolean
}

interface Step1Draft {
  confirmedImpactLevel: ImpactLevel
  impactJustification: string
  selectedInformationTypeIds: string[]
  objectiveJustification: string
}

type ProjectWithStep1Data = Omit<Project, 'rmfSteps'> & {
  rmfSteps?: Array<{
    id?: string
    stepNumber: number
    status?: RmfStepStatus
    data?: Partial<Step1Draft> | null
  }>
}

interface SavedStep1 {
  id?: string
  stepNumber: number
  status?: RmfStepStatus
  data?: Step1Dto | null
}

// ─── Curated defaults (always shown when search is empty) ─────────────────────
// ~30 high-frequency types for federal/DoD systems, grouped by family.
// Shown in the default view regardless of what the backend catalog contains.
// When a type ID matches a backend record, the backend description wins on search.

const CURATED_TYPES: InformationType[] = [
  // ── Defense & National Security ──────────────────────────────────────────
  {
    id: 'd.1.1',
    name: 'Strategic National & Theater Defense',
    family: 'Defense & National Security',
    description: 'Strategic planning, force projection, and theater-level defense operations.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'd.1.2',
    name: 'DoD Stability & Reconstruction Operations',
    family: 'Defense & National Security',
    description: 'Post-conflict stabilization, support operations, and reconstruction activities.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'd.2.1',
    name: 'Tactical Operations',
    family: 'Defense & National Security',
    description: 'Unit-level operational planning, mission execution, and after-action reporting.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'd.5.1',
    name: 'Security Operations',
    family: 'Defense & National Security',
    description: 'Physical and cyber security operations, force protection, and threat response.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'MODERATE',
  },
  // ── Intelligence Operations ───────────────────────────────────────────────
  {
    id: 'd.3.1',
    name: 'Intelligence Planning & Direction',
    family: 'Intelligence Operations',
    description: 'Intelligence requirements management, collection planning, and tasking direction.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'd.3.2',
    name: 'Intelligence Collection',
    family: 'Intelligence Operations',
    description: 'Collection of intelligence data from HUMINT, SIGINT, GEOINT, and all-source.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'd.3.3',
    name: 'Intelligence Analysis & Production',
    family: 'Intelligence Operations',
    description: 'All-source intelligence analysis, production, and finished intelligence products.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'MODERATE',
  },
  // ── Classified / Special Programs ────────────────────────────────────────
  {
    id: 'cui.1.1',
    name: 'Controlled Unclassified Information (CUI)',
    family: 'Classified / CUI / SAP / SCI',
    description: 'Sensitive but unclassified information requiring safeguarding per CUI Registry.',
    confidentiality: 'MODERATE',
    integrity: 'MODERATE',
    availability: 'LOW',
  },
  {
    id: 'sap.1.1',
    name: 'Special Access Program Information',
    family: 'Classified / CUI / SAP / SCI',
    description: 'Highly sensitive Special Access Program data requiring additional program controls.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'sci.1.1',
    name: 'Sensitive Compartmented Information (SCI)',
    family: 'Classified / CUI / SAP / SCI',
    description: 'Intelligence information requiring special compartmented access controls.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  // ── Information Technology ────────────────────────────────────────────────
  {
    id: 'it.1.1',
    name: 'Information Technology Management',
    family: 'Information Technology',
    description: 'IT governance, lifecycle management, enterprise architecture, and policy.',
    confidentiality: 'LOW',
    integrity: 'MODERATE',
    availability: 'MODERATE',
  },
  {
    id: 'it.2.1',
    name: 'Identity, Credential & Access Management',
    family: 'Information Technology',
    description: 'User identity proofing, credential issuance, and logical access control.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'MODERATE',
  },
  {
    id: 'it.3.1',
    name: 'Supply Chain Risk Management',
    family: 'Information Technology',
    description: 'Vendor vetting, hardware/software provenance, and SCRM program activities.',
    confidentiality: 'MODERATE',
    integrity: 'HIGH',
    availability: 'MODERATE',
  },
  {
    id: 'it.4.1',
    name: 'Network & Infrastructure Management',
    family: 'Information Technology',
    description: 'Network architecture, monitoring, configuration management, and infrastructure ops.',
    confidentiality: 'MODERATE',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'it.5.1',
    name: 'Cybersecurity Operations',
    family: 'Information Technology',
    description: 'Vulnerability management, incident response, threat hunting, and SOC operations.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'MODERATE',
  },
  // ── Management & Oversight ────────────────────────────────────────────────
  {
    id: 'c.2.1.1',
    name: 'Controls and Oversight',
    family: 'Management & Oversight',
    description: 'Compliance auditability, governance, management controls, and accountability.',
    confidentiality: 'LOW',
    integrity: 'MODERATE',
    availability: 'LOW',
  },
  {
    id: 'c.2.2.1',
    name: 'Regulatory Compliance',
    family: 'Management & Oversight',
    description: 'Adherence to federal laws, regulations, directives, and organizational policy.',
    confidentiality: 'MODERATE',
    integrity: 'MODERATE',
    availability: 'LOW',
  },
  {
    id: 'c.2.3.1',
    name: 'Corrective Action / POA&M Management',
    family: 'Management & Oversight',
    description: 'Tracking and closure of security deficiencies, findings, and remediation plans.',
    confidentiality: 'MODERATE',
    integrity: 'HIGH',
    availability: 'LOW',
  },
  {
    id: 'c.1.1.1',
    name: 'Organizational Management',
    family: 'Management & Oversight',
    description: 'Mission execution, strategic objectives, and organizational governance.',
    confidentiality: 'LOW',
    integrity: 'MODERATE',
    availability: 'LOW',
  },
  // ── Financial Management ──────────────────────────────────────────────────
  {
    id: 'c.3.1.1',
    name: 'Budget Formulation & Execution',
    family: 'Financial Management',
    description: 'Budgeting, accounting, payments, and federal financial reporting.',
    confidentiality: 'MODERATE',
    integrity: 'HIGH',
    availability: 'MODERATE',
  },
  {
    id: 'c.3.1.2',
    name: 'Asset & Property Management',
    family: 'Financial Management',
    description: 'Tracking and accounting of government property, equipment, and assets.',
    confidentiality: 'LOW',
    integrity: 'HIGH',
    availability: 'LOW',
  },
  // ── Human Resources ───────────────────────────────────────────────────────
  {
    id: 'c.3.2.1',
    name: 'Personnel Management',
    family: 'Human Resources',
    description: 'Hiring, performance management, personnel records, and workforce administration.',
    confidentiality: 'MODERATE',
    integrity: 'MODERATE',
    availability: 'LOW',
  },
  {
    id: 'c.3.2.2',
    name: 'Security Clearance & Adjudication',
    family: 'Human Resources',
    description: 'Personnel security investigations, adjudication results, and clearance management.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'LOW',
  },
  // ── Legal & Records ───────────────────────────────────────────────────────
  {
    id: 'c.2.4.1',
    name: 'Legal & Privacy Compliance',
    family: 'Legal & Records',
    description: 'Privacy Act, FOIA, Freedom of Information, and legal case management.',
    confidentiality: 'MODERATE',
    integrity: 'MODERATE',
    availability: 'LOW',
  },
  {
    id: 'c.5.1.1',
    name: 'Records Management',
    family: 'Legal & Records',
    description: 'Official record retention, disposition, and lifecycle management per NARA.',
    confidentiality: 'LOW',
    integrity: 'HIGH',
    availability: 'LOW',
  },
  // ── Critical Infrastructure & Continuity ─────────────────────────────────
  {
    id: 'd.4.1',
    name: 'Critical Infrastructure Protection',
    family: 'Critical Infrastructure',
    description: 'Protection of critical infrastructure assets, physical security, and resilience.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'c.6.1.1',
    name: 'Continuity of Operations (COOP)',
    family: 'Critical Infrastructure',
    description: 'Business continuity, disaster recovery, and essential function continuity planning.',
    confidentiality: 'MODERATE',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  // ── Healthcare ────────────────────────────────────────────────────────────
  {
    id: 'hc.1.1',
    name: 'Patient Care Services',
    family: 'Healthcare',
    description: 'Direct patient care, clinical operations, and treatment delivery.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'HIGH',
  },
  {
    id: 'hc.1.2',
    name: 'Medical Records & EHR',
    family: 'Healthcare',
    description: 'Electronic health records, clinical documentation, and patient medical history.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'MODERATE',
  },
  {
    id: 'hc.2.1',
    name: 'Protected Health Information (PHI)',
    family: 'Healthcare',
    description: 'Individually identifiable health information per HIPAA requirements.',
    confidentiality: 'HIGH',
    integrity: 'HIGH',
    availability: 'MODERATE',
  },
]

// Family display order for the grouped default view
const FAMILY_ORDER = [
  'Defense & National Security',
  'Intelligence Operations',
  'Classified / CUI / SAP / SCI',
  'Information Technology',
  'Management & Oversight',
  'Financial Management',
  'Human Resources',
  'Legal & Records',
  'Critical Infrastructure',
  'Healthcare',
]

const CURATED_IDS = new Set(CURATED_TYPES.map((t) => t.id.toLowerCase()))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_ORDER: ImpactScore[] = ['LOW', 'MODERATE', 'HIGH']

function getStorageKey(projectId: string) {
  return `crater-step-1-categorize:${projectId}`
}

function createDefaultDraft(project: Project): Step1Draft {
  return {
    confirmedImpactLevel: project.impactLevel,
    impactJustification: '',
    selectedInformationTypeIds: [],
    objectiveJustification: '',
  }
}

function normalizeDraft(project: Project, draft?: Partial<Step1Draft> | null): Step1Draft {
  const fallback = createDefaultDraft(project)
  return {
    ...fallback,
    ...draft,
    selectedInformationTypeIds: draft?.selectedInformationTypeIds ?? fallback.selectedInformationTypeIds,
  }
}

function getBackendStep1Data(project: Project) {
  return (project as ProjectWithStep1Data).rmfSteps?.find((step) => step.stepNumber === 1)?.data ?? null
}

function readCachedDraft(project: Project): Step1Draft | null {
  const raw = localStorage.getItem(getStorageKey(project.id))
  if (!raw) return null
  try {
    return normalizeDraft(project, JSON.parse(raw) as Partial<Step1Draft>)
  } catch {
    localStorage.removeItem(getStorageKey(project.id))
    return null
  }
}

function getInitialDraft(project: Project): Step1Draft {
  const backendData = getBackendStep1Data(project)
  if (backendData) return normalizeDraft(project, backendData)
  return readCachedDraft(project) ?? createDefaultDraft(project)
}

function getBaselineImpact(item: InformationTypeResponse): ImpactScore {
  if (item.highBaseline) return 'HIGH'
  if (item.modBaseline) return 'MODERATE'
  return 'LOW'
}

function normalizeInformationType(item: InformationTypeResponse): InformationType | null {
  const id = item.id ?? item.controlId
  const name = item.name ?? item.title
  if (!id || !name) return null
  const baselineImpact = getBaselineImpact(item)
  return {
    id,
    name,
    family: item.family ?? 'NIST SP 800-60',
    description: item.description ?? 'No description provided.',
    confidentiality: item.confidentiality ?? baselineImpact,
    integrity: item.integrity ?? baselineImpact,
    availability: item.availability ?? baselineImpact,
  }
}

async function fetchInformationTypes() {
  const response = await api.get<InformationTypeResponse[]>('/information-types')
  return response.data.map(normalizeInformationType).filter((item): item is InformationType => Boolean(item))
}

function getHighestImpact(scores: ImpactScore[]): ImpactScore {
  return scores.reduce<ImpactScore>((highest, score) => {
    return IMPACT_ORDER.indexOf(score) > IMPACT_ORDER.indexOf(highest) ? score : highest
  }, 'LOW')
}

function calculateImpact(types: InformationType[]) {
  const confidentiality = getHighestImpact(types.map((t) => t.confidentiality))
  const integrity = getHighestImpact(types.map((t) => t.integrity))
  const availability = getHighestImpact(types.map((t) => t.availability))
  const overall = getHighestImpact([confidentiality, integrity, availability])
  return { confidentiality, integrity, availability, overall }
}

function getImpactClass(impact: ImpactScore) {
  if (impact === 'HIGH') return 'text-red-alert border-red-alert/30 bg-red-alert/10'
  if (impact === 'MODERATE') return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
  return 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
}

function buildStep1Payload(
  draft: Step1Draft,
  calculatedImpact: ReturnType<typeof calculateImpact>,
  selectedInformationTypes: InformationType[],
): Step1Dto {
  return { ...draft, calculatedImpact, selectedInformationTypes }
}

function matchesSearch(type: InformationType, query: string): boolean {
  return [type.id, type.name, type.family, type.description].some((v) =>
    v.toLowerCase().includes(query),
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Step1Categorize({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Step1Draft>(() => getInitialDraft(project))
  const [search, setSearch] = useState('')

  const catalogQuery = useQuery({
    queryKey: ['information-types'],
    queryFn: fetchInformationTypes,
    retry: 1,
    staleTime: 1000 * 60 * 30,
  })

  const fullCatalog = catalogQuery.data ?? []

  // Merged pool: full catalog + any curated types not already in catalog (by ID).
  // Used for selected-type lookups so saved IDs always resolve.
  const allTypes = useMemo<InformationType[]>(() => {
    if (fullCatalog.length === 0) return CURATED_TYPES
    const catalogIds = new Set(fullCatalog.map((t) => t.id.toLowerCase()))
    const curatedOnly = CURATED_TYPES.filter((c) => !catalogIds.has(c.id.toLowerCase()))
    return [...fullCatalog, ...curatedOnly]
  }, [fullCatalog])

  const selectedTypes = useMemo(
    () => allTypes.filter((t) => draft.selectedInformationTypeIds.includes(t.id)),
    [allTypes, draft.selectedInformationTypeIds],
  )

  const calculatedImpact = useMemo(() => calculateImpact(selectedTypes), [selectedTypes])

  // Default view: curated list grouped by family.
  // Search view: filter the full catalog (or curated list if catalog empty).
  const normalizedSearch = search.trim().toLowerCase()

  const displayedTypes = useMemo<InformationType[]>(() => {
    if (!normalizedSearch) return CURATED_TYPES
    return allTypes.filter((t) => matchesSearch(t, normalizedSearch))
  }, [allTypes, normalizedSearch])

  // Grouped by family for the default view
  const groupedDefaults = useMemo(() => {
    if (normalizedSearch) return null
    const groups: Record<string, InformationType[]> = {}
    for (const type of displayedTypes) {
      if (!groups[type.family]) groups[type.family] = []
      groups[type.family].push(type)
    }
    return groups
  }, [displayedTypes, normalizedSearch])

  const orderedFamilies = useMemo(() => {
    if (!groupedDefaults) return []
    const known = FAMILY_ORDER.filter((f) => groupedDefaults[f])
    const rest = Object.keys(groupedDefaults).filter((f) => !FAMILY_ORDER.includes(f))
    return [...known, ...rest]
  }, [groupedDefaults])

  const completion = useMemo(() => {
    const completeItems = [
      draft.selectedInformationTypeIds.length > 0,
      Boolean(draft.impactJustification.trim()),
      Boolean(draft.objectiveJustification.trim()),
      draft.confirmedImpactLevel === calculatedImpact.overall,
    ].filter(Boolean).length
    return Math.round((completeItems / 4) * 100)
  }, [calculatedImpact.overall, draft])

  const saveStep1 = useMutation({
    mutationFn: async () => {
      const payload = buildStep1Payload(draft, calculatedImpact, selectedTypes)
      localStorage.setItem(getStorageKey(project.id), JSON.stringify(payload))
      return projectsApi.saveStep1(project.id, payload) as Promise<SavedStep1>
    },
    onSuccess: (savedStep) => {
      queryClient.setQueryData(queryKeys.projects.detail(project.id), (current: ProjectWithStep1Data | undefined) => {
        if (!current) return current
        const rmfSteps = current.rmfSteps ?? []
        const nextStepData = savedStep.data ?? buildStep1Payload(draft, calculatedImpact, selectedTypes)
        const hasStep1 = rmfSteps.some((step) => step.stepNumber === 1)
        return {
          ...current,
          impactLevel: draft.confirmedImpactLevel,
          rmfSteps: hasStep1
            ? rmfSteps.map((step) =>
                step.stepNumber === 1
                  ? { ...step, ...savedStep, status: savedStep.status ?? step.status, data: nextStepData }
                  : step,
              )
            : [...rmfSteps, { ...savedStep, stepNumber: 1, status: savedStep.status ?? 'IN_PROGRESS', data: nextStepData }],
        }
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('STEP 1 CATEGORIZATION SAVED')
    },
    onError: () => toast.error('STEP 1 SAVE FAILED'),
  })

  function toggleInformationType(id: string) {
    setDraft((current) => {
      const isSelected = current.selectedInformationTypeIds.includes(id)
      return {
        ...current,
        selectedInformationTypeIds: isSelected
          ? current.selectedInformationTypeIds.filter((tid) => tid !== id)
          : [...current.selectedInformationTypeIds, id],
      }
    })
  }

  const isSearching = normalizedSearch.length > 0
  const catalogSize = fullCatalog.length

  return (
    <WizardShell
      project={project}
      activeStep={1}
      title="Step 1: Categorize"
      actions={
        <button
          type="button"
          onClick={() => saveStep1.mutate()}
          disabled={saveStep1.isPending}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveStep1.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saveStep1.isPending ? 'SAVING...' : 'SAVE CATEGORIZATION'}
        </button>
      }
    >
      <div className="space-y-5">
        {/* ── Header row ── */}
        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
          <div className="rmf-card active p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="hud-label text-slate-600">FIPS 199 READINESS</p>
                <h3 className="font-mono text-lg text-slate-100 mt-1">Security Categorization</h3>
              </div>
              <Target size={22} className="text-cyan-neon" />
            </div>
            <div className="mt-5 h-2 rounded-full bg-space-elevated overflow-hidden">
              <div className="progress-glow-bar h-2 rounded-full" style={{ width: `${completion}%` }} />
            </div>
            <p className="hud-label text-slate-600 mt-3">{completion}% STEP 1 COMPLETION</p>
          </div>

          <div className="rmf-card p-5">
            <p className="hud-label text-slate-600">AUTO IMPACT</p>
            <p
              className={`font-mono text-2xl font-bold mt-2 ${
                calculatedImpact.overall === 'HIGH'
                  ? 'text-red-alert'
                  : calculatedImpact.overall === 'MODERATE'
                    ? 'text-yellow-400'
                    : 'text-green-matrix'
              }`}
            >
              {calculatedImpact.overall}
            </p>
            <p className="text-xs text-slate-500 mt-3 leading-5">
              Highest-watermark impact from selected NIST 800-60 information types.
            </p>
          </div>
        </section>

        {/* ── Main two-column ── */}
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] gap-5">
          {/* ── Left: catalog ── */}
          <div className="rmf-card p-5">
            <div className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-cyan-neon" />
                <h3 className="font-mono text-base text-slate-100">NIST 800-60 INFORMATION TYPES</h3>
              </div>
              {catalogQuery.isFetching && <Loader2 size={14} className="animate-spin text-cyan-neon" />}
            </div>

            {/* Catalog context line */}
            <p className="text-xs text-slate-500 mb-4">
              {isSearching
                ? catalogSize > 0
                  ? `Searching ${catalogSize.toLocaleString()} catalog entries — ${displayedTypes.length} match`
                  : `Searching curated list — ${displayedTypes.length} match`
                : `Showing ${CURATED_TYPES.length} recommended defaults · Search to browse full catalog`}
              {catalogQuery.isError && (
                <span className="ml-2 text-yellow-400">(catalog unavailable — curated list shown)</span>
              )}
            </p>

            {/* Search bar */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-hud pl-9 pr-8"
                placeholder="Search types, families, or descriptions…"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Type list */}
            <div className="max-h-[560px] overflow-y-auto pr-1 space-y-1">
              {isSearching ? (
                // ── Flat search results ──────────────────────────────────
                displayedTypes.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="hud-label text-slate-600">NO RESULTS</p>
                    <p className="text-xs text-slate-600 mt-2">Try a different search term.</p>
                  </div>
                ) : (
                  displayedTypes.map((type) => (
                    <TypeCard
                      key={type.id}
                      type={type}
                      selected={draft.selectedInformationTypeIds.includes(type.id)}
                      onToggle={() => toggleInformationType(type.id)}
                    />
                  ))
                )
              ) : (
                // ── Grouped default view ─────────────────────────────────
                orderedFamilies.map((family) => (
                  <div key={family} className="mb-4">
                    <div className="flex items-center gap-2 mb-2 py-1 border-b border-slate-700/50">
                      <span className="hud-label text-cyan-neon/70" style={{ fontSize: 9 }}>
                        {family.toUpperCase()}
                      </span>
                      <span className="hud-label text-slate-600" style={{ fontSize: 9 }}>
                        {groupedDefaults![family].length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {groupedDefaults![family].map((type) => (
                        <TypeCard
                          key={type.id}
                          type={type}
                          selected={draft.selectedInformationTypeIds.includes(type.id)}
                          onToggle={() => toggleInformationType(type.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right: FIPS confirmation + summary ── */}
          <div className="space-y-5">
            <section className="rmf-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert size={18} className="text-cyan-neon" />
                <h3 className="font-mono text-base text-slate-100">FIPS 199 CONFIRMATION</h3>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['LOW', 'MODERATE', 'HIGH'] as ImpactLevel[]).map((impact) => (
                  <button
                    key={impact}
                    type="button"
                    onClick={() => setDraft((c) => ({ ...c, confirmedImpactLevel: impact }))}
                    className={`rounded border px-3 py-3 font-mono text-xs transition-all ${
                      draft.confirmedImpactLevel === impact
                        ? `${getImpactClass(impact)} shadow-glow-cyan`
                        : 'border-cyan-neon/15 bg-space-elevated/30 text-slate-500 hover:border-cyan-neon/35'
                    }`}
                  >
                    {impact}
                  </button>
                ))}
              </div>

              <label htmlFor="impact-justification" className="hud-label mb-1.5 mt-5 block">
                IMPACT JUSTIFICATION
              </label>
              <textarea
                id="impact-justification"
                value={draft.impactJustification}
                onChange={(e) => setDraft((c) => ({ ...c, impactJustification: e.target.value }))}
                className="textarea-hud min-h-32"
                placeholder="Explain why the confirmed FIPS 199 impact level is appropriate for this system..."
              />

              {draft.confirmedImpactLevel !== calculatedImpact.overall && selectedTypes.length > 0 && (
                <p className="text-xs text-yellow-400 mt-3">
                  Confirmed impact differs from calculated watermark. Document the risk rationale clearly.
                </p>
              )}
            </section>

            <section className="rmf-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={18} className="text-cyan-neon" />
                <h3 className="font-mono text-base text-slate-100">SUMMARY REPORT</h3>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <SummaryMetric label="Confidentiality" value={calculatedImpact.confidentiality} />
                <SummaryMetric label="Integrity" value={calculatedImpact.integrity} />
                <SummaryMetric label="Availability" value={calculatedImpact.availability} />
              </div>

              <div className="rounded border border-cyan-neon/15 bg-space-elevated/30 p-4 mt-4">
                <p className="hud-label text-slate-600">SELECTED TYPES</p>
                <p className="font-mono text-2xl text-cyan-neon mt-2">{selectedTypes.length}</p>
                {selectedTypes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selectedTypes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        title={`Remove ${t.name}`}
                        onClick={() => toggleInformationType(t.id)}
                        className="inline-flex items-center gap-1 rounded border border-cyan-neon/20 bg-cyan-neon/5 px-2 py-0.5 font-mono text-[9px] text-cyan-neon hover:bg-cyan-neon/15 transition-colors"
                      >
                        {t.id}
                        <X size={9} />
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-3">
                  Categorization uses the high-watermark across selected types and CIA objectives.
                </p>
              </div>

              <label htmlFor="objective-justification" className="hud-label mb-1.5 mt-5 block">
                CIA OBJECTIVE NOTES
              </label>
              <textarea
                id="objective-justification"
                value={draft.objectiveJustification}
                onChange={(e) => setDraft((c) => ({ ...c, objectiveJustification: e.target.value }))}
                className="textarea-hud min-h-28"
                placeholder="Capture assumptions, overlays, mission dependencies, and any adjusted CIA rationale..."
              />
            </section>
          </div>
        </section>
      </div>
    </WizardShell>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeCard({
  type,
  selected,
  onToggle,
}: {
  type: InformationType
  selected: boolean
  onToggle: () => void
}) {
  const isCurated = CURATED_IDS.has(type.id.toLowerCase())
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded border p-3.5 text-left transition-all ${
        selected
          ? 'border-cyan-neon/45 bg-cyan-neon/10 shadow-glow-cyan'
          : 'border-cyan-neon/15 bg-space-elevated/30 hover:border-cyan-neon/35 hover:bg-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="control-id">{type.id}</span>
            {!isCurated && (
              <span className="hud-label text-slate-600 border border-slate-700/50 px-1 rounded" style={{ fontSize: 8 }}>
                CATALOG
              </span>
            )}
          </div>
          <p className="font-mono text-sm text-slate-100 mt-1.5">{type.name}</p>
          <p className="text-xs text-slate-500 leading-5 mt-1">{type.description}</p>
        </div>
        {selected && <CheckCircle2 size={16} className="text-green-matrix flex-shrink-0 mt-0.5" />}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <ImpactPill label="C" impact={type.confidentiality} />
        <ImpactPill label="I" impact={type.integrity} />
        <ImpactPill label="A" impact={type.availability} />
      </div>
    </button>
  )
}

function ImpactPill({ label, impact }: { label: string; impact: ImpactScore }) {
  const cls =
    impact === 'HIGH'
      ? 'text-red-alert border-red-alert/30 bg-red-alert/10'
      : impact === 'MODERATE'
        ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
        : 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
  return (
    <span className={`rounded border px-2 py-1 text-center font-mono text-[10px] ${cls}`}>
      {label}: {impact}
    </span>
  )
}

function SummaryMetric({ label, value }: { label: string; value: ImpactScore }) {
  const cls =
    value === 'HIGH'
      ? 'text-red-alert border-red-alert/30 bg-red-alert/10'
      : value === 'MODERATE'
        ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
        : 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
  return (
    <div className={`rounded border p-3 ${cls}`}>
      <p className="hud-label text-current opacity-80">{label}</p>
      <p className="font-mono text-sm font-bold mt-2">{value}</p>
    </div>
  )
}
