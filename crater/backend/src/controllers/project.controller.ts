import { Request, Response, NextFunction } from 'express'
import { ProjectService } from '../services/project.service'
import { RmfStepService } from '../services/rmf-step.service'
import { DiagramService } from '../services/diagram.service'
import { SspService } from '../services/ssp.service'
import { PoamService } from '../services/poam.service'
import { ArtifactService } from '../services/artifact.service'
import { InventoryService } from '../services/inventory.service'
import { PpsmService } from '../services/ppsm.service'
import { PackageService } from '../services/package.service'
import { StigImportService } from '../services/stig-import.service'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import type { AuthRequest } from '../middleware/auth'

const projectService = new ProjectService()
const stepService = new RmfStepService()
const diagramService = new DiagramService()
const sspService = new SspService()
const poamService = new PoamService()
const artifactService = new ArtifactService()
const inventoryService = new InventoryService()
const ppsmService = new PpsmService()
const packageService = new PackageService()
const stigImportService = new StigImportService()

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projects = await projectService.list(req.user!.id, req.user!.role)
    res.json(projects)
  } catch (err) {
    next(err)
  }
}

export async function getProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.findById(req.params.id, req.user!.id, req.user!.role)
    res.json(project)
  } catch (err) {
    next(err)
  }
}

export async function createProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  console.log('[createProject] body=%j user=%s', req.body, req.user?.id)
  try {
    const project = await projectService.create(req.body, req.user!.id)
    res.status(201).json(project)
  } catch (err) {
    console.error('[createProject] failed', err)
    next(err)
  }
}

export async function updateProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.update(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    )
    res.json(project)
  } catch (err) {
    next(err)
  }
}

export async function deleteProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.delete(req.params.id, req.user!.id, req.user!.role)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ─── RMF Steps ────────────────────────────────────────────────────────────────

export async function saveStep0(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const step = await stepService.updateStep0(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    )
    res.json(step)
  } catch (err) {
    next(err)
  }
}

export async function saveStep1(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const step = await stepService.updateStep1(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    )
    res.json(step)
  } catch (err) {
    next(err)
  }
}

export async function saveStep2(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const step = await stepService.updateStep2(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    )
    res.json(step)
  } catch (err) {
    next(err)
  }
}

export async function saveStep3(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const step = await stepService.updateStep3(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    )
    res.json(step)
  } catch (err) {
    next(err)
  }
}

export async function saveStep4(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const step = await stepService.updateStep4(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    )
    res.json(step)
  } catch (err) {
    next(err)
  }
}

export async function importStigChecklist(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file
    if (!file) throw new AppError('No checklist file received. Send a .ckl or XCCDF XML file using the "file" field.', 400)

    const result = stigImportService.parse(file.buffer, file.originalname)
    const step = await prisma.rMFStep.findUnique({
      where: { projectId_stepNumber: { projectId: req.params.id, stepNumber: 4 } },
    })
    const existing = (step?.data ?? {}) as {
      findings?: unknown[]
      evidenceDiagramIds?: string[]
      testResults?: string
      assessmentSummary?: string
    }
    const existingFindings = normalizeFindings(existing.findings)
    const existingIds = new Set(existingFindings.map((finding) => finding.id))
    const importedFindings = result.findings.filter((finding) => !existingIds.has(finding.id))
    const findings = [...existingFindings, ...importedFindings]

    const updatedStep = await stepService.updateStep4(
      req.params.id,
      {
        findings,
        evidenceDiagramIds: existing.evidenceDiagramIds,
        testResults: existing.testResults,
        assessmentSummary: existing.assessmentSummary,
        summary: buildStep4Summary(findings),
      },
      req.user!.id,
      req.user!.role,
    )

    res.status(201).json({
      sourceType: result.sourceType,
      sourceName: result.sourceName,
      parsedCount: result.parsedCount,
      skippedCount: result.skippedCount,
      importedCount: importedFindings.length,
      duplicateCount: result.findings.length - importedFindings.length,
      findings,
      step: updatedStep,
    })
  } catch (err) {
    next(err)
  }
}

export async function saveStep5(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const step = await stepService.updateStep5(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    )
    res.json(step)
  } catch (err) {
    next(err)
  }
}

export async function saveStep6(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const step = await stepService.updateStep6(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    )
    res.json(step)
  } catch (err) {
    next(err)
  }
}

type Step4Finding = {
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

function normalizeFindings(value: unknown): Step4Finding[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Step4Finding => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.controlId === 'string' && typeof record.description === 'string'
  })
}

function buildStep4Summary(findings: Step4Finding[]) {
  return {
    total: findings.length,
    open: findings.filter((finding) => finding.status === 'OPEN' || finding.status === 'IN_REMEDIATION').length,
    criticalHigh: findings.filter((finding) => finding.severity === 'CRITICAL' || finding.severity === 'HIGH').length,
    closed: findings.filter((finding) => finding.status === 'CLOSED').length,
  }
}

// ─── Controls ────────────────────────────────────────────────────────────────

export async function listControls(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const controls = await prisma.control.findMany({
      where: {
        controlId: { contains: '-' },
      },
      orderBy: [{ family: 'asc' }, { controlId: 'asc' }],
    })

    res.json(controls)
  } catch (err) {
    next(err)
  }
}

// ─── SSP ──────────────────────────────────────────────────────────────────────

export async function generateSsp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const includeDiagrams = req.query.includeDiagrams !== 'false'
    const { buffer, filename } = await sspService.generate(
      req.params.id,
      req.user!.id,
      req.user!.role,
      { includeDiagrams },
    )

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function generateRmfPackage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { buffer, filename } = await packageService.generate(req.params.id, req.user!.id, req.user!.role)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

// ─── Artifacts ───────────────────────────────────────────────────────────────

export async function listArtifacts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const artifacts = await artifactService.list(req.params.id, req.user!.id, req.user!.role)
    res.json(artifacts)
  } catch (err) {
    next(err)
  }
}

export async function uploadArtifacts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined
    if (!files?.length) throw new AppError('No files received. Send files using the "files" field.', 400)

    const artifacts = await artifactService.upload(req.params.id, files, req.body, req.user!.id, req.user!.role)
    res.status(201).json(artifacts)
  } catch (err) {
    next(err)
  }
}

export async function updateArtifact(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const artifact = await artifactService.update(req.params.id, req.params.artifactId, req.body, req.user!.id, req.user!.role)
    res.json(artifact)
  } catch (err) {
    next(err)
  }
}

export async function deleteArtifact(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await artifactService.delete(req.params.id, req.params.artifactId, req.user!.id, req.user!.role)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export async function listInventoryItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await inventoryService.list(req.params.id, req.user!.id, req.user!.role)
    res.json(items)
  } catch (err) {
    next(err)
  }
}

export async function createInventoryItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await inventoryService.create(req.params.id, req.body, req.user!.id, req.user!.role)
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
}

export async function updateInventoryItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await inventoryService.update(req.params.id, req.params.inventoryItemId, req.body, req.user!.id, req.user!.role)
    res.json(item)
  } catch (err) {
    next(err)
  }
}

export async function deleteInventoryItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await inventoryService.delete(req.params.id, req.params.inventoryItemId, req.user!.id, req.user!.role)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ─── PPSM ───────────────────────────────────────────────────────────────────

export async function listPpsmEntries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await ppsmService.list(req.params.id, req.user!.id, req.user!.role)
    res.json(entries)
  } catch (err) {
    next(err)
  }
}

export async function createPpsmEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await ppsmService.create(req.params.id, req.body, req.user!.id, req.user!.role)
    res.status(201).json(entry)
  } catch (err) {
    next(err)
  }
}

export async function updatePpsmEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await ppsmService.update(req.params.id, req.params.ppsmEntryId, req.body, req.user!.id, req.user!.role)
    res.json(entry)
  } catch (err) {
    next(err)
  }
}

export async function deletePpsmEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await ppsmService.delete(req.params.id, req.params.ppsmEntryId, req.user!.id, req.user!.role)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ─── POA&M ───────────────────────────────────────────────────────────────────

export async function listPoamItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await poamService.list(req.params.id, req.user!.id, req.user!.role)
    res.json(items)
  } catch (err) {
    next(err)
  }
}

export async function createPoamItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await poamService.create(req.params.id, req.body, req.user!.id, req.user!.role)
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
}

export async function updatePoamItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await poamService.update(req.params.id, req.params.poamId, req.body, req.user!.id, req.user!.role)
    res.json(item)
  } catch (err) {
    next(err)
  }
}

export async function deletePoamItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await poamService.delete(req.params.id, req.params.poamId, req.user!.id, req.user!.role)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ─── Diagrams ─────────────────────────────────────────────────────────────────

export async function listDiagrams(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const diagrams = await diagramService.listForProject(
      req.params.id,
      req.user!.id,
      req.user!.role,
    )
    res.json(diagrams)
  } catch (err) {
    next(err)
  }
}

export async function uploadDiagrams(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined

    if (!files?.length) {
      throw new AppError(
        'No files received. Send files using the "files" field in a multipart/form-data request.',
        400,
      )
    }

    const { type, stepNumber } = req.body as { type: string; stepNumber?: number }

    const diagrams = await diagramService.upload(
      req.params.id,
      files,
      type,
      stepNumber,
      req.user!.id,
      req.user!.role,
    )

    res.status(201).json(diagrams)
  } catch (err) {
    next(err)
  }
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.findById(req.params.id, req.user!.id, req.user!.role)
    const members = await prisma.projectMember.findMany({
      where: { projectId: req.params.id },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    res.json(members)
  } catch (err) {
    next(err)
  }
}

export async function addMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: projectId } = req.params
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } })
    if (!project) throw new AppError('Project not found', 404)
    if (req.user!.role !== 'ADMIN' && project.ownerId !== req.user!.id) {
      throw new AppError('Only the project owner or an administrator can manage members', 403)
    }
    const { userId, role } = req.body as { userId: string; role: string }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) throw new AppError('User not found', 404)
    const member = await prisma.projectMember.create({
      data: { projectId, userId, role: role as import('@prisma/client').Role },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
    })
    res.status(201).json(member)
  } catch (err) {
    next(err)
  }
}

export async function updateMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: projectId, userId: targetUserId } = req.params
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } })
    if (!project) throw new AppError('Project not found', 404)
    if (req.user!.role !== 'ADMIN' && project.ownerId !== req.user!.id) {
      throw new AppError('Only the project owner or an administrator can manage members', 403)
    }
    if (project.ownerId === targetUserId) {
      throw new AppError('Cannot change the project owner\'s team role', 400)
    }
    const { role } = req.body as { role: string }
    const member = await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      data: { role: role as import('@prisma/client').Role },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
    })
    res.json(member)
  } catch (err) {
    next(err)
  }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: projectId, userId: targetUserId } = req.params
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } })
    if (!project) throw new AppError('Project not found', 404)
    if (req.user!.role !== 'ADMIN' && project.ownerId !== req.user!.id) {
      throw new AppError('Only the project owner or an administrator can manage members', 403)
    }
    if (project.ownerId === targetUserId) {
      throw new AppError('Cannot remove the project owner from the team', 400)
    }
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function getProjectAuditLog(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: projectId } = req.params
    const { action, entityType, from, to, page = '1', limit = '50' } = req.query as Record<string, string>

    await projectService.findById(projectId, req.user!.id, req.user!.role)

    const take = Math.min(100, Math.max(1, Number(limit)))
    const skip = (Math.max(1, Number(page)) - 1) * take

    const where = {
      projectId,
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...((from || to) ? { timestamp: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    }

    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
    ])

    res.json({ data, total, page: Number(page), limit: take })
  } catch (err) {
    next(err)
  }
}
