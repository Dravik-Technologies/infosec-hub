import { POAMStatus, Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import type { CreateProjectDto, UpdateProjectDto } from '../utils/schemas'

const RMF_STEP_COUNT = 7 // Steps 0–6 per NIST SP 800-37 Rev. 2

const LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  impactLevel: true,
  status: true,
  atoExpiry: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  members: { select: { userId: true, role: true } },
  rmfSteps: {
    select: { stepNumber: true, status: true },
    orderBy: { stepNumber: 'asc' as const },
  },
  _count: { select: { poamItems: { where: { status: POAMStatus.OPEN } }, diagrams: true, artifacts: true, inventoryItems: true, ppsmEntries: true } },
} as const

// Project has no direct `evidence` relation — evidence belongs to RMFStep/ControlInstance.
const DETAIL_INCLUDE = {
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  members: {
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
    },
  },
  rmfSteps: { orderBy: { stepNumber: 'asc' as const } },
  diagrams: { orderBy: { createdAt: 'desc' as const } },
  artifacts: { orderBy: { createdAt: 'desc' as const } },
  inventoryItems: { orderBy: { item: 'asc' as const } },
  ppsmEntries: { orderBy: { serviceApplication: 'asc' as const } },
  poamItems: { orderBy: { severity: 'asc' as const } },
  _count: { select: { controlInstances: true, poamItems: { where: { status: POAMStatus.OPEN } }, inventoryItems: true, ppsmEntries: true } },
} as const

// Roles that can write to a project they are a member of.
// SCA, AO, and DAO are read-only — they assess and authorize but do not implement.
const WRITE_ROLES: Role[] = [
  Role.SYSTEM_OWNER,
  Role.ISSO,
  Role.ISSM,
  Role.ISSE,
]

export class ProjectService {
  async list(userId: string, userRole: Role) {
    const where = userRole === Role.ADMIN ? {} : { members: { some: { userId } } }
    return prisma.project.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, userId: string, userRole: Role) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    })

    if (!project) throw new AppError('Project not found', 404)

    if (userRole !== Role.ADMIN) {
      const isMember = project.members.some(m => m.userId === userId)
      if (!isMember) throw new AppError('You do not have access to this project', 403)
    }

    return project
  }

  async create(dto: CreateProjectDto, userId: string) {
    console.log('[ProjectService.create] start', { dto, userId })

    try {
      const project = await prisma.$transaction(async tx => {
        return tx.project.create({
          data: {
            name:         dto.name,
            description:  dto.description,
            impactLevel:  dto.impactLevel,
            authBoundary: dto.authBoundary,
            ownerId:      userId,
            members: {
              // Creator is added as ISSO — the primary RMF practitioner role
              create: { userId, role: Role.ISSO },
            },
            rmfSteps: {
              createMany: {
                data: Array.from({ length: RMF_STEP_COUNT }, (_, i) => ({
                  stepNumber: i,
                })),
              },
            },
          },
          include: DETAIL_INCLUDE,
        })
      })

      console.log('[ProjectService.create] success', { projectId: project.id })
      return project
    } catch (err) {
      console.error('[ProjectService.create] error', err)
      throw err
    }
  }

  async update(id: string, dto: UpdateProjectDto, userId: string, userRole: Role) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true },
    })

    if (!project) throw new AppError('Project not found', 404)

    if (userRole !== Role.ADMIN) {
      const member = project.members.find(m => m.userId === userId)
      if (!member) throw new AppError('You do not have access to this project', 403)
      if (!WRITE_ROLES.includes(member.role)) {
        throw new AppError('Insufficient permissions to update this project', 403)
      }
    }

    return prisma.project.update({
      where: { id },
      data: {
        name:         dto.name,
        description:  dto.description,
        impactLevel:  dto.impactLevel,
        status:       dto.status,
        authBoundary: dto.authBoundary,
        atoExpiry:    dto.atoExpiry ? new Date(dto.atoExpiry) : undefined,
      },
      include: DETAIL_INCLUDE,
    })
  }

  async delete(id: string, userId: string, userRole: Role) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, ownerId: true },
    })

    if (!project) throw new AppError('Project not found', 404)

    // ADMINs can delete any project; everyone else must be the project owner
    if (userRole !== Role.ADMIN && project.ownerId !== userId) {
      throw new AppError('Only the project owner or an administrator can delete a project', 403)
    }

    await prisma.project.delete({ where: { id } })
  }
}
