import { ConMonEventStatus, ConMonRecurrence, Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import type { CreateConMonEventDto, UpdateConMonEventDto } from '../utils/schemas'

const WRITE_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE]

async function verifyAccess(projectId: string, userId: string, userRole: Role, write = false) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  })
  if (!project) throw new AppError('Project not found', 404)
  if (userRole === Role.ADMIN) return project
  const member = project.members.find((m) => m.userId === userId)
  if (!member) throw new AppError('You do not have access to this project', 403)
  if (write && !WRITE_ROLES.includes(member.role))
    throw new AppError('Insufficient permissions', 403)
  return project
}

export class ConMonService {
  async list(projectId: string, userId: string, userRole: Role, year: number, month: number) {
    await verifyAccess(projectId, userId, userRole)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    return prisma.conMonEvent.findMany({
      where: { projectId, dueDate: { gte: start, lte: end } },
      orderBy: { dueDate: 'asc' },
    })
  }

  async listUpcoming(projectId: string, userId: string, userRole: Role, days: number) {
    await verifyAccess(projectId, userId, userRole)
    const now = new Date()
    // Lower bound: 90 days ago — prevents unbounded historical overdue events from flooding the list
    const start = new Date(now)
    start.setDate(start.getDate() - 90)
    const end = new Date(now)
    end.setDate(end.getDate() + days)
    return prisma.conMonEvent.findMany({
      where: {
        projectId,
        dueDate: { gte: start, lte: end },
        status: { notIn: [ConMonEventStatus.COMPLETE, ConMonEventStatus.CANCELLED] },
      },
      orderBy: { dueDate: 'asc' },
    })
  }

  async create(projectId: string, dto: CreateConMonEventDto, userId: string, userRole: Role) {
    await verifyAccess(projectId, userId, userRole, true)
    return prisma.conMonEvent.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        eventType: dto.eventType,
        dueDate: new Date(dto.dueDate),
        recurrence: dto.recurrence ?? ConMonRecurrence.NONE,
        controlId: dto.controlId,
        poamItemId: dto.poamItemId,
        assignedTo: dto.assignedTo,
      },
    })
  }

  async update(
    eventId: string,
    projectId: string,
    dto: UpdateConMonEventDto,
    userId: string,
    userRole: Role,
  ) {
    await verifyAccess(projectId, userId, userRole, true)
    const event = await prisma.conMonEvent.findFirst({ where: { id: eventId, projectId } })
    if (!event) throw new AppError('Event not found', 404)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}
    if (dto.title !== undefined) data.title = dto.title
    if (dto.description !== undefined) data.description = dto.description
    if (dto.eventType !== undefined) data.eventType = dto.eventType
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate)
    if (dto.recurrence !== undefined) data.recurrence = dto.recurrence
    if (dto.controlId !== undefined) data.controlId = dto.controlId
    if (dto.poamItemId !== undefined) data.poamItemId = dto.poamItemId
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo
    if (dto.status !== undefined) {
      data.status = dto.status
      if (dto.status === ConMonEventStatus.COMPLETE && !event.completedAt)
        data.completedAt = new Date()
    }
    if (dto.completedAt !== undefined)
      data.completedAt = dto.completedAt ? new Date(dto.completedAt) : null

    return prisma.conMonEvent.update({ where: { id: eventId }, data })
  }

  async delete(eventId: string, projectId: string, userId: string, userRole: Role) {
    await verifyAccess(projectId, userId, userRole, true)
    const event = await prisma.conMonEvent.findFirst({ where: { id: eventId, projectId } })
    if (!event) throw new AppError('Event not found', 404)
    await prisma.conMonEvent.delete({ where: { id: eventId } })
  }

  async complete(eventId: string, projectId: string, userId: string, userRole: Role) {
    await verifyAccess(projectId, userId, userRole, true)
    const event = await prisma.conMonEvent.findFirst({ where: { id: eventId, projectId } })
    if (!event) throw new AppError('Event not found', 404)

    await prisma.conMonEvent.update({
      where: { id: eventId },
      data: { status: ConMonEventStatus.COMPLETE, completedAt: new Date() },
    })

    if (event.recurrence === ConMonRecurrence.NONE) return null

    const nextDue = new Date(event.dueDate)
    if (event.recurrence === ConMonRecurrence.MONTHLY) nextDue.setMonth(nextDue.getMonth() + 1)
    else if (event.recurrence === ConMonRecurrence.QUARTERLY) nextDue.setMonth(nextDue.getMonth() + 3)
    else if (event.recurrence === ConMonRecurrence.SEMI_ANNUAL)
      nextDue.setMonth(nextDue.getMonth() + 6)
    else if (event.recurrence === ConMonRecurrence.ANNUAL)
      nextDue.setFullYear(nextDue.getFullYear() + 1)

    return prisma.conMonEvent.create({
      data: {
        projectId: event.projectId,
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        dueDate: nextDue,
        recurrence: event.recurrence,
        controlId: event.controlId,
        poamItemId: event.poamItemId,
        assignedTo: event.assignedTo,
      },
    })
  }
}
