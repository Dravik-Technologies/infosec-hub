import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AppError } from '../lib/errors'
import type { CreateProjectDto, UpdateProjectDto } from '../lib/schemas'

const RMF_STEP_COUNT = 7 // Steps 0–6

const PROJECT_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  impactLevel: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  members: { select: { userId: true, role: true } },
  rmfSteps: { select: { stepNumber: true, status: true }, orderBy: { stepNumber: 'asc' as const } },
}

const PROJECT_DETAIL_INCLUDE = {
  members: {
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      },
    },
  },
  rmfSteps: { orderBy: { stepNumber: 'asc' as const } },
  diagrams: { orderBy: { createdAt: 'desc' as const } },
  poamItems: { orderBy: { severity: 'asc' as const } },
}

export class ProjectService {
  async findByUser(userId: string, role: Role) {
    const where = role === Role.ADMIN ? {} : { members: { some: { userId } } }
    return prisma.project.findMany({
      where,
      select: PROJECT_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, userId: string, role: Role) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: PROJECT_DETAIL_INCLUDE,
    })

    if (!project) throw new AppError('Project not found', 404)

    if (role !== Role.ADMIN) {
      const isMember = project.members.some(m => m.userId === userId)
      if (!isMember) throw new AppError('Access denied', 403)
    }

    return project
  }

  async create(dto: CreateProjectDto, userId: string) {
    return prisma.$transaction(async tx => {
      return tx.project.create({
        data: {
          name: dto.name,
          description: dto.systemDescription,
          impactLevel: dto.impactLevel,
          authBoundary: dto.authBoundary,
          ownerId: userId,
          members: {
            create: { userId, role: Role.SYSTEM_OWNER },
          },
          rmfSteps: {
            createMany: {
              data: Array.from({ length: RMF_STEP_COUNT }, (_, i) => ({ stepNumber: i })),
            },
          },
        },
        include: PROJECT_DETAIL_INCLUDE,
      })
    })
  }

  async update(id: string, dto: UpdateProjectDto, userId: string, role: Role) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true },
    })
    if (!project) throw new AppError('Project not found', 404)

    if (role !== Role.ADMIN) {
      const member = project.members.find(m => m.userId === userId)
      if (!member) throw new AppError('Access denied', 403)
    }

    return prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.systemDescription,
        impactLevel: dto.impactLevel,
        status: dto.status,
        authBoundary: dto.authBoundary,
        atoExpiry: dto.atoExpiry ? new Date(dto.atoExpiry) : undefined,
      },
      include: PROJECT_DETAIL_INCLUDE,
    })
  }

  async delete(id: string) {
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) throw new AppError('Project not found', 404)
    await prisma.project.delete({ where: { id } })
  }
}
