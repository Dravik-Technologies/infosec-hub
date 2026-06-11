import { Router } from 'express'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  saveStep0,
  saveStep1,
  saveStep2,
  saveStep3,
  saveStep4,
  importStigChecklist,
  saveStep5,
  saveStep6,
  uploadDiagrams,
  listDiagrams,
  generateSsp,
  generateRmfPackage,
  listArtifacts,
  uploadArtifacts,
  updateArtifact,
  deleteArtifact,
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  listPpsmEntries,
  createPpsmEntry,
  updatePpsmEntry,
  deletePpsmEntry,
  listPoamItems,
  createPoamItem,
  updatePoamItem,
  deletePoamItem,
  getProjectAuditLog,
  listMembers,
  addMember,
  updateMember,
  removeMember,
} from '../controllers/project.controller'
import {
  listConMonEvents,
  listUpcomingConMonEvents,
  createConMonEvent,
  updateConMonEvent,
  deleteConMonEvent,
  completeConMonEvent,
} from '../controllers/conmon.controller'
import { authenticate, requireRole } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { auditLog } from '../middleware/audit'
import { diagramUpload, handleUploadError, stigChecklistUpload } from '../middleware/upload'
import { artifactUpload } from '../middleware/upload'
import {
  createProjectSchema,
  updateProjectSchema,
  step0Schema,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  uploadDiagramSchema,
  uploadArtifactSchema,
  updateArtifactSchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  createPpsmEntrySchema,
  updatePpsmEntrySchema,
  createPoamItemSchema,
  updatePoamItemSchema,
  addMemberSchema,
  updateMemberSchema,
  createConMonEventSchema,
  updateConMonEventSchema,
} from '../utils/schemas'
import { Role } from '@prisma/client'

const router = Router()

// All project routes require authentication
router.use(authenticate)

// ─── Project CRUD ─────────────────────────────────────────────────────────────

// GET  /api/projects
router.get('/', listProjects)

// GET  /api/projects/:id
router.get('/:id', getProject)

// POST /api/projects
router.post(
  '/',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  validate(createProjectSchema),
  auditLog('CREATE', 'project'),
  createProject,
)

// PATCH /api/projects/:id
// Route-level gate: must hold a write-capable system role.
// Service enforces the additional constraint that non-admins must be project members.
router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  validate(updateProjectSchema),
  auditLog('UPDATE', 'project'),
  updateProject,
)

// DELETE /api/projects/:id
// Route-level gate: must hold a write-capable system role.
// Service enforces that non-admins must be the project owner.
router.delete(
  '/:id',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  auditLog('DELETE', 'project'),
  deleteProject,
)

// ─── RMF Step routes ──────────────────────────────────────────────────────────
// Fine-grained membership checks are inside the service, not at the route level.

// PATCH /api/projects/:id/steps/0 — PREPARE
router.patch(
  '/:id/steps/0',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  validate(step0Schema),
  auditLog('UPDATE', 'rmf_step'),
  saveStep0,
)

// PATCH /api/projects/:id/steps/1 — CATEGORIZE
// Also syncs project.impactLevel when confirmedImpactLevel is provided.
router.patch(
  '/:id/steps/1',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  validate(step1Schema),
  auditLog('UPDATE', 'rmf_step'),
  saveStep1,
)

// PATCH /api/projects/:id/steps/2 — SELECT
// Stores selected baseline controls, tailoring decisions, and justifications.
router.patch(
  '/:id/steps/2',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  validate(step2Schema),
  auditLog('UPDATE', 'rmf_step'),
  saveStep2,
)

// PATCH /api/projects/:id/steps/3 — IMPLEMENT
// Stores per-control implementation status, statements, inheritance, and evidence metadata.
// The implementations map is deep-merged at the per-control level (partial saves are safe).
router.patch(
  '/:id/steps/3',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  validate(step3Schema),
  auditLog('UPDATE', 'rmf_step'),
  saveStep3,
)

// PATCH /api/projects/:id/steps/4 — ASSESS
// Stores assessment findings, evidence references, test results, and summary.
router.patch(
  '/:id/steps/4',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(step4Schema),
  auditLog('UPDATE', 'rmf_step'),
  saveStep4,
)

router.post(
  '/:id/steps/4/import-stig',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  stigChecklistUpload.single('file'),
  handleUploadError,
  auditLog('IMPORT', 'stig_checklist'),
  importStigChecklist,
)

// PATCH /api/projects/:id/steps/5 — AUTHORIZE
// AO, DAO, and write-role members can record the authorization decision, rationale,
// conditions, signature block, and ATO package status.
router.patch(
  '/:id/steps/5',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.AO, Role.DAO),
  validate(step5Schema),
  auditLog('UPDATE', 'rmf_step'),
  saveStep5,
)

// PATCH /api/projects/:id/steps/6 — MONITOR
// Stores continuous monitoring cadence, recurring task reminders, metrics, and latest monitoring report.
router.patch(
  '/:id/steps/6',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(step6Schema),
  auditLog('UPDATE', 'rmf_step'),
  saveStep6,
)

// ─── SSP route ────────────────────────────────────────────────────────────────

// GET /api/projects/:id/ssp
// Returns a generated .docx SSP. Any authenticated project member may download it.
// Must be declared before /:id/diagrams so Express does not match "ssp" as a diagram sub-path.
router.get(
  '/:id/ssp',
  auditLog('GENERATE', 'ssp'),
  generateSsp,
)

router.get(
  '/:id/package',
  auditLog('GENERATE', 'rmf_package'),
  generateRmfPackage,
)

// ─── Artifact routes ────────────────────────────────────────────────────────

router.get('/:id/artifacts', listArtifacts)

router.post(
  '/:id/artifacts',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  artifactUpload.array('files', 10),
  handleUploadError,
  validate(uploadArtifactSchema),
  auditLog('CREATE', 'artifact'),
  uploadArtifacts,
)

router.patch(
  '/:id/artifacts/:artifactId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(updateArtifactSchema),
  auditLog('UPDATE', 'artifact'),
  updateArtifact,
)

router.delete(
  '/:id/artifacts/:artifactId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  auditLog('DELETE', 'artifact'),
  deleteArtifact,
)

// ─── Hardware / Software Inventory routes ───────────────────────────────────

router.get('/:id/inventory', listInventoryItems)

router.post(
  '/:id/inventory',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(createInventoryItemSchema),
  auditLog('CREATE', 'inventory_item'),
  createInventoryItem,
)

router.patch(
  '/:id/inventory/:inventoryItemId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(updateInventoryItemSchema),
  auditLog('UPDATE', 'inventory_item'),
  updateInventoryItem,
)

router.delete(
  '/:id/inventory/:inventoryItemId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  auditLog('DELETE', 'inventory_item'),
  deleteInventoryItem,
)

// ─── PPSM routes ─────────────────────────────────────────────────────────────

router.get('/:id/ppsm', listPpsmEntries)

router.post(
  '/:id/ppsm',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(createPpsmEntrySchema),
  auditLog('CREATE', 'ppsm_entry'),
  createPpsmEntry,
)

router.patch(
  '/:id/ppsm/:ppsmEntryId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(updatePpsmEntrySchema),
  auditLog('UPDATE', 'ppsm_entry'),
  updatePpsmEntry,
)

router.delete(
  '/:id/ppsm/:ppsmEntryId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  auditLog('DELETE', 'ppsm_entry'),
  deletePpsmEntry,
)

// ─── POA&M routes ────────────────────────────────────────────────────────────

router.get('/:id/poam', listPoamItems)

router.post(
  '/:id/poam',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(createPoamItemSchema),
  auditLog('CREATE', 'poam_item'),
  createPoamItem,
)

router.patch(
  '/:id/poam/:poamId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  validate(updatePoamItemSchema),
  auditLog('UPDATE', 'poam_item'),
  updatePoamItem,
)

router.delete(
  '/:id/poam/:poamId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  auditLog('DELETE', 'poam_item'),
  deletePoamItem,
)

// ─── Member routes ────────────────────────────────────────────────────────────

router.get('/:id/members', listMembers)

router.post(
  '/:id/members',
  validate(addMemberSchema),
  auditLog('CREATE', 'project_member'),
  addMember,
)

router.patch(
  '/:id/members/:userId',
  validate(updateMemberSchema),
  auditLog('UPDATE', 'project_member'),
  updateMember,
)

router.delete(
  '/:id/members/:userId',
  auditLog('DELETE', 'project_member'),
  removeMember,
)

// ─── ConMon routes ────────────────────────────────────────────────────────────

router.get('/:id/conmon', listConMonEvents)
router.get('/:id/conmon/upcoming', listUpcomingConMonEvents)

router.post(
  '/:id/conmon',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  validate(createConMonEventSchema),
  auditLog('CREATE', 'conmon_event'),
  createConMonEvent,
)

router.patch(
  '/:id/conmon/:conmonEventId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  validate(updateConMonEventSchema),
  auditLog('UPDATE', 'conmon_event'),
  updateConMonEvent,
)

router.delete(
  '/:id/conmon/:conmonEventId',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  auditLog('DELETE', 'conmon_event'),
  deleteConMonEvent,
)

router.post(
  '/:id/conmon/:conmonEventId/complete',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  auditLog('UPDATE', 'conmon_event'),
  completeConMonEvent,
)

// ─── Audit Log route ─────────────────────────────────────────────────────────

// GET /api/projects/:id/audit
router.get('/:id/audit', getProjectAuditLog)

// ─── Diagram routes ───────────────────────────────────────────────────────────

// GET /api/projects/:id/diagrams
router.get('/:id/diagrams', listDiagrams)

// POST /api/projects/:id/diagrams
// Accepts multipart/form-data with:
//   files      — one or more image/PDF files (field name: "files")
//   type       — diagram type string ("Network", "Boundary", "Data Flow", "Rack", "Architecture")
//   stepNumber — optional 0–6, links the diagram to an RMF step
//
// Middleware order is deliberate:
//   1. requireRole      — reject non-write roles before touching the filesystem
//   2. diagramUpload    — parse multipart, write files to disk, populate req.files + req.body
//   3. handleUploadError — convert MulterErrors → AppErrors before further middleware runs
//   4. validate         — Zod-validate the non-file form fields in req.body
//   5. auditLog         — register finish-event listener (non-blocking)
//   6. uploadDiagrams   — controller
router.post(
  '/:id/diagrams',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA),
  diagramUpload.array('files', 10),
  handleUploadError,
  validate(uploadDiagramSchema),
  auditLog('CREATE', 'diagram'),
  uploadDiagrams,
)

export default router
