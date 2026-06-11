import { POAMStatus, Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import type { CreatePoamItemDto, UpdatePoamItemDto } from '../utils/schemas'

const WRITE_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA]

export class PoamService {
  async list(projectId: string, userId: string, userRole: Role) {
    await assertProjectAccess(projectId, userId, userRole)

    return prisma.pOAMItem.findMany({
      where: { projectId },
      orderBy: [{ status: 'asc' }, { severity: 'asc' }, { scheduledCompletion: 'asc' }],
    })
  }

  async create(projectId: string, dto: CreatePoamItemDto, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)

    return prisma.pOAMItem.create({
      data: {
        projectId,
        controlId: dto.controlId || null,
        weakness: dto.weakness,
        description: dto.description,
        severity: dto.severity,
        status: dto.status ?? POAMStatus.OPEN,
        scheduledCompletion: dto.scheduledCompletion ? new Date(dto.scheduledCompletion) : undefined,
        milestonesWithDates: dto.milestonesWithDates,
        resources: dto.resources,
        cost: dto.cost,
      },
    })
  }

  async update(projectId: string, poamId: string, dto: UpdatePoamItemDto, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)
    await assertPoamBelongsToProject(projectId, poamId)

    return prisma.pOAMItem.update({
      where: { id: poamId },
      data: {
        controlId: dto.controlId,
        weakness: dto.weakness,
        description: dto.description,
        severity: dto.severity,
        status: dto.status,
        scheduledCompletion: dto.scheduledCompletion ? new Date(dto.scheduledCompletion) : undefined,
        milestonesWithDates: dto.milestonesWithDates,
        resources: dto.resources,
        cost: dto.cost,
        closedAt: dto.status === POAMStatus.CLOSED ? new Date() : undefined,
      },
    })
  }

  async delete(projectId: string, poamId: string, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)
    await assertPoamBelongsToProject(projectId, poamId)

    await prisma.pOAMItem.delete({ where: { id: poamId } })
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
    throw new AppError('Insufficient permissions to manage POA&M items', 403)
  }

  return project
}

async function assertPoamBelongsToProject(projectId: string, poamId: string) {
  const item = await prisma.pOAMItem.findUnique({ where: { id: poamId }, select: { projectId: true } })
  if (!item) throw new AppError('POA&M item not found', 404)
  if (item.projectId !== projectId) throw new AppError('POA&M item does not belong to this project', 404)
}
