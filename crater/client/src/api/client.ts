import axios from 'axios'
import type { AuthResponse, User } from '@/types/auth'
import type { CreateProjectInput, Project } from '@/types/project'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

export interface DiagramRecord {
  id: string
  projectId: string
  stepId?: string | null
  title: string
  type: string
  fileUrl: string
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  createdAt?: string
  updatedAt?: string
}

export type ArtifactType =
  | 'APPOINTMENT_LETTER'
  | 'USER_AGREEMENT'
  | 'PRIVILEGED_USER_AGREEMENT'
  | 'VULNERABILITY_SCAN'
  | 'TEMPEST_DIAGRAM'
  | 'ISA'
  | 'MOU'
  | 'TRAINING_RECORD'
  | 'OTHER'

export interface ArtifactRecord {
  id: string
  projectId: string
  stepId?: string | null
  step?: { stepNumber: number } | null
  controlId?: string | null
  poamItemId?: string | null
  uploadedById?: string | null
  uploadedBy?: { id: string; firstName: string; lastName: string; email: string } | null
  title: string
  type: ArtifactType
  description?: string | null
  tags: string[]
  fileUrl: string
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  createdAt: string
  updatedAt: string
}

export type InventoryItemType = 'HARDWARE' | 'SOFTWARE'
export type InventoryApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'RETIRED'

export interface InventoryItem {
  id: string
  projectId: string
  item: string
  itemType: InventoryItemType
  modelVersion?: string | null
  location?: string | null
  classification?: string | null
  approvalStatus: InventoryApprovalStatus
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type InventoryItemInput = {
  item: string
  itemType: InventoryItemType
  modelVersion?: string
  location?: string
  classification?: string
  approvalStatus?: InventoryApprovalStatus
  notes?: string
}

export type PpsmProtocol = 'TCP' | 'UDP' | 'ICMP'
export type PpsmDirection = 'INBOUND' | 'OUTBOUND' | 'BOTH'
export type PpsmApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'RETIRED'

export interface PpsmEntry {
  id: string
  projectId: string
  port: string
  protocol: PpsmProtocol
  direction: PpsmDirection
  serviceApplication: string
  justification?: string | null
  approvalStatus: PpsmApprovalStatus
  createdAt: string
  updatedAt: string
}

export type PpsmEntryInput = {
  port: string
  protocol: PpsmProtocol
  direction: PpsmDirection
  serviceApplication: string
  justification?: string
  approvalStatus?: PpsmApprovalStatus
}

export interface Step0Dto {
  roles?: Record<string, string>
  riskTolerance?: string
  organizationalContext?: string
  boundaryConfirmation?: string
  diagrams?: Array<{
    id: string
    type: string
    name: string
    size: number
    previewUrl: string
  }>
}

export interface Step1Dto {
  confirmedImpactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  impactJustification?: string
  selectedInformationTypeIds?: string[]
  objectiveJustification?: string
  calculatedImpact?: {
    confidentiality: 'LOW' | 'MODERATE' | 'HIGH'
    integrity: 'LOW' | 'MODERATE' | 'HIGH'
    availability: 'LOW' | 'MODERATE' | 'HIGH'
    overall: 'LOW' | 'MODERATE' | 'HIGH'
  }
  selectedInformationTypes?: Array<{
    id: string
    name: string
    family: string
    description: string
    confidentiality: 'LOW' | 'MODERATE' | 'HIGH'
    integrity: 'LOW' | 'MODERATE' | 'HIGH'
    availability: 'LOW' | 'MODERATE' | 'HIGH'
  }>
}

export interface Step2Dto {
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  jsigOverlay?: boolean
  selectedControlIds?: string[]
  baselineControlIds?: string[]
  overlayControlIds?: string[]
  tailoring?: Record<
    string,
    {
      action: 'BASELINE' | 'ADDED' | 'REMOVED'
      justification?: string
      inherited?: boolean
      inheritedFrom?: string
    }
  >
  selectedControls?: Array<{
    controlId: string
    action: 'BASELINE' | 'ADDED' | 'REMOVED'
    inherited?: boolean
    inheritedFrom?: string
    justification?: string
  }>
  removedControls?: Array<{
    controlId: string
    justification?: string
  }>
  summary?: {
    baseline: number
    selected: number
    added: number
    removed: number
    inherited: number
    jsig?: number
  }
  notes?: string
}

export interface Step3Dto {
  implementations?: Record<
    string,
    {
      status: 'NOT_IMPLEMENTED' | 'PLANNED' | 'PARTIALLY_IMPLEMENTED' | 'IMPLEMENTED' | 'NOT_APPLICABLE'
      statement?: string
      implementationStatement?: string
      inherited?: boolean
      inheritedFrom?: string
      evidenceNotes?: string
      aiGenerated?: boolean
      aiGeneratedAt?: string
      evidence?: Array<{
        id?: string
        title?: string
        fileName?: string
        fileUrl?: string
        type?: string
      }>
    }
  >
  summary?: {
    total: number
    implemented: number
    partial: number
    planned: number
    inherited: number
    documented: number
    percent: number
  }
  notes?: string
}

export interface AssessmentFinding {
  id: string
  controlId: string
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  status: 'OPEN' | 'IN_REMEDIATION' | 'CLOSED' | 'RISK_ACCEPTED'
  evidence?: string
  recommendation?: string
  poamItemId?: string
  aiGenerated?: boolean
  aiGeneratedAt?: string
}

export interface Step4Dto {
  findings?: AssessmentFinding[]
  evidenceDiagramIds?: string[]
  testResults?: string
  assessmentSummary?: string
  summary?: {
    total?: number
    open?: number
    criticalHigh?: number
    closed?: number
  }
}

export interface StigImportResponse {
  sourceType: 'CKL' | 'XCCDF'
  sourceName?: string
  parsedCount: number
  skippedCount: number
  importedCount: number
  duplicateCount: number
  findings: AssessmentFinding[]
}

export interface MonitoringTask {
  id: string
  title: string
  owner?: string
  dueDate?: string
  status?: 'OPEN' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETE'
}

export interface Step6Dto {
  monitoringStatus?: 'ON_TRACK' | 'WATCH' | 'AT_RISK'
  lastReviewDate?: string
  nextReviewDate?: string
  cadence?: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
  recurringTasks?: MonitoringTask[]
  complianceScore?: number
  riskTrend?: 'IMPROVING' | 'STABLE' | 'DEGRADING'
  riskMetrics?: {
    implementationPercent?: number
    openPoams?: number
    overduePoams?: number
    openFindings?: number
    criticalHighItems?: number
    evidenceItems?: number
  }
  monitoringReport?: string
  reportGeneratedAt?: string
  aiGenerated?: boolean
  notes?: string
}

export interface AiGenerateImplementationInput {
  controlId: string
  projectId?: string
  purpose?: 'IMPLEMENTATION_STATEMENT' | 'JSIG_SAP_ENHANCEMENT' | 'TAILORING_SUGGESTION'
  systemContext?: string
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  inherited?: boolean
  inheritedFrom?: string
  extraInstructions?: string
  temperature?: number
}

export interface AiGenerateImplementationResponse {
  provider: 'ollama' | 'llamacpp' | string
  model: string
  purpose: 'IMPLEMENTATION_STATEMENT' | 'JSIG_SAP_ENHANCEMENT' | 'TAILORING_SUGGESTION'
  controlId: string
  generatedText: string
  confidenceScore?: number
  citations?: AiCitation[]
  citationText?: string
  reviewNotice?: string
  fallback?: boolean
  sources?: Array<{
    controlId: string
    family: string
    title: string
  }>
  typicalEvidence?: string | null
  bestPracticeStatement?: string | null
}

export interface AiExplainControlInput {
  controlId: string
  projectId?: string
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  jsigOverlay?: boolean
  systemContext?: string
  extraInstructions?: string
  temperature?: number
}

export interface AiExplainControlResponse {
  provider: string
  model: string
  controlId: string
  explanation: string
  confidenceScore: number
  citations?: AiCitation[]
  citationText?: string
  reviewNotice?: string
  suggestedEvidenceTypes: string[]
  fallback: boolean
  sources: Array<{ controlId: string; family: string; title: string }>
  jsigContextApplied: boolean
  catalogBacked: boolean
}

export interface AiCitation {
  label: string
  sourceType: 'BEST_PRACTICE' | 'RAG_CHUNK' | 'CONTROL_CATALOG'
  docId?: string
  docTitle?: string
  section?: string
  sectionTitle?: string
  controlId?: string
}

export interface AiTailorControlsInput {
  projectId: string
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  jsigOverlay?: boolean
  selectedControlIds?: string[]
  baselineControlIds?: string[]
  overlayControlIds?: string[]
  tailoring?: Step2Dto['tailoring']
  systemContext?: string
}

export interface AiTailoringRecommendation {
  id: string
  type: 'ADD' | 'REMOVE' | 'INHERIT'
  controlId: string
  title: string
  family: string
  justification: string
  inheritedFrom?: string
  confidenceScore: number
  evidence?: string[]
}

export interface AiTailorControlsResponse {
  provider: string
  model: string
  projectId: string
  impactLevel: 'LOW' | 'MODERATE' | 'HIGH'
  jsigContextApplied: boolean
  confidenceScore: number
  citations?: AiCitation[]
  citationText?: string
  reviewNotice?: string
  summary: {
    add: number
    remove: number
    inherit: number
  }
  recommendations: AiTailoringRecommendation[]
}

export interface PoamItem {
  id: string
  projectId: string
  controlId?: string | null
  weakness: string
  description?: string | null
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  status: 'OPEN' | 'IN_REMEDIATION' | 'CLOSED' | 'RISK_ACCEPTED'
  scheduledCompletion?: string | null
  milestonesWithDates?: string | null
  resources?: string | null
  cost?: number | null
  closedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface PoamItemInput {
  controlId?: string
  weakness: string
  description?: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  status?: 'OPEN' | 'IN_REMEDIATION' | 'CLOSED' | 'RISK_ACCEPTED'
  scheduledCompletion?: string
  milestonesWithDates?: string
  resources?: string
  cost?: number
}

export interface AiPoamSuggestion {
  id: string
  weakness: string
  recommendedMitigation: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  suggestedCompletionDate: string
  relatedControlIds: string[]
  rationale: string
  source: 'AI' | 'BEST_PRACTICE' | 'DETERMINISTIC'
  confidenceScore: number
}

export interface AiPoamSuggestionsResponse {
  provider: string
  model: string
  projectId: string
  generatedAt: string
  jsigContextApplied: boolean
  analyzedControls: number
  confidenceScore?: number
  citations?: AiCitation[]
  citationText?: string
  reviewNotice?: string
  suggestions: AiPoamSuggestion[]
}

export interface AiAssessmentFinding {
  id: string
  controlId: string
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  status: 'OPEN' | 'IN_REMEDIATION'
  evidence: string
  recommendation: string
  rationale: string
  confidenceScore: number
  source: 'AI' | 'BEST_PRACTICE' | 'DETERMINISTIC'
}

export interface Step5Dto {
  residualRisk?: string
  riskAcceptanceRationale?: string
  decision?: 'APPROVE' | 'DENY' | 'CONDITIONAL'
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

export interface AiRiskRationaleInput {
  projectId: string
  decisionType?: 'APPROVE' | 'DENY' | 'CONDITIONAL'
  systemContext?: string
  temperature?: number
}

export interface AiRiskRationaleResponse {
  provider: string
  model: string
  projectId: string
  generatedAt: string
  decisionType: 'APPROVE' | 'DENY' | 'CONDITIONAL'
  generatedText: string
  confidenceScore?: number
  citations?: AiCitation[]
  citationText?: string
  reviewNotice?: string
  jsigContextApplied: boolean
  fallback: boolean
}

export interface AiAssessmentFindingsResponse {
  provider: string
  model: string
  projectId: string
  generatedAt: string
  jsigContextApplied: boolean
  analyzedControls: number
  confidenceScore?: number
  citations?: AiCitation[]
  citationText?: string
  reviewNotice?: string
  findings: AiAssessmentFinding[]
}

export interface AiMonitoringReportResponse {
  provider: string
  model: string
  projectId: string
  generatedAt: string
  report: string
  confidenceScore?: number
  citations?: AiCitation[]
  citationText?: string
  reviewNotice?: string
  recommendedActions: string[]
  complianceScore: number
  riskTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING'
  jsigContextApplied: boolean
  metrics: NonNullable<Step6Dto['riskMetrics']>
  fallback: boolean
}

export type AiFormalDocumentMode = 'POLICY' | 'PROCEDURE' | 'RISK_ACCEPTANCE_LETTER' | 'MONITORING_REPORT'

export interface AiGenerateFormalDocumentInput {
  projectId?: string
  mode?: AiFormalDocumentMode
  title?: string
  topic?: string
  controlIds?: string[]
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  jsigOverlay?: boolean
  systemContext?: string
  extraInstructions?: string
  temperature?: number
}

export interface AiGenerateFormalDocumentResponse {
  provider: string
  model: string
  mode: AiFormalDocumentMode
  projectId?: string
  generatedAt: string
  title: string
  generatedText: string
  confidenceScore: number
  citations: AiCitation[]
  citationText: string
  revision?: {
    revision: number
    previousRevisions: number
    generatedAt: string
  }
  reviewNotice: string
  fallback: boolean
  jsigContextApplied: boolean
  sources?: {
    controls: Array<{ controlId: string; family: string; title: string }>
    bestPractices: string[]
    chunks: Array<{ docId: string; section: string; sectionTitle: string }>
  }
  suggestedEvidenceTypes?: string[]
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export function resolveApiAssetUrl(fileUrl: string) {
  if (/^https?:\/\//i.test(fileUrl)) {
    const url = new URL(fileUrl)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
    return fileUrl
  }
  if (fileUrl.startsWith('/uploads/')) return fileUrl
  if (API_ORIGIN) return `${API_ORIGIN}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`
  return fileUrl
}

export function setApiAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }

  delete api.defaults.headers.common.Authorization
}

api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const raw = localStorage.getItem('crater-auth')

    if (raw) {
      const auth = JSON.parse(raw)
      const token = auth?.token ?? auth?.state?.token
      if (token) config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('crater-auth')
      window.location.href = '/login'
    }

    return Promise.reject(error)
  },
)

export const authApi = {
  register: (input: {
    firstName: string
    lastName: string
    email: string
    password: string
  }) => api.post<AuthResponse>('/auth/register', input).then((response) => response.data),
  login: (input: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', input).then((response) => response.data),
  me: () => api.get<User>('/auth/me').then((response) => response.data),
}

export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then((response) => response.data),
  create: (input: CreateProjectInput) => api.post<Project>('/projects', input).then((response) => response.data),
  detail: (id: string) => api.get<Project>(`/projects/${id}`).then((response) => response.data),
  update: (id: string, input: Partial<CreateProjectInput>) =>
    api.patch<Project>(`/projects/${id}`, input).then((response) => response.data),
  saveStep0: (id: string, input: Step0Dto) =>
    api.patch(`/projects/${id}/steps/0`, input).then((response) => response.data),
  saveStep1: (id: string, input: Step1Dto) =>
    api.patch(`/projects/${id}/steps/1`, input).then((response) => response.data),
  saveStep2: (id: string, input: Step2Dto) =>
    api.patch(`/projects/${id}/steps/2`, input).then((response) => response.data),
  saveStep3: (id: string, input: Step3Dto) =>
    api.patch(`/projects/${id}/steps/3`, input).then((response) => response.data),
  saveStep4: (id: string, input: Step4Dto) =>
    api.patch(`/projects/${id}/steps/4`, input).then((response) => response.data),
  importStigChecklist: (id: string, formData: FormData) =>
    api
      .post<StigImportResponse>(`/projects/${id}/steps/4/import-stig`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((response) => response.data),
  saveStep5: (id: string, input: Step5Dto) =>
    api.patch(`/projects/${id}/steps/5`, input).then((response) => response.data),
  saveStep6: (id: string, input: Step6Dto) =>
    api.patch(`/projects/${id}/steps/6`, input).then((response) => response.data),
  uploadDiagrams: (id: string, formData: FormData) =>
    api
      .post<DiagramRecord[]>(`/projects/${id}/diagrams`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((response) => response.data),
  listArtifacts: (id: string) => api.get<ArtifactRecord[]>(`/projects/${id}/artifacts`).then((response) => response.data),
  uploadArtifacts: (id: string, formData: FormData) =>
    api
      .post<ArtifactRecord[]>(`/projects/${id}/artifacts`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((response) => response.data),
  updateArtifact: (id: string, artifactId: string, input: Partial<Pick<ArtifactRecord, 'title' | 'type' | 'description' | 'tags' | 'controlId' | 'poamItemId'> & { stepNumber: number | null }>) =>
    api.patch<ArtifactRecord>(`/projects/${id}/artifacts/${artifactId}`, input).then((response) => response.data),
  deleteArtifact: (id: string, artifactId: string) =>
    api.delete<void>(`/projects/${id}/artifacts/${artifactId}`).then((response) => response.data),
  listInventory: (id: string) => api.get<InventoryItem[]>(`/projects/${id}/inventory`).then((response) => response.data),
  createInventoryItem: (id: string, input: InventoryItemInput) =>
    api.post<InventoryItem>(`/projects/${id}/inventory`, input).then((response) => response.data),
  updateInventoryItem: (id: string, inventoryItemId: string, input: Partial<InventoryItemInput>) =>
    api.patch<InventoryItem>(`/projects/${id}/inventory/${inventoryItemId}`, input).then((response) => response.data),
  deleteInventoryItem: (id: string, inventoryItemId: string) =>
    api.delete<void>(`/projects/${id}/inventory/${inventoryItemId}`).then((response) => response.data),
  listPpsm: (id: string) => api.get<PpsmEntry[]>(`/projects/${id}/ppsm`).then((response) => response.data),
  createPpsmEntry: (id: string, input: PpsmEntryInput) =>
    api.post<PpsmEntry>(`/projects/${id}/ppsm`, input).then((response) => response.data),
  updatePpsmEntry: (id: string, ppsmEntryId: string, input: Partial<PpsmEntryInput>) =>
    api.patch<PpsmEntry>(`/projects/${id}/ppsm/${ppsmEntryId}`, input).then((response) => response.data),
  deletePpsmEntry: (id: string, ppsmEntryId: string) =>
    api.delete<void>(`/projects/${id}/ppsm/${ppsmEntryId}`).then((response) => response.data),
  generateSsp: (id: string, includeDiagrams: boolean) =>
    api.get<Blob>(`/projects/${id}/ssp`, {
      params: { includeDiagrams },
      responseType: 'blob',
    }),
  generatePackage: (id: string) =>
    api.get<Blob>(`/projects/${id}/package`, {
      responseType: 'blob',
    }),
  listPoam: (id: string) => api.get<PoamItem[]>(`/projects/${id}/poam`).then((response) => response.data),
  createPoam: (id: string, input: PoamItemInput) =>
    api.post<PoamItem>(`/projects/${id}/poam`, input).then((response) => response.data),
  updatePoam: (id: string, poamId: string, input: Partial<PoamItemInput>) =>
    api.patch<PoamItem>(`/projects/${id}/poam/${poamId}`, input).then((response) => response.data),
  deletePoam: (id: string, poamId: string) =>
    api.delete<void>(`/projects/${id}/poam/${poamId}`).then((response) => response.data),
  remove: (id: string) => api.delete<void>(`/projects/${id}`).then((response) => response.data),
  listAuditLogs: (id: string, params?: { action?: string; entityType?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    api.get<AuditLogResponse>(`/projects/${id}/audit`, { params }).then((r) => r.data),
  listMembers: (id: string) => api.get<ProjectMember[]>(`/projects/${id}/members`).then((r) => r.data),
  addMember: (id: string, input: { userId: string; role: string }) =>
    api.post<ProjectMember>(`/projects/${id}/members`, input).then((r) => r.data),
  updateMember: (id: string, userId: string, input: { role: string }) =>
    api.patch<ProjectMember>(`/projects/${id}/members/${userId}`, input).then((r) => r.data),
  removeMember: (id: string, userId: string) =>
    api.delete<void>(`/projects/${id}/members/${userId}`).then((r) => r.data),
  listConMonEvents: (id: string, year: number, month: number) =>
    api
      .get<ConMonEvent[]>(`/projects/${id}/conmon`, { params: { year, month } })
      .then((r) => r.data),
  listUpcomingConMon: (id: string, days = 90) =>
    api
      .get<ConMonEvent[]>(`/projects/${id}/conmon/upcoming`, { params: { days } })
      .then((r) => r.data),
  createConMonEvent: (id: string, input: ConMonEventInput) =>
    api.post<ConMonEvent>(`/projects/${id}/conmon`, input).then((r) => r.data),
  updateConMonEvent: (
    id: string,
    eventId: string,
    input: Partial<ConMonEventInput & { status: ConMonEventStatus; completedAt: string | null }>,
  ) => api.patch<ConMonEvent>(`/projects/${id}/conmon/${eventId}`, input).then((r) => r.data),
  deleteConMonEvent: (id: string, eventId: string) =>
    api.delete<void>(`/projects/${id}/conmon/${eventId}`).then((r) => r.data),
  completeConMonEvent: (id: string, eventId: string) =>
    api
      .post<{ completed: boolean; nextEvent: ConMonEvent | null }>(
        `/projects/${id}/conmon/${eventId}/complete`,
      )
      .then((r) => r.data),
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: string
  joinedAt: string
  user: { id: string; email: string; firstName: string; lastName: string; role: string }
}

export type ConMonEventType =
  | 'CONTROL_ASSESSMENT'
  | 'POAM_REVIEW'
  | 'ATO_RENEWAL'
  | 'SECURITY_REVIEW'
  | 'SYSTEM_SCAN'
  | 'TRAINING'
  | 'CUSTOM'

export type ConMonEventStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'OVERDUE' | 'CANCELLED'

export type ConMonRecurrence = 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'

export interface ConMonEvent {
  id: string
  projectId: string
  title: string
  description?: string | null
  eventType: ConMonEventType
  dueDate: string
  status: ConMonEventStatus
  recurrence: ConMonRecurrence
  controlId?: string | null
  poamItemId?: string | null
  assignedTo?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ConMonEventInput {
  title: string
  description?: string
  eventType: ConMonEventType
  dueDate: string
  recurrence?: ConMonRecurrence
  controlId?: string
  poamItemId?: string
  assignedTo?: string
}

export interface AuditLogEntry {
  id: string
  userId?: string | null
  projectId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  details?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  timestamp: string
  user?: { id: string; firstName: string; lastName: string; email: string } | null
}

export interface AuditLogResponse {
  data: AuditLogEntry[]
  total: number
  page: number
  limit: number
}

export interface AiImplementationStreamDoneEvent {
  type: 'done'
  generatedText: string
  model: string
  provider: string
  fallback: boolean
  fromCache: boolean
}

export interface PlatformUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

export const usersApi = {
  listAll: () => api.get<PlatformUser[]>('/users').then((r) => r.data),
}

export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  createdAt: string
  _count: { ownedProjects: number }
}

export interface PlatformStats {
  users: {
    total: number
    active: number
    inactive: number
    byRole: Record<string, number>
  }
  projects: number
  controls: number
  openPoams: number
  config: {
    aiModel: string
    aiFastModel: string
    aiMaxTokens: number
    aiContextWindow: number
    aiMaxRagChunks: number
    aiTemperature: number
    aiProvider: string
    ollamaUrl: string
    nodeEnv: string
    port: number
  }
  version: {
    app: string
    rmfFramework: string
    nistControls: string
    jsig: string
    fips: string
    cnssi: string
  }
}

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>('/admin/users').then((r) => r.data),
  updateUser: (id: string, data: { role?: string; isActive?: boolean }) =>
    api.patch<AdminUser>(`/admin/users/${id}`, data).then((r) => r.data),
  getStats: () => api.get<PlatformStats>('/admin/stats').then((r) => r.data),
  listAuditLogs: (params?: { projectId?: string; userId?: string; action?: string; entityType?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    api.get<AuditLogResponse>('/admin/audit', { params }).then((r) => r.data),
}

export const aiApi = {
  generateImplementation: (input: AiGenerateImplementationInput) =>
    api.post<AiGenerateImplementationResponse>('/ai/generate-implementation', input).then((response) => response.data),

  streamGenerateImplementation: async (
    input: AiGenerateImplementationInput,
    callbacks: {
      onToken: (token: string) => void
      onDone: (result: AiImplementationStreamDoneEvent) => void
      signal?: AbortSignal
    },
  ): Promise<void> => {
    const raw = localStorage.getItem('crater-auth')
    const parsed = raw ? (JSON.parse(raw) as { token?: string; state?: { token?: string } }) : null
    const authToken = parsed?.token ?? parsed?.state?.token

    const response = await fetch(`${API_BASE_URL}/ai/generate-implementation-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(input),
      signal: callbacks.signal,
    })

    if (!response.ok) throw new Error(`AI stream HTTP ${response.status}`)
    if (!response.body) throw new Error('No response body from AI stream')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''

        for (const block of blocks) {
          const dataLine = block.split('\n').find((line) => line.startsWith('data: '))
          if (!dataLine) continue
          try {
            const event = JSON.parse(dataLine.slice(6)) as
              | { type: 'token'; token: string }
              | AiImplementationStreamDoneEvent
              | { type: 'error'; message: string }

            if (event.type === 'token') callbacks.onToken(event.token)
            else if (event.type === 'done') callbacks.onDone(event)
            else if (event.type === 'error') throw new Error(event.message)
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  },
  explainControl: (input: AiExplainControlInput) =>
    api.post<AiExplainControlResponse>('/ai/explain-control', input).then((response) => response.data),
  tailorControls: (input: AiTailorControlsInput) =>
    api.post<AiTailorControlsResponse>('/ai/tailor-controls', input).then((response) => response.data),
  generatePoamSuggestions: (input: { projectId: string; maxSuggestions?: number }) =>
    api.post<AiPoamSuggestionsResponse>('/ai/generate-poam-suggestions', input).then((response) => response.data),
  generateAssessmentFindings: (input: { projectId: string; maxFindings?: number }) =>
    api.post<AiAssessmentFindingsResponse>('/ai/generate-assessment-findings', input).then((response) => response.data),
  generateRiskRationale: (input: AiRiskRationaleInput) =>
    api.post<AiRiskRationaleResponse>('/ai/generate-risk-rationale', input).then((response) => response.data),
  generateMonitoringReport: (input: { projectId: string; temperature?: number }) =>
    api.post<AiMonitoringReportResponse>('/ai/generate-monitoring-report', input).then((response) => response.data),
  generatePolicy: (input: Omit<AiGenerateFormalDocumentInput, 'mode'>) =>
    api.post<AiGenerateFormalDocumentResponse>('/ai/generate-policy', input).then((response) => response.data),
  generateProcedure: (input: Omit<AiGenerateFormalDocumentInput, 'mode'>) =>
    api.post<AiGenerateFormalDocumentResponse>('/ai/generate-procedure', input).then((response) => response.data),
  generateRiskAcceptanceLetter: (input: Omit<AiGenerateFormalDocumentInput, 'mode'>) =>
    api.post<AiGenerateFormalDocumentResponse>('/ai/generate-risk-acceptance-letter', input).then((response) => response.data),
  generateDocument: (input: AiGenerateFormalDocumentInput) =>
    api.post<AiGenerateFormalDocumentResponse | AiMonitoringReportResponse>('/ai/generate-document', input).then((response) => response.data),
}
