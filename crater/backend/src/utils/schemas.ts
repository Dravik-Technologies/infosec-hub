import { z } from 'zod'
import {
  ArtifactType,
  ConMonEventStatus,
  ConMonEventType,
  ConMonRecurrence,
  ImpactLevel,
  InventoryApprovalStatus,
  InventoryItemType,
  POAMStatus,
  PPSMApprovalStatus,
  PPSMDirection,
  PPSMProtocol,
  ProjectStatus,
  Role,
  Severity,
} from '@prisma/client'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// ─── Projects ────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  description: z.string().max(2000).optional(),
  impactLevel: z.nativeEnum(ImpactLevel).default('LOW'),
  authBoundary: z.string().max(2000).optional(),
})

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(2000).optional(),
    impactLevel: z.nativeEnum(ImpactLevel).optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    authBoundary: z.string().max(2000).optional(),
    atoExpiry: z.string().datetime({ message: 'Must be ISO 8601 datetime' }).optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

// ─── RMF Steps ───────────────────────────────────────────────────────────────

// Step 0 — PREPARE
// Matches Step0Draft in the frontend wizard. All fields optional (PATCH semantics).
export const step0Schema = z.object({
  roles: z
    .object({
      systemOwner: z.string().max(100).trim().optional(),
      isse: z.string().max(100).trim().optional(),
      isso: z.string().max(100).trim().optional(),
      issm: z.string().max(100).trim().optional(),
      scaScar: z.string().max(100).trim().optional(),
      aoDao: z.string().max(100).trim().optional(),
      // Legacy keys retained so older browser drafts remain saveable.
      rmfPractitioner: z.string().max(100).trim().optional(),
      authorizingOfficial: z.string().max(100).trim().optional(),
    })
    .optional(),
  riskTolerance: z.string().max(5000).trim().optional(),
  organizationalContext: z.string().max(5000).trim().optional(),
  // Synced back to project.authBoundary in the same transaction
  boundaryConfirmation: z.string().max(5000).trim().optional(),
  // Diagram metadata only — actual files uploaded via POST /api/projects/:id/diagrams
  diagrams: z
    .array(
      z.object({
        id: z.string(),
        type: z.string().max(50),
        name: z.string().max(255),
        size: z.number().int().nonnegative(),
        previewUrl: z.string().max(2000),
      }),
    )
    .optional(),
})

// Step 1 — CATEGORIZE (FIPS 199 / NIST SP 800-60)
// Matches Step1Draft + the calculatedImpact and selectedInformationTypes that the
// wizard appends to the payload before saving. All fields optional (PATCH semantics).
const impactScoreSchema = z.enum(['LOW', 'MODERATE', 'HIGH'])

export const step1Schema = z.object({
  // The user's explicit FIPS 199 decision — synced to project.impactLevel
  confirmedImpactLevel: z.nativeEnum(ImpactLevel).optional(),
  impactJustification: z.string().max(5000).trim().optional(),
  // NIST 800-60 information type identifiers (e.g. "c.2.1.1")
  selectedInformationTypeIds: z.array(z.string().max(30)).optional(),
  objectiveJustification: z.string().max(5000).trim().optional(),
  // High-watermark CIA impact computed client-side from the selected types
  calculatedImpact: z
    .object({
      confidentiality: impactScoreSchema,
      integrity: impactScoreSchema,
      availability: impactScoreSchema,
      overall: impactScoreSchema,
    })
    .optional(),
  // Full information type objects — redundant with IDs but included in the
  // frontend payload; stored so the step data is self-contained for reporting
  selectedInformationTypes: z
    .array(
      z.object({
        id: z.string().max(30),
        name: z.string().max(200),
        family: z.string().max(100),
        description: z.string().max(1000),
        confidentiality: impactScoreSchema,
        integrity: impactScoreSchema,
        availability: impactScoreSchema,
      }),
    )
    .optional(),
})

// Step 2 — SELECT (NIST SP 800-53 control baseline and tailoring)
// Stores the control selection payload in RMFStep.data. The selected controls
// can later be promoted into ControlInstance rows during implementation work.
const tailoringActionSchema = z.enum(['BASELINE', 'ADDED', 'REMOVED'])

export const step2Schema = z.object({
  impactLevel: z.nativeEnum(ImpactLevel).optional(),
  jsigOverlay: z.boolean().optional(),
  selectedControlIds: z.array(z.string().max(30)).optional(),
  baselineControlIds: z.array(z.string().max(30)).optional(),
  overlayControlIds: z.array(z.string().max(30)).optional(),
  tailoring: z
    .record(
      z.object({
        action: tailoringActionSchema,
        justification: z.string().max(5000).trim().optional().default(''),
        inherited: z.boolean().optional().default(false),
        inheritedFrom: z.string().max(200).trim().optional().default(''),
      }),
    )
    .optional(),
  selectedControls: z
    .array(
      z.object({
        controlId: z.string().max(30),
        action: tailoringActionSchema,
        inherited: z.boolean().optional().default(false),
        inheritedFrom: z.string().max(200).trim().optional(),
        justification: z.string().max(5000).trim().optional(),
      }),
    )
    .optional(),
  removedControls: z
    .array(
      z.object({
        controlId: z.string().max(30),
        justification: z.string().max(5000).trim().optional().default(''),
      }),
    )
    .optional(),
  summary: z
    .object({
      baseline: z.number().int().nonnegative(),
      selected: z.number().int().nonnegative(),
      added: z.number().int().nonnegative(),
      removed: z.number().int().nonnegative(),
      inherited: z.number().int().nonnegative(),
      jsig: z.number().int().nonnegative().optional(),
    })
    .optional(),
  notes: z.string().max(5000).trim().optional(),
})

// Step 3 — IMPLEMENT (NIST SP 800-53 control implementation)
// Per-control implementation data stored as a keyed map in RMFStep.data.
// All fields are optional (PATCH semantics); the service merges on top of existing data.
const implementationStatusSchema = z.enum([
  'NOT_IMPLEMENTED',
  'PLANNED',
  'PARTIALLY_IMPLEMENTED',
  'IMPLEMENTED',
  'NOT_APPLICABLE',
])

export const step3Schema = z.object({
  // Map of controlId → implementation record (e.g. { 'AC-2': { status: 'IMPLEMENTED', ... } })
  implementations: z
    .record(
      z.object({
        status: implementationStatusSchema.optional(),
        // Narrative describing how the control is implemented.
        // `implementationStatement` is retained for compatibility with the frontend draft model;
        // `statement` is the canonical backend/reporting name.
        implementationStatement: z.string().max(10000).trim().optional(),
        statement: z.string().max(10000).trim().optional(),
        // Whether the control is satisfied by an inherited/common control provider
        inherited: z.boolean().optional(),
        inheritedFrom: z.string().max(200).trim().optional(),
        // Party or system component responsible for implementing this control
        responsible: z.string().max(200).trim().optional(),
        evidenceNotes: z.string().max(2000).trim().optional(),
        aiGenerated: z.boolean().optional(),
        aiGeneratedAt: z.string().datetime().optional(),
        // Evidence artifacts associated with this control (metadata only; files uploaded separately)
        evidence: z
          .array(
            z.object({
              name: z.string().max(255),
              description: z.string().max(1000).optional(),
              url: z.string().max(2000).optional(),
              uploadedAt: z.string().datetime().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  // Rolled-up counts computed client-side for display (not authoritative).
  // All fields are optional — the frontend shape evolves independently of the backend.
  summary: z
    .object({
      total: z.number().int().nonnegative().optional(),
      implemented: z.number().int().nonnegative().optional(),
      inProgress: z.number().int().nonnegative().optional(),
      partial: z.number().int().nonnegative().optional(),
      planned: z.number().int().nonnegative().optional(),
      notStarted: z.number().int().nonnegative().optional(),
      notApplicable: z.number().int().nonnegative().optional(),
      inherited: z.number().int().nonnegative().optional(),
      documented: z.number().int().nonnegative().optional(),
      percent: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  notes: z.string().max(5000).trim().optional(),
})

// Step 4 — ASSESS (findings, evidence, and test results)

const findingSeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MODERATE', 'LOW'])
const findingStatusSchema = z.enum(['OPEN', 'IN_REMEDIATION', 'CLOSED', 'RISK_ACCEPTED'])

export const step4Schema = z.object({
  findings: z
    .array(
      z.object({
        id: z.string().max(80),
        controlId: z.string().max(30),
        description: z.string().min(1).max(5000),
        severity: findingSeveritySchema,
        status: findingStatusSchema,
        evidence: z.string().max(3000).optional(),
        recommendation: z.string().max(5000).optional(),
        poamItemId: z.string().cuid().optional(),
        aiGenerated: z.boolean().optional(),
        aiGeneratedAt: z.string().datetime().optional(),
      }),
    )
    .optional(),
  evidenceDiagramIds: z.array(z.string().cuid()).optional(),
  testResults: z.string().max(10000).trim().optional(),
  assessmentSummary: z.string().max(10000).trim().optional(),
  summary: z
    .object({
      total: z.number().int().nonnegative().optional(),
      open: z.number().int().nonnegative().optional(),
      criticalHigh: z.number().int().nonnegative().optional(),
      closed: z.number().int().nonnegative().optional(),
    })
    .optional(),
})

// Step 5 — AUTHORIZE (Risk Decision and ATO Package)
// Stores the AO's authorization decision, rationale, conditions, signature block,
// and ATO package generation metadata. PATCH semantics — all fields optional.
export const step5Schema = z.object({
  residualRisk: z.string().max(5000).trim().optional(),
  riskAcceptanceRationale: z.string().max(5000).trim().optional(),
  decision: z.enum(['APPROVE', 'DENY', 'CONDITIONAL']).optional(),
  decisionDate: z.string().datetime({ message: 'Must be ISO 8601 datetime' }).optional(),
  decisionRationale: z.string().max(10000).trim().optional(),
  conditions: z.string().max(5000).trim().optional(),
  atoExpiryDate: z.string().datetime({ message: 'Must be ISO 8601 datetime' }).optional(),
  signatures: z
    .object({
      ao: z.string().max(200).trim().optional(),
      aoDate: z.string().datetime().optional(),
      dao: z.string().max(200).trim().optional(),
      daoDate: z.string().datetime().optional(),
      isso: z.string().max(200).trim().optional(),
      issoDate: z.string().datetime().optional(),
    })
    .optional(),
  packageGenerated: z.boolean().optional(),
  packageGeneratedAt: z.string().datetime().optional(),
  notes: z.string().max(5000).trim().optional(),
})

// Step 6 — MONITOR (Continuous Monitoring)
// Stores ongoing authorization maintenance data, recurring task reminders,
// current risk metrics, and the latest monitoring report narrative.
export const step6Schema = z.object({
  monitoringStatus: z.enum(['ON_TRACK', 'WATCH', 'AT_RISK']).optional(),
  lastReviewDate: z.string().datetime({ message: 'Must be ISO 8601 datetime' }).optional(),
  nextReviewDate: z.string().datetime({ message: 'Must be ISO 8601 datetime' }).optional(),
  cadence: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL']).optional(),
  recurringTasks: z
    .array(
      z.object({
        id: z.string().max(80),
        title: z.string().min(1).max(200).trim(),
        owner: z.string().max(120).trim().optional(),
        dueDate: z.string().datetime().optional(),
        status: z.enum(['OPEN', 'DUE_SOON', 'OVERDUE', 'COMPLETE']).optional(),
      }),
    )
    .optional(),
  complianceScore: z.number().int().min(0).max(100).optional(),
  riskTrend: z.enum(['IMPROVING', 'STABLE', 'DEGRADING']).optional(),
  riskMetrics: z
    .object({
      implementationPercent: z.number().int().min(0).max(100).optional(),
      openPoams: z.number().int().nonnegative().optional(),
      overduePoams: z.number().int().nonnegative().optional(),
      openFindings: z.number().int().nonnegative().optional(),
      criticalHighItems: z.number().int().nonnegative().optional(),
      evidenceItems: z.number().int().nonnegative().optional(),
    })
    .optional(),
  monitoringReport: z.string().max(15000).trim().optional(),
  reportGeneratedAt: z.string().datetime().optional(),
  aiGenerated: z.boolean().optional(),
  notes: z.string().max(5000).trim().optional(),
})

// ─── Diagram upload ───────────────────────────────────────────────────────────
// Validates non-file form fields sent alongside a multipart/form-data upload.
// `type` is the diagram type label from the frontend (e.g. "Network", "Data Flow").
// `stepNumber` links the diagram to a specific RMF step (0–6).
export const uploadDiagramSchema = z.object({
  type: z.string().min(1, 'Diagram type is required').max(50),
  // FormData always sends strings; coerce to number for the service
  stepNumber: z.coerce.number().int().min(0).max(6).optional(),
})

export const uploadArtifactSchema = z.object({
  type: z.nativeEnum(ArtifactType).default('OTHER'),
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  tags: z
    .preprocess((value) => {
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean)
      }
      return []
    }, z.array(z.string().max(60)).max(20))
    .optional(),
  stepNumber: z.coerce.number().int().min(0).max(6).optional(),
  controlId: z.string().max(30).trim().optional(),
  poamItemId: z.string().cuid().optional(),
})

export const updateArtifactSchema = z.object({
  type: z.nativeEnum(ArtifactType).optional(),
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  stepNumber: z.number().int().min(0).max(6).nullable().optional(),
  controlId: z.string().max(30).trim().nullable().optional(),
  poamItemId: z.string().cuid().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})

// ─── Hardware / Software Inventory ───────────────────────────────────────────

export const createInventoryItemSchema = z.object({
  item: z.string().min(1, 'Item is required').max(255).trim(),
  itemType: z.nativeEnum(InventoryItemType),
  modelVersion: z.string().max(255).trim().optional(),
  location: z.string().max(255).trim().optional(),
  classification: z.string().max(100).trim().optional(),
  approvalStatus: z.nativeEnum(InventoryApprovalStatus).optional(),
  notes: z.string().max(2000).trim().optional(),
})

export const updateInventoryItemSchema = createInventoryItemSchema.partial().refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})

// ─── PPSM ────────────────────────────────────────────────────────────────────

export const createPpsmEntrySchema = z.object({
  port: z.string().min(1, 'Port is required').max(30).trim(),
  protocol: z.nativeEnum(PPSMProtocol),
  direction: z.nativeEnum(PPSMDirection),
  serviceApplication: z.string().min(1, 'Service/application is required').max(255).trim(),
  justification: z.string().max(5000).trim().optional(),
  approvalStatus: z.nativeEnum(PPSMApprovalStatus).optional(),
})

export const updatePpsmEntrySchema = createPpsmEntrySchema.partial().refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})

// ─── POA&M ───────────────────────────────────────────────────────────────────

export const createPoamItemSchema = z.object({
  controlId: z.string().max(30).trim().optional(),
  weakness: z.string().min(3, 'Weakness is required').max(2000).trim(),
  description: z.string().max(5000).trim().optional(),
  severity: z.nativeEnum(Severity),
  status: z.nativeEnum(POAMStatus).optional(),
  scheduledCompletion: z.string().datetime().optional(),
  milestonesWithDates: z.string().max(5000).trim().optional(),
  resources: z.string().max(2000).trim().optional(),
  cost: z.number().nonnegative().optional(),
})

export const updatePoamItemSchema = createPoamItemSchema.partial().refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})

// ─── Project Members ─────────────────────────────────────────────────────────

export const addMemberSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  role: z.nativeEnum(Role),
})

export const updateMemberSchema = z.object({
  role: z.nativeEnum(Role),
})

export type AddMemberDto = z.infer<typeof addMemberSchema>
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>

// ─── ConMon Events ────────────────────────────────────────────────────────────

export const createConMonEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  eventType: z.nativeEnum(ConMonEventType),
  dueDate: z.string().datetime({ message: 'Must be ISO 8601 datetime' }),
  recurrence: z.nativeEnum(ConMonRecurrence).optional(),
  controlId: z.string().max(30).trim().optional(),
  poamItemId: z.string().cuid().optional(),
  assignedTo: z.string().max(200).trim().optional(),
})

export const updateConMonEventSchema = createConMonEventSchema.partial().extend({
  status: z.nativeEnum(ConMonEventStatus).optional(),
  completedAt: z.string().datetime().nullable().optional(),
})

export type CreateConMonEventDto = z.infer<typeof createConMonEventSchema>
export type UpdateConMonEventDto = z.infer<typeof updateConMonEventSchema>

// ─── Local AI generation ─────────────────────────────────────────────────────

export const aiGenerateImplementationSchema = z.object({
  controlId: z.string().min(2).max(30).trim(),
  projectId: z.string().cuid().optional(),
  purpose: z
    .enum(['IMPLEMENTATION_STATEMENT', 'JSIG_SAP_ENHANCEMENT', 'TAILORING_SUGGESTION'])
    .optional(),
  systemContext: z.string().max(5000).trim().optional(),
  impactLevel: z.nativeEnum(ImpactLevel).optional(),
  inherited: z.boolean().optional(),
  inheritedFrom: z.string().max(200).trim().optional(),
  extraInstructions: z.string().max(3000).trim().optional(),
  temperature: z.number().min(0).max(1).optional(),
})

export const aiExplainControlSchema = z.object({
  controlId: z.string().min(2).max(30).trim(),
  projectId: z.string().cuid().optional(),
  impactLevel: z.nativeEnum(ImpactLevel).optional(),
  jsigOverlay: z.boolean().optional(),
  systemContext: z.string().max(5000).trim().optional(),
  extraInstructions: z.string().max(3000).trim().optional(),
  temperature: z.number().min(0).max(1).optional(),
})

export const aiTailorControlsSchema = z.object({
  projectId: z.string().cuid(),
  impactLevel: z.nativeEnum(ImpactLevel).optional(),
  jsigOverlay: z.boolean().optional(),
  selectedControlIds: z.array(z.string().max(30)).optional(),
  baselineControlIds: z.array(z.string().max(30)).optional(),
  overlayControlIds: z.array(z.string().max(30)).optional(),
  tailoring: z
    .record(
      z.object({
        action: tailoringActionSchema.optional(),
        justification: z.string().max(5000).trim().optional(),
        inherited: z.boolean().optional(),
        inheritedFrom: z.string().max(200).trim().optional(),
      }),
    )
    .optional(),
  systemContext: z.string().max(5000).trim().optional(),
})

export const aiGeneratePoamSuggestionsSchema = z.object({
  projectId: z.string().cuid(),
  maxSuggestions: z.number().int().min(1).max(25).optional(),
})

export const aiGenerateAssessmentFindingsSchema = z.object({
  projectId: z.string().cuid(),
  maxFindings: z.number().int().min(1).max(25).optional(),
})

export const aiGenerateRiskRationaleSchema = z.object({
  projectId: z.string().cuid(),
  decisionType: z.enum(['APPROVE', 'DENY', 'CONDITIONAL']).optional(),
  systemContext: z.string().max(5000).trim().optional(),
  temperature: z.number().min(0).max(1).optional(),
})

export const aiGenerateMonitoringReportSchema = z.object({
  projectId: z.string().cuid(),
  temperature: z.number().min(0).max(1).optional(),
})

export const aiGenerateFormalDocumentSchema = z.object({
  projectId: z.string().cuid().optional(),
  mode: z.enum(['POLICY', 'PROCEDURE', 'RISK_ACCEPTANCE_LETTER', 'MONITORING_REPORT']).optional(),
  title: z.string().max(200).trim().optional(),
  topic: z.string().max(300).trim().optional(),
  controlIds: z.array(z.string().min(2).max(30).trim()).max(25).optional(),
  impactLevel: z.nativeEnum(ImpactLevel).optional(),
  jsigOverlay: z.boolean().optional(),
  systemContext: z.string().max(8000).trim().optional(),
  extraInstructions: z.string().max(5000).trim().optional(),
  temperature: z.number().min(0).max(1).optional(),
})

export const aiGeneratePolicySchema = aiGenerateFormalDocumentSchema.extend({
  mode: z.literal('POLICY').optional(),
})

export const aiGenerateProcedureSchema = aiGenerateFormalDocumentSchema.extend({
  mode: z.literal('PROCEDURE').optional(),
})

export const aiGenerateRiskAcceptanceLetterSchema = aiGenerateFormalDocumentSchema.extend({
  mode: z.literal('RISK_ACCEPTANCE_LETTER').optional(),
})

// ─── Inferred types ──────────────────────────────────────────────────────────

export type RegisterDto = z.infer<typeof registerSchema>
export type LoginDto = z.infer<typeof loginSchema>
export type CreateProjectDto = z.infer<typeof createProjectSchema>
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>
export type Step0Dto = z.infer<typeof step0Schema>
export type Step1Dto = z.infer<typeof step1Schema>
export type Step2Dto = z.infer<typeof step2Schema>
export type Step3Dto = z.infer<typeof step3Schema>
export type Step4Dto = z.infer<typeof step4Schema>
export type Step5Dto = z.infer<typeof step5Schema>
export type Step6Dto = z.infer<typeof step6Schema>
export type UploadDiagramDto = z.infer<typeof uploadDiagramSchema>
export type UploadArtifactDto = z.infer<typeof uploadArtifactSchema>
export type UpdateArtifactDto = z.infer<typeof updateArtifactSchema>
export type CreateInventoryItemDto = z.infer<typeof createInventoryItemSchema>
export type UpdateInventoryItemDto = z.infer<typeof updateInventoryItemSchema>
export type CreatePpsmEntryDto = z.infer<typeof createPpsmEntrySchema>
export type UpdatePpsmEntryDto = z.infer<typeof updatePpsmEntrySchema>
export type CreatePoamItemDto = z.infer<typeof createPoamItemSchema>
export type UpdatePoamItemDto = z.infer<typeof updatePoamItemSchema>
export type AiGenerateImplementationDto = z.infer<typeof aiGenerateImplementationSchema>
export type AiExplainControlDto = z.infer<typeof aiExplainControlSchema>
export type AiTailorControlsDto = z.infer<typeof aiTailorControlsSchema>
export type AiGeneratePoamSuggestionsDto = z.infer<typeof aiGeneratePoamSuggestionsSchema>
export type AiGenerateAssessmentFindingsDto = z.infer<typeof aiGenerateAssessmentFindingsSchema>
export type AiGenerateRiskRationaleDto = z.infer<typeof aiGenerateRiskRationaleSchema>
export type AiGenerateMonitoringReportDto = z.infer<typeof aiGenerateMonitoringReportSchema>
export type AiGenerateFormalDocumentDto = z.infer<typeof aiGenerateFormalDocumentSchema>
export type AiGeneratePolicyDto = z.infer<typeof aiGeneratePolicySchema>
export type AiGenerateProcedureDto = z.infer<typeof aiGenerateProcedureSchema>
export type AiGenerateRiskAcceptanceLetterDto = z.infer<typeof aiGenerateRiskAcceptanceLetterSchema>
