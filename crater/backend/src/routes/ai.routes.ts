import { Router } from 'express'
import { Role } from '@prisma/client'
import {
  explainControl,
  generateAssessmentFindings,
  generateDocument,
  generateImplementation,
  generateImplementationStream,
  generateMonitoringReport,
  generatePoamSuggestions,
  generatePolicy,
  generateProcedure,
  generateRiskAcceptanceLetter,
  generateRiskRationale,
  tailorControls,
} from '../controllers/ai.controller'
import { authenticate, requireRole } from '../middleware/auth'
import { validate } from '../middleware/validate'
import {
  aiExplainControlSchema,
  aiGenerateAssessmentFindingsSchema,
  aiGenerateFormalDocumentSchema,
  aiGenerateImplementationSchema,
  aiGenerateMonitoringReportSchema,
  aiGeneratePoamSuggestionsSchema,
  aiGeneratePolicySchema,
  aiGenerateProcedureSchema,
  aiGenerateRiskAcceptanceLetterSchema,
  aiGenerateRiskRationaleSchema,
  aiTailorControlsSchema,
} from '../utils/schemas'

const router = Router()

router.use(authenticate)

// POST /api/ai/generate-implementation
// Uses only local/offline model endpoints such as Ollama or llama.cpp-compatible hosts.
router.post(
  '/generate-implementation',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(aiGenerateImplementationSchema),
  generateImplementation,
)

// POST /api/ai/generate-implementation-stream
// Streaming SSE version — yields tokens as they are generated then a final done event.
router.post(
  '/generate-implementation-stream',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(aiGenerateImplementationSchema),
  generateImplementationStream,
)

// POST /api/ai/explain-control
// Explains applicability, risk rationale, tailoring, and expected evidence for a control.
router.post(
  '/explain-control',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA, Role.AO, Role.DAO),
  validate(aiExplainControlSchema),
  explainControl,
)

// POST /api/ai/tailor-controls
// Produces risk-based Step 2 add/remove/inherit recommendations for human review.
router.post(
  '/tailor-controls',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(aiTailorControlsSchema),
  tailorControls,
)

// POST /api/ai/generate-poam-suggestions
// Produces POA&M items for not/partially implemented controls using project context.
router.post(
  '/generate-poam-suggestions',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(aiGeneratePoamSuggestionsSchema),
  generatePoamSuggestions,
)

// POST /api/ai/generate-assessment-findings
// Produces Step 4 assessment findings from implementation gaps and best practices.
router.post(
  '/generate-assessment-findings',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(aiGenerateAssessmentFindingsSchema),
  generateAssessmentFindings,
)

// POST /api/ai/generate-risk-rationale
// Produces a draft AO risk decision rationale from project context (all steps + findings).
router.post(
  '/generate-risk-rationale',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA, Role.AO, Role.DAO),
  validate(aiGenerateRiskRationaleSchema),
  generateRiskRationale,
)

// POST /api/ai/generate-monitoring-report
// Produces a Step 6 continuous monitoring report from implementation, findings, and POA&M posture.
router.post(
  '/generate-monitoring-report',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA, Role.AO, Role.DAO),
  validate(aiGenerateMonitoringReportSchema),
  generateMonitoringReport,
)

// POST /api/ai/generate-policy
// Produces formal RMF/JSIG/DCSA-ready policy language from project, controls, best practices, and RAG chunks.
router.post(
  '/generate-policy',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA, Role.AO, Role.DAO),
  validate(aiGeneratePolicySchema),
  generatePolicy,
)

// POST /api/ai/generate-procedure
// Produces operational RMF/JSIG procedure language with roles, steps, evidence, and review cadence.
router.post(
  '/generate-procedure',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA, Role.AO, Role.DAO),
  validate(aiGenerateProcedureSchema),
  generateProcedure,
)

// POST /api/ai/generate-risk-acceptance-letter
// Produces formal risk acceptance correspondence grounded in RMF evidence and residual risk posture.
router.post(
  '/generate-risk-acceptance-letter',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA, Role.AO, Role.DAO),
  validate(aiGenerateRiskAcceptanceLetterSchema),
  generateRiskAcceptanceLetter,
)

// POST /api/ai/generate-document
// General dispatcher for specialized document modes: POLICY, PROCEDURE, RISK_ACCEPTANCE_LETTER, MONITORING_REPORT.
router.post(
  '/generate-document',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA, Role.AO, Role.DAO),
  validate(aiGenerateFormalDocumentSchema),
  generateDocument,
)

export default router
