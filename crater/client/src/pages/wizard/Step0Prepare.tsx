import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Building2,
  CloudUpload,
  FileImage,
  Loader2,
  Network,
  Save,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi, usersApi, resolveApiAssetUrl, type DiagramRecord, type PlatformUser, type Step0Dto } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import DiagramGallery, { type GalleryDiagram } from '@/components/diagrams/DiagramGallery'
import WizardShell from '@/components/layout/WizardShell'
import type { Project } from '@/types/project'

const UNASSIGNED = 'Unassigned'
const DIAGRAM_TYPES = ['Network', 'Boundary', 'Rack', 'Data Flow'] as const

const SYSTEM_ROLE_FIELDS = [
  {
    key: 'systemOwner',
    label: 'SYSTEM OWNER',
    hint: 'Mission owner accountable for the system.',
    roleHints: ['SYSTEM_OWNER'],
  },
  {
    key: 'isse',
    label: 'ISSE',
    hint: 'Security engineer supporting implementation.',
    roleHints: ['ISSE'],
  },
  {
    key: 'isso',
    label: 'ISSO',
    hint: 'Primary RMF practitioner and security lead.',
    roleHints: ['ISSO'],
  },
  {
    key: 'issm',
    label: 'ISSM',
    hint: 'Security manager providing oversight.',
    roleHints: ['ISSM'],
  },
  {
    key: 'scaScar',
    label: 'SCA / SCAR',
    hint: 'Independent assessor or assessment representative.',
    roleHints: ['SCA'],
  },
  {
    key: 'aoDao',
    label: 'AO / DAO',
    hint: 'Authorization decision authority or delegate.',
    roleHints: ['AO', 'DAO'],
  },
] as const

type SystemRoleKey = (typeof SYSTEM_ROLE_FIELDS)[number]['key']

interface Step0PrepareProps {
  project: Project
}

interface Step0Draft {
  roles: Record<SystemRoleKey, string>
  riskTolerance: string
  organizationalContext: string
  boundaryConfirmation: string
  diagrams: DiagramMetadata[]
}

type SavedStep0Draft = Partial<Omit<Step0Draft, 'roles'>> & {
  roles?: Partial<Record<SystemRoleKey | 'rmfPractitioner' | 'authorizingOfficial', string>>
}

interface DiagramMetadata extends GalleryDiagram {
  id: string
  type: string
  name: string
  size: number
  previewUrl: string
  mimeType?: string | null
}

interface PendingDiagram extends DiagramMetadata {
  file: File
}

type ProjectWithStep0Data = Omit<Project, 'rmfSteps'> & {
  rmfSteps?: Array<{
    stepNumber: number
    data?: SavedStep0Draft | null
  }>
  diagrams?: DiagramRecord[]
  owner?: {
    id?: string
    firstName?: string | null
    lastName?: string | null
    email?: string | null
  } | null
  members?: Array<{
    role?: string
    user?: {
      id?: string
      firstName?: string | null
      lastName?: string | null
      email?: string | null
      role?: string
    }
  }>
}

function getStorageKey(projectId: string) {
  return `crater-step-0-prepare:${projectId}`
}

function createDefaultDraft(project: Project): Step0Draft {
  return {
    roles: createDefaultRoleAssignments(),
    riskTolerance: '',
    organizationalContext: '',
    boundaryConfirmation: project.authBoundary ?? '',
    diagrams: [],
  }
}

function normalizeDiagram(diagram: Partial<DiagramMetadata>): DiagramMetadata | null {
  if (!diagram.id || !diagram.name || !diagram.type || !diagram.previewUrl) return null
  if (diagram.previewUrl.startsWith('blob:')) return null

  return {
    id: diagram.id,
    type: diagram.type,
    name: diagram.name,
    size: diagram.size ?? 0,
    previewUrl: resolveApiAssetUrl(diagram.previewUrl),
  }
}

function isDiagramMetadata(diagram: DiagramMetadata | null): diagram is DiagramMetadata {
  return diagram !== null
}

function platformUserName(user: PlatformUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
}

function getSuggestedPersonFromUsers(users: PlatformUser[], roleHints: readonly string[]): string {
  const match = users.find((u) => roleHints.includes(u.role))
  return match ? platformUserName(match) : UNASSIGNED
}

function getPersonOptionsFromUsers(users: PlatformUser[], selectedValue: string): string[] {
  const names = users.map(platformUserName)
  const options = [UNASSIGNED, ...names]
  if (selectedValue && selectedValue !== UNASSIGNED && !options.includes(selectedValue)) {
    options.push(selectedValue)
  }
  return options
}

function createDefaultRoleAssignments(): Step0Draft['roles'] {
  // Returns UNASSIGNED for all roles; platform users auto-fill via useEffect once loaded.
  return SYSTEM_ROLE_FIELDS.reduce((roles, field) => {
    roles[field.key] = UNASSIGNED
    return roles
  }, {} as Step0Draft['roles'])
}

function isBackendRoleValue(value: string | undefined) {
  return Boolean(value && /^[A-Z_]+$/.test(value))
}

function normalizeDraft(project: Project, draft?: SavedStep0Draft | null): Step0Draft {
  const fallback = createDefaultDraft(project)
  const draftRoles = draft?.roles ?? {}

  function resolveRole(value: string | undefined): string {
    if (!value || value === UNASSIGNED || isBackendRoleValue(value)) return UNASSIGNED
    return value
  }

  return {
    ...fallback,
    ...draft,
    roles: {
      systemOwner: resolveRole(draftRoles.systemOwner),
      isse: resolveRole(draftRoles.isse),
      isso: resolveRole(draftRoles.isso ?? draftRoles.rmfPractitioner),
      issm: resolveRole(draftRoles.issm),
      scaScar: resolveRole(draftRoles.scaScar),
      aoDao: resolveRole(draftRoles.aoDao ?? draftRoles.authorizingOfficial),
    },
    diagrams: draft?.diagrams?.map(normalizeDiagram).filter(isDiagramMetadata) ?? fallback.diagrams,
  }
}

function getBackendStep0Data(project: Project) {
  return (project as ProjectWithStep0Data).rmfSteps?.find((step) => step.stepNumber === 0)?.data ?? null
}

function getBackendDiagramMetadata(project: Project): DiagramMetadata[] {
  return ((project as ProjectWithStep0Data).diagrams ?? []).map((diagram) => ({
    id: diagram.id,
    type: diagram.type,
    name: diagram.fileName || diagram.title,
    size: diagram.fileSize ?? 0,
    previewUrl: resolveApiAssetUrl(diagram.fileUrl),
    mimeType: diagram.mimeType,
  }))
}

function readCachedDraft(project: Project): Step0Draft | null {
  const raw = localStorage.getItem(getStorageKey(project.id))
  if (!raw) return null

  try {
    return normalizeDraft(project, JSON.parse(raw) as SavedStep0Draft)
  } catch {
    localStorage.removeItem(getStorageKey(project.id))
    return null
  }
}

function getInitialDraft(project: Project): Step0Draft {
  const backendData = getBackendStep0Data(project)
  if (backendData) return normalizeDraft(project, backendData)

  return readCachedDraft(project) ?? createDefaultDraft(project)
}

function mergeDiagrams(...groups: DiagramMetadata[][]) {
  const byId = new Map<string, DiagramMetadata>()
  groups.flat().forEach((diagram) => byId.set(diagram.id, diagram))
  return Array.from(byId.values())
}

function buildStep0Payload(draft: Step0Draft, diagrams: DiagramMetadata[]): Step0Dto {
  return {
    roles: draft.roles,
    riskTolerance: draft.riskTolerance.trim(),
    organizationalContext: draft.organizationalContext.trim(),
    boundaryConfirmation: draft.boundaryConfirmation.trim(),
    diagrams,
  }
}

function cacheFallbackDraft(project: Project, payload: Step0Dto) {
  localStorage.setItem(getStorageKey(project.id), JSON.stringify(normalizeDraft(project, payload)))
}


async function uploadPendingDiagrams(projectId: string, pendingDiagrams: PendingDiagram[]) {
  if (pendingDiagrams.length === 0) return []

  const grouped = pendingDiagrams.reduce<Record<string, PendingDiagram[]>>((acc, diagram) => {
    acc[diagram.type] = [...(acc[diagram.type] ?? []), diagram]
    return acc
  }, {})

  const uploads = await Promise.all(
    Object.entries(grouped).map(([type, diagrams]) => {
      const formData = new FormData()
      formData.append('type', type)
      formData.append('stepNumber', '0')
      diagrams.forEach((diagram) => formData.append('files', diagram.file))
      return projectsApi.uploadDiagrams(projectId, formData)
    }),
  )

  return uploads.flat().map((diagram) => ({
    id: diagram.id,
    type: diagram.type,
    name: diagram.fileName || diagram.title,
    size: diagram.fileSize ?? 0,
    previewUrl: resolveApiAssetUrl(diagram.fileUrl),
    mimeType: diagram.mimeType,
  }))
}

export default function Step0Prepare({ project }: Step0PrepareProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Step0Draft>(() => getInitialDraft(project))
  const [pendingDiagrams, setPendingDiagrams] = useState<PendingDiagram[]>([])
  const [diagramType, setDiagramType] = useState<(typeof DIAGRAM_TYPES)[number]>('Network')
  const [isDragging, setIsDragging] = useState(false)

  const { data: platformUsers = [] } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: usersApi.listAll,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    setDraft(getInitialDraft(project))
  }, [project])

  // Auto-fill UNASSIGNED roles once platform users load
  useEffect(() => {
    if (platformUsers.length === 0) return
    setDraft((current) => {
      const updatedRoles = { ...current.roles }
      let changed = false
      SYSTEM_ROLE_FIELDS.forEach((field) => {
        if (updatedRoles[field.key] === UNASSIGNED) {
          const suggested = getSuggestedPersonFromUsers(platformUsers, field.roleHints)
          if (suggested !== UNASSIGNED) {
            updatedRoles[field.key] = suggested
            changed = true
          }
        }
      })
      return changed ? { ...current, roles: updatedRoles } : current
    })
  }, [platformUsers])

  useEffect(() => {
    return () => {
      pendingDiagrams.forEach((diagram) => URL.revokeObjectURL(diagram.previewUrl))
    }
  }, [pendingDiagrams])

  const savedDiagrams = useMemo(
    () => mergeDiagrams(getBackendDiagramMetadata(project), draft.diagrams),
    [draft.diagrams, project],
  )

  const completion = useMemo(() => {
    const assignedRoles = Object.values(draft.roles).filter((role) => role !== UNASSIGNED).length
    const completedItems = [
      assignedRoles >= 3,
      Boolean(draft.riskTolerance.trim()),
      Boolean(draft.organizationalContext.trim()),
      Boolean(draft.boundaryConfirmation.trim()),
      savedDiagrams.length > 0 || pendingDiagrams.length > 0,
    ].filter(Boolean).length

    return Math.round((completedItems / 5) * 100)
  }, [draft, pendingDiagrams.length, savedDiagrams.length])

  const saveStep0 = useMutation({
    mutationFn: async () => {
      const uploadedDiagrams = await uploadPendingDiagrams(project.id, pendingDiagrams)
      const nextSavedDiagrams = mergeDiagrams(savedDiagrams, uploadedDiagrams)
      const payload = buildStep0Payload(draft, nextSavedDiagrams)

      cacheFallbackDraft(project, payload)
      const savedStep = await projectsApi.saveStep0(project.id, payload)

      pendingDiagrams.forEach((diagram) => URL.revokeObjectURL(diagram.previewUrl))
      setPendingDiagrams([])
      setDraft(normalizeDraft(project, payload))

      return savedStep
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('STEP 0 PREPARE SAVED')
    },
    onError: () => {
      toast.error('STEP 0 SAVE FAILED — LOCAL DRAFT RETAINED')
    },
  })

  function updateRole(role: SystemRoleKey, value: string) {
    setDraft((current) => ({
      ...current,
      roles: { ...current.roles, [role]: value },
    }))
  }

  function addFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      toast.error('UPLOAD IMAGE DIAGRAMS ONLY')
      return
    }

    setPendingDiagrams((current) => [
      ...current,
      ...imageFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        type: diagramType,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type,
        file,
      })),
    ])
  }

  function removePendingDiagram(id: string) {
    setPendingDiagrams((current) => {
      const removed = current.find((diagram) => diagram.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((diagram) => diagram.id !== id)
    })
  }

  const saveLabel = saveStep0.isPending
    ? pendingDiagrams.length > 0
      ? 'UPLOADING + SAVING...'
      : 'SAVING...'
    : 'SAVE PREPARE'

  return (
    <WizardShell
      project={project}
      activeStep={0}
      title="Step 0: Prepare"
      actions={
        <button
          type="button"
          onClick={() => saveStep0.mutate()}
          disabled={saveStep0.isPending}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveStep0.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saveLabel}
        </button>
      }
    >
      <div className="space-y-5">
        {saveStep0.isError && (
          <div className="rounded border border-red-alert/30 bg-red-alert/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={17} className="text-red-alert mt-0.5" />
              <div>
                <p className="hud-label text-red-alert">SAVE FAILED</p>
                <p className="text-sm text-slate-400 mt-1">
                  Your text and diagram metadata were kept in this browser. Check the backend connection and save again.
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-5">
          <div className="rmf-card active p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="hud-label text-slate-600">PREPARE READINESS</p>
                <h3 className="font-mono text-lg text-slate-100 mt-1">Mission Context And Governance</h3>
              </div>
              <ShieldCheck size={22} className="text-cyan-neon" />
            </div>
            <div className="mt-5 h-2 rounded-full bg-space-elevated overflow-hidden">
              <div className="progress-glow-bar h-2 rounded-full" style={{ width: `${completion}%` }} />
            </div>
            <p className="hud-label text-slate-600 mt-3">{completion}% STEP 0 COMPLETION</p>
          </div>

          <div className="rmf-card p-5">
            <p className="hud-label text-slate-600">SYSTEM</p>
            <p className="font-mono text-sm text-slate-100 mt-2">{project.name}</p>
            <p className="text-xs text-slate-500 mt-3 leading-5">
              Confirm roles, context, authorization boundary, and core diagrams before categorization begins.
            </p>
          </div>
        </section>

        <section className="rmf-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <UserCog size={18} className="text-cyan-neon" />
            <h3 className="font-mono text-base text-slate-100">SYSTEM ROLES</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {SYSTEM_ROLE_FIELDS.map((field) => (
              <RoleSelect
                key={field.key}
                label={field.label}
                hint={field.hint}
                value={draft.roles[field.key]}
                options={getPersonOptionsFromUsers(platformUsers, draft.roles[field.key])}
                onChange={(value) => updateRole(field.key, value)}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="rmf-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={18} className="text-cyan-neon" />
              <h3 className="font-mono text-base text-slate-100">ORGANIZATIONAL CONTEXT</h3>
            </div>

            <label htmlFor="risk-tolerance" className="hud-label mb-1.5 block">RISK TOLERANCE</label>
            <textarea
              id="risk-tolerance"
              className="textarea-hud min-h-28"
              value={draft.riskTolerance}
              onChange={(event) => setDraft((current) => ({ ...current, riskTolerance: event.target.value }))}
              placeholder="Describe risk appetite, mission constraints, legal obligations, and escalation thresholds..."
            />

            <label htmlFor="org-context" className="hud-label mb-1.5 mt-4 block">MISSION / ORGANIZATIONAL CONTEXT</label>
            <textarea
              id="org-context"
              className="textarea-hud min-h-32"
              value={draft.organizationalContext}
              onChange={(event) => setDraft((current) => ({ ...current, organizationalContext: event.target.value }))}
              placeholder="Capture stakeholders, operating environment, mission criticality, dependencies, and assumptions..."
            />
          </div>

          <div className="rmf-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Network size={18} className="text-cyan-neon" />
              <h3 className="font-mono text-base text-slate-100">AUTHORIZATION BOUNDARY</h3>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              This value is pre-filled from the system profile and saved back to the project record.
            </p>

            <label htmlFor="boundary-confirmation" className="hud-label mb-1.5 block">CONFIRMED BOUNDARY</label>
            <textarea
              id="boundary-confirmation"
              className="textarea-hud min-h-72"
              value={draft.boundaryConfirmation}
              onChange={(event) => setDraft((current) => ({ ...current, boundaryConfirmation: event.target.value }))}
              placeholder="Define included components, external interfaces, cloud services, users, data flows, and excluded systems..."
            />
          </div>
        </section>

        <section className="rmf-card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
            <div>
              <p className="hud-label text-slate-600">DIAGRAM INTAKE</p>
              <h3 className="font-mono text-base text-slate-100 mt-1">ARCHITECTURE EVIDENCE</h3>
            </div>
            <select
              value={diagramType}
              onChange={(event) => setDiagramType(event.target.value as typeof diagramType)}
              className="select-hud lg:w-56"
            >
              {DIAGRAM_TYPES.map((type) => (
                <option key={type} value={type}>{type} Diagram</option>
              ))}
            </select>
          </div>

          <div
            className={`rounded border border-dashed p-8 text-center transition-all ${
              isDragging
                ? 'border-cyan-neon bg-cyan-neon/10 shadow-glow-cyan'
                : 'border-cyan-neon/25 bg-space-elevated/30 hover:border-cyan-neon/45'
            }`}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              addFiles(event.dataTransfer.files)
            }}
          >
            <CloudUpload size={34} className="text-cyan-neon mx-auto" />
            <p className="font-mono text-sm text-slate-100 mt-4">DROP DIAGRAMS HERE</p>
            <p className="text-sm text-slate-500 mt-2">Network, boundary, rack, and data-flow images are supported.</p>
            <label className="btn-secondary inline-flex items-center justify-center gap-2 mt-5 cursor-pointer">
              <FileImage size={15} />
              BROWSE FILES
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
          </div>

          <div className="mt-5">
            <DiagramGallery
              savedDiagrams={savedDiagrams}
              pendingDiagrams={pendingDiagrams}
              onRemovePending={removePendingDiagram}
            />
          </div>
        </section>
      </div>
    </WizardShell>
  )
}

function RoleSelect({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string
  hint: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="hud-label mb-1.5 block">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="select-hud">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <p className="mt-2 text-xs text-slate-600">{hint}</p>
    </div>
  )
}
