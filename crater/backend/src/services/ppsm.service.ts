import { PPSMApprovalStatus, Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import type { CreatePpsmEntryDto, UpdatePpsmEntryDto } from '../utils/schemas'

const WRITE_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA]

export class PpsmService {
  async list(projectId: string, userId: string, userRole: Role) {
    await assertProjectAccess(projectId, userId, userRole)

    return prisma.pPSMEntry.findMany({
      where: { projectId },
      orderBy: [{ protocol: 'asc' }, { port: 'asc' }, { serviceApplication: 'asc' }],
    })
  }

  async create(projectId: string, dto: CreatePpsmEntryDto, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)

    return prisma.pPSMEntry.create({
      data: {
        projectId,
        port: dto.port,
        protocol: dto.protocol,
        direction: dto.direction,
        serviceApplication: dto.serviceApplication,
        justification: dto.justification,
        approvalStatus: dto.approvalStatus ?? PPSMApprovalStatus.PENDING,
      },
    })
  }

  async update(projectId: string, ppsmEntryId: string, dto: UpdatePpsmEntryDto, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)
    await assertPpsmEntryBelongsToProject(projectId, ppsmEntryId)

    return prisma.pPSMEntry.update({
      where: { id: ppsmEntryId },
      data: dto,
    })
  }

  async delete(projectId: string, ppsmEntryId: string, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)
    await assertPpsmEntryBelongsToProject(projectId, ppsmEntryId)

    await prisma.pPSMEntry.delete({ where: { id: ppsmEntryId } })
  }
}

async function assertProjectAccess(projectId: string, userId: string, userRole: Role) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  })

  if (!project) throw new AppError('Project not found', 404)
  if (userRole === Role.ADMIN) return project
  if (!project.members.some((member) => member.userId === userId)) {
    throw new AppError('You do not have access to this project', 403)
  }

  return project
}

async function assertProjectWriteAccess(projectId: string, userId: string, userRole: Role) {
  const project = await assertProjectAccess(projectId, userId, userRole)
  if (userRole === Role.ADMIN) return project

  const member = project.members.find((item) => item.userId === userId)
  if (!member || !WRITE_ROLES.includes(member.role)) {
    throw new AppError('Insufficient permissions to manage PPSM entries', 403)
  }

  return project
}

async function assertPpsmEntryBelongsToProject(projectId: string, ppsmEntryId: string) {
  const item = await prisma.pPSMEntry.findUnique({ where: { id: ppsmEntryId }, select: { projectId: true } })
  if (!item) throw new AppError('PPSM entry not found', 404)
  if (item.projectId !== projectId) throw new AppError('PPSM entry does not belong to this project', 404)
}
