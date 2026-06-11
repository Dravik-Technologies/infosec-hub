import { ImpactLevel, Prisma, Role, StepStatus } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import type { Step0Dto, Step1Dto, Step2Dto, Step3Dto, Step4Dto, Step5Dto, Step6Dto } from '../utils/schemas'

// Roles that can write step data for a project they are a member of.
// SCA, AO, and DAO are read-only — they assess and authorize but do not implement.
const WRITE_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE]
const ASSESS_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA]
// ISSO prepares the ATO package; AO/DAO sign the decision.
const AUTHORIZE_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.AO, Role.DAO]

export class RmfStepService {
  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Load the project and assert that the caller has write access.
   * Returns the full project (with members) so callers can inspect it further.
   */
  private async _assertWriteAccess(projectId: string, userId: string, userRole: Role) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })

    if (!project) throw new AppError('Project not found', 404)

    if (userRole !== Role.ADMIN) {
      const member = project.members.find(m => m.userId === userId)
      if (!member) throw new AppError('You do not have access to this project', 403)
      if (!WRITE_ROLES.includes(member.role)) {
        throw new AppError('Insufficient permissions to edit this step', 403)
      }
    }

    return project
  }

  private async _assertAuthorizeAccess(projectId: string, userId: string, userRole: Role) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })

    if (!project) throw new AppError('Project not found', 404)

    if (userRole !== Role.ADMIN) {
      const member = project.members.find(m => m.userId === userId)
      if (!member) throw new AppError('You do not have access to this project', 403)
      if (!AUTHORIZE_ROLES.includes(member.role)) {
        throw new AppError('Insufficient permissions to edit the authorization step', 403)
      }
    }

    return project
  }

  private async _assertAssessAccess(projectId: string, userId: string, userRole: Role) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })

    if (!project) throw new AppError('Project not found', 404)

    if (userRole !== Role.ADMIN) {
      const member = project.members.find(m => m.userId === userId)
      if (!member) throw new AppError('You do not have access to this project', 403)
      if (!ASSESS_ROLES.includes(member.role)) {
        throw new AppError('Insufficient permissions to edit this assessment step', 403)
      }
    }

    return project
  }

  /**
   * Load a step record, throwing a 500 if it is missing (steps are created
   * atomically with the project, so absence indicates a data integrity issue).
   */
  private async _loadStep(projectId: string, stepNumber: number) {
    const step = await prisma.rMFStep.findUnique({
      where: { projectId_stepNumber: { projectId, stepNumber } },
    })

    if (step) return step

    // Older projects may have been created before later RMF steps existed.
    // Create the missing row on first save instead of blocking the workflow.
    return prisma.rMFStep.create({
      data: {
        projectId,
        stepNumber,
      },
    })
  }

  /**
   * Advance step status on first save (NOT_STARTED → IN_PROGRESS).
   * Never downgrades a step that is already under review or complete.
   */
  private _nextStatus(current: StepStatus): StepStatus {
    return current === StepStatus.NOT_STARTED ? StepStatus.IN_PROGRESS : current
  }

  // ─── Step 0 — PREPARE ───────────────────────────────────────────────────────

  /**
   * Save Step 0 (PREPARE) data for a project.
   *
   * Merges the incoming DTO with any previously saved data so the client can
   * send partial payloads. If `boundaryConfirmation` is provided it is also
   * written to `project.authBoundary` in the same transaction.
   */
  async updateStep0(projectId: string, dto: Step0Dto, userId: string, userRole: Role) {
    await this._assertWriteAccess(projectId, userId, userRole)

    const step = await this._loadStep(projectId, 0)

    // Merge — only overwrite keys that were explicitly sent
    const existing = (step.data ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing }

    if (dto.roles !== undefined) merged.roles = dto.roles
    if (dto.riskTolerance !== undefined) merged.riskTolerance = dto.riskTolerance
    if (dto.organizationalContext !== undefined) merged.organizationalContext = dto.organizationalContext
    if (dto.boundaryConfirmation !== undefined) merged.boundaryConfirmation = dto.boundaryConfirmation
    if (dto.diagrams !== undefined) merged.diagrams = dto.diagrams

    const [updatedStep] = await prisma.$transaction([
      prisma.rMFStep.update({
        where: { projectId_stepNumber: { projectId, stepNumber: 0 } },
        data: { data: merged as Prisma.InputJsonObject, status: this._nextStatus(step.status) },
      }),
      // Keep project.authBoundary in sync with the confirmed boundary text
      ...(dto.boundaryConfirmation !== undefined
        ? [
            prisma.project.update({
              where: { id: projectId },
              data: { authBoundary: dto.boundaryConfirmation || null },
            }),
          ]
        : []),
    ])

    return updatedStep
  }

  // ─── Step 1 — CATEGORIZE ────────────────────────────────────────────────────

  /**
   * Save Step 1 (CATEGORIZE) data for a project.
   *
   * Merges the incoming DTO with any previously saved data. If
   * `confirmedImpactLevel` is provided and differs from the project's current
   * value, `project.impactLevel` is updated in the same transaction — Step 1 is
   * the canonical source of the FIPS 199 categorization decision.
   */
  async updateStep1(projectId: string, dto: Step1Dto, userId: string, userRole: Role) {
    const project = await this._assertWriteAccess(projectId, userId, userRole)

    const step = await this._loadStep(projectId, 1)

    // Merge — only overwrite keys that were explicitly sent
    const existing = (step.data ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing }

    if (dto.confirmedImpactLevel !== undefined) merged.confirmedImpactLevel = dto.confirmedImpactLevel
    if (dto.impactJustification !== undefined) merged.impactJustification = dto.impactJustification
    if (dto.selectedInformationTypeIds !== undefined) merged.selectedInformationTypeIds = dto.selectedInformationTypeIds
    if (dto.objectiveJustification !== undefined) merged.objectiveJustification = dto.objectiveJustification
    if (dto.calculatedImpact !== undefined) merged.calculatedImpact = dto.calculatedImpact
    if (dto.selectedInformationTypes !== undefined) merged.selectedInformationTypes = dto.selectedInformationTypes

    // Sync project.impactLevel when the user confirms a categorization decision
    const impactChanged =
      dto.confirmedImpactLevel !== undefined &&
      dto.confirmedImpactLevel !== (project.impactLevel as ImpactLevel)

    const [updatedStep] = await prisma.$transaction([
      prisma.rMFStep.update({
        where: { projectId_stepNumber: { projectId, stepNumber: 1 } },
        data: { data: merged as Prisma.InputJsonObject, status: this._nextStatus(step.status) },
      }),
      ...(impactChanged
        ? [
            prisma.project.update({
              where: { id: projectId },
              data: { impactLevel: dto.confirmedImpactLevel },
            }),
          ]
        : []),
    ])

    return updatedStep
  }

  // ─── Step 2 — SELECT ───────────────────────────────────────────────────────

  /**
   * Save Step 2 (SELECT) data for a project.
   *
   * Merges the incoming DTO with any previously saved data so the client can
   * send partial payloads. Tailored controls and justifications are stored in
   * RMFStep.data; implementation-specific ControlInstance rows are handled by
   * later RMF workflow steps.
   */
  async updateStep2(projectId: string, dto: Step2Dto, userId: string, userRole: Role) {
    await this._assertWriteAccess(projectId, userId, userRole)

    const step = await this._loadStep(projectId, 2)
    const existing = (step.data ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing }

    if (dto.impactLevel !== undefined) merged.impactLevel = dto.impactLevel
    if (dto.jsigOverlay !== undefined) merged.jsigOverlay = dto.jsigOverlay
    if (dto.selectedControlIds !== undefined) merged.selectedControlIds = dto.selectedControlIds
    if (dto.baselineControlIds !== undefined) merged.baselineControlIds = dto.baselineControlIds
    if (dto.overlayControlIds !== undefined) merged.overlayControlIds = dto.overlayControlIds
    if (dto.tailoring !== undefined) merged.tailoring = dto.tailoring
    if (dto.selectedControls !== undefined) merged.selectedControls = dto.selectedControls
    if (dto.removedControls !== undefined) merged.removedControls = dto.removedControls
    if (dto.summary !== undefined) merged.summary = dto.summary
    if (dto.notes !== undefined) merged.notes = dto.notes

    const selectedControlIds = Array.isArray(merged.selectedControlIds) ? merged.selectedControlIds : []
    const baselineControlIds = Array.isArray(merged.baselineControlIds) ? merged.baselineControlIds : []
    const status =
      selectedControlIds.length > 0 && baselineControlIds.length > 0
        ? StepStatus.COMPLETE
        : this._nextStatus(step.status)

    return prisma.rMFStep.update({
      where: { projectId_stepNumber: { projectId, stepNumber: 2 } },
      data: { data: merged as Prisma.InputJsonObject, status },
    })
  }

  // ─── Step 3 — IMPLEMENT ────────────────────────────────────────────────────

  /**
   * Save Step 3 (IMPLEMENT) data for a project.
   *
   * The `implementations` map is deep-merged at the per-control level so the
   * client can save a single control without overwriting the rest of the map.
   * All other top-level fields follow the same shallow-merge pattern as Steps 0–2.
   */
  async updateStep3(projectId: string, dto: Step3Dto, userId: string, userRole: Role) {
    await this._assertWriteAccess(projectId, userId, userRole)

    const step = await this._loadStep(projectId, 3)
    const existing = (step.data ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing }

    if (dto.implementations !== undefined) {
      // Deep-merge at the per-control level so a partial save of one control
      // does not wipe out previously saved data for other controls.
      const existingImpls = (existing.implementations ?? {}) as Record<string, unknown>
      const mergedImpls: Record<string, unknown> = { ...existingImpls }
      for (const [controlId, implData] of Object.entries(dto.implementations)) {
        const prev = (existingImpls[controlId] ?? {}) as Record<string, unknown>
        mergedImpls[controlId] = { ...prev, ...implData }
      }
      merged.implementations = mergedImpls
    }

    if (dto.summary !== undefined) merged.summary = dto.summary
    if (dto.notes !== undefined) merged.notes = dto.notes

    const summary = merged.summary as { percent?: number; total?: number } | undefined
    const newStatus =
      (summary?.total ?? 0) > 0 && (summary?.percent ?? 0) >= 95
        ? StepStatus.COMPLETE
        : this._nextStatus(step.status)

    return prisma.rMFStep.update({
      where: { projectId_stepNumber: { projectId, stepNumber: 3 } },
      data: { data: merged as Prisma.InputJsonObject, status: newStatus },
    })
  }

  // ─── Step 4 — ASSESS ───────────────────────────────────────────────────────

  /**
   * Save Step 4 (ASSESS) data for a project.
   *
   * Stores assessor findings, uploaded evidence references, test results, and
   * the assessment summary in RMFStep.data. Findings are replaced as a list so
   * the client can reorder, add, remove, and bulk-accept AI findings cleanly.
   */
  async updateStep4(projectId: string, dto: Step4Dto, userId: string, userRole: Role) {
    await this._assertAssessAccess(projectId, userId, userRole)

    const step = await this._loadStep(projectId, 4)
    const existing = (step.data ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing }

    if (dto.findings !== undefined) merged.findings = dto.findings
    if (dto.evidenceDiagramIds !== undefined) merged.evidenceDiagramIds = dto.evidenceDiagramIds
    if (dto.testResults !== undefined) merged.testResults = dto.testResults
    if (dto.assessmentSummary !== undefined) merged.assessmentSummary = dto.assessmentSummary
    if (dto.summary !== undefined) merged.summary = dto.summary

    const findings = Array.isArray(merged.findings) ? merged.findings : []
    const openFindings = findings.filter((finding) => {
      const status = (finding as { status?: string }).status
      return status === 'OPEN' || status === 'IN_REMEDIATION'
    }).length
    const status =
      findings.length > 0 && openFindings === 0
        ? StepStatus.COMPLETE
        : findings.length > 0 || dto.testResults || dto.assessmentSummary
          ? StepStatus.IN_PROGRESS
          : this._nextStatus(step.status)

    return prisma.rMFStep.update({
      where: { projectId_stepNumber: { projectId, stepNumber: 4 } },
      data: { data: merged as Prisma.InputJsonObject, status },
    })
  }

  // ─── Step 5 — AUTHORIZE ────────────────────────────────────────────────────

  async updateStep5(projectId: string, dto: Step5Dto, userId: string, userRole: Role) {
    await this._assertAuthorizeAccess(projectId, userId, userRole)

    const step = await this._loadStep(projectId, 5)
    const existing = (step.data ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing }

    if (dto.residualRisk !== undefined) merged.residualRisk = dto.residualRisk
    if (dto.riskAcceptanceRationale !== undefined) merged.riskAcceptanceRationale = dto.riskAcceptanceRationale
    if (dto.decision !== undefined) merged.decision = dto.decision
    if (dto.decisionDate !== undefined) merged.decisionDate = dto.decisionDate
    if (dto.decisionRationale !== undefined) merged.decisionRationale = dto.decisionRationale
    if (dto.conditions !== undefined) merged.conditions = dto.conditions
    if (dto.atoExpiryDate !== undefined) merged.atoExpiryDate = dto.atoExpiryDate
    if (dto.signatures !== undefined) merged.signatures = dto.signatures
    if (dto.packageGenerated !== undefined) merged.packageGenerated = dto.packageGenerated
    if (dto.packageGeneratedAt !== undefined) merged.packageGeneratedAt = dto.packageGeneratedAt
    if (dto.notes !== undefined) merged.notes = dto.notes

    const decision = merged.decision as string | undefined
    const stepStatus = decision
      ? StepStatus.COMPLETE
      : merged.residualRisk || merged.decisionRationale
        ? StepStatus.IN_PROGRESS
        : this._nextStatus(step.status)

    const stepUpdate = prisma.rMFStep.update({
      where: { projectId_stepNumber: { projectId, stepNumber: 5 } },
      data: { data: merged as Prisma.InputJsonObject, status: stepStatus },
    })

    // Sync project.status and project.atoExpiry when a decision is recorded
    if (decision) {
      const projectStatusMap: Record<string, 'AUTHORIZED' | 'DENIED' | 'PENDING_ATO'> = {
        APPROVE: 'AUTHORIZED',
        DENY: 'DENIED',
        CONDITIONAL: 'PENDING_ATO',
      }
      const newProjectStatus = projectStatusMap[decision]
      const newAtoExpiry = dto.atoExpiryDate ? new Date(dto.atoExpiryDate) : undefined

      const [updatedStep] = await prisma.$transaction([
        stepUpdate,
        prisma.project.update({
          where: { id: projectId },
          data: {
            ...(newProjectStatus ? { status: newProjectStatus } : {}),
            ...(newAtoExpiry ? { atoExpiry: newAtoExpiry } : {}),
          },
        }),
      ])
      return updatedStep
    }

    return stepUpdate
  }

  // ─── Step 6 — MONITOR ──────────────────────────────────────────────────────

  async updateStep6(projectId: string, dto: Step6Dto, userId: string, userRole: Role) {
    await this._assertAssessAccess(projectId, userId, userRole)

    const step = await this._loadStep(projectId, 6)
    const existing = (step.data ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing }

    if (dto.monitoringStatus !== undefined) merged.monitoringStatus = dto.monitoringStatus
    if (dto.lastReviewDate !== undefined) merged.lastReviewDate = dto.lastReviewDate
    if (dto.nextReviewDate !== undefined) merged.nextReviewDate = dto.nextReviewDate
    if (dto.cadence !== undefined) merged.cadence = dto.cadence
    if (dto.recurringTasks !== undefined) merged.recurringTasks = dto.recurringTasks
    if (dto.complianceScore !== undefined) merged.complianceScore = dto.complianceScore
    if (dto.riskTrend !== undefined) merged.riskTrend = dto.riskTrend
    if (dto.riskMetrics !== undefined) merged.riskMetrics = dto.riskMetrics
    if (dto.monitoringReport !== undefined) merged.monitoringReport = dto.monitoringReport
    if (dto.reportGeneratedAt !== undefined) merged.reportGeneratedAt = dto.reportGeneratedAt
    if (dto.aiGenerated !== undefined) merged.aiGenerated = dto.aiGenerated
    if (dto.notes !== undefined) merged.notes = dto.notes

    const hasReport = typeof merged.monitoringReport === 'string' && merged.monitoringReport.trim().length > 0
    const hasReviewCadence = Boolean(merged.lastReviewDate && merged.nextReviewDate && merged.cadence)
    const hasTasking = Array.isArray(merged.recurringTasks) && merged.recurringTasks.length > 0
    const status = hasReport && hasReviewCadence && hasTasking
      ? StepStatus.COMPLETE
      : hasReport || hasReviewCadence || hasTasking
        ? StepStatus.IN_PROGRESS
        : this._nextStatus(step.status)

    return prisma.rMFStep.update({
      where: { projectId_stepNumber: { projectId, stepNumber: 6 } },
      data: { data: merged as Prisma.InputJsonObject, status },
    })
  }
}
