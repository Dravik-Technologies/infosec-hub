import { InventoryApprovalStatus, Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import type { CreateInventoryItemDto, UpdateInventoryItemDto } from '../utils/schemas'

const WRITE_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA]

export class InventoryService {
  async list(projectId: string, userId: string, userRole: Role) {
    await assertProjectAccess(projectId, userId, userRole)

    return prisma.inventoryItem.findMany({
      where: { projectId },
      orderBy: [{ itemType: 'asc' }, { item: 'asc' }],
    })
  }

  async create(projectId: string, dto: CreateInventoryItemDto, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)

    return prisma.inventoryItem.create({
      data: {
        projectId,
        item: dto.item,
        itemType: dto.itemType,
        modelVersion: dto.modelVersion,
        location: dto.location,
        classification: dto.classification,
        approvalStatus: dto.approvalStatus ?? InventoryApprovalStatus.PENDING,
        notes: dto.notes,
      },
    })
  }

  async update(projectId: string, inventoryItemId: string, dto: UpdateInventoryItemDto, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)
    await assertInventoryItemBelongsToProject(projectId, inventoryItemId)

    return prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: dto,
    })
  }

  async delete(projectId: string, inventoryItemId: string, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)
    await assertInventoryItemBelongsToProject(projectId, inventoryItemId)

    await prisma.inventoryItem.delete({ where: { id: inventoryItemId } })
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
    throw new AppError('Insufficient permissions to manage inventory', 403)
  }

  return project
}

async function assertInventoryItemBelongsToProject(projectId: string, inventoryItemId: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { projectId: true } })
  if (!item) throw new AppError('Inventory item not found', 404)
  if (item.projectId !== projectId) throw new AppError('Inventory item does not belong to this project', 404)
}
