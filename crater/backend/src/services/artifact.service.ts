import path from 'path'
import fs from 'fs'
import { ArtifactType, Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import type { UpdateArtifactDto, UploadArtifactDto } from '../utils/schemas'

const WRITE_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA]

export class ArtifactService {
  async list(projectId: string, userId: string, userRole: Role) {
    await assertProjectAccess(projectId, userId, userRole)

    return prisma.artifact.findMany({
      where: { projectId },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } }, step: { select: { stepNumber: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async upload(projectId: string, files: Express.Multer.File[], dto: UploadArtifactDto, userId: string, userRole: Role) {
    if (!files.length) throw new AppError('No files were uploaded', 400)
    await assertProjectWriteAccess(projectId, userId, userRole)

    const stepId = dto.stepNumber !== undefined ? await resolveStepId(projectId, dto.stepNumber) : undefined
    if (dto.poamItemId) await assertPoamBelongsToProject(projectId, dto.poamItemId)

    const records = files.map((file) => {
      const relPath = path.join('projects', projectId, 'artifacts', file.filename).replace(/\\/g, '/')
      const title = dto.title && files.length === 1
        ? dto.title
        : path.basename(file.originalname, path.extname(file.originalname))

      return {
        projectId,
        stepId,
        controlId: dto.controlId || null,
        poamItemId: dto.poamItemId || null,
        uploadedById: userId,
        title,
        type: dto.type ?? ArtifactType.OTHER,
        description: dto.description,
        tags: dto.tags ?? [],
        fileUrl: `/uploads/${relPath}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      }
    })

    return prisma.$transaction(records.map((data) => prisma.artifact.create({ data })))
  }

  async update(projectId: string, artifactId: string, dto: UpdateArtifactDto, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)
    await assertArtifactBelongsToProject(projectId, artifactId)
    const stepId = dto.stepNumber !== undefined && dto.stepNumber !== null ? await resolveStepId(projectId, dto.stepNumber) : dto.stepNumber === null ? null : undefined
    if (dto.poamItemId) await assertPoamBelongsToProject(projectId, dto.poamItemId)

    return prisma.artifact.update({
      where: { id: artifactId },
      data: {
        title: dto.title,
        type: dto.type,
        description: dto.description,
        tags: dto.tags,
        stepId,
        controlId: dto.controlId === null ? null : dto.controlId,
        poamItemId: dto.poamItemId === null ? null : dto.poamItemId,
      },
    })
  }

  async delete(projectId: string, artifactId: string, userId: string, userRole: Role) {
    await assertProjectWriteAccess(projectId, userId, userRole)
    const artifact = await assertArtifactBelongsToProject(projectId, artifactId)

    await prisma.artifact.delete({ where: { id: artifactId } })
    removeUploadedFile(artifact.fileUrl)
  }
}

async function assertProjectAccess(projectId: string, userId: string, userRole: Role) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } })
  if (!project) throw new AppError('Project not found', 404)
  if (userRole === Role.ADMIN) return project
  if (!project.members.some((member) => member.userId === userId)) throw new AppError('You do not have access to this project', 403)
  return project
}

async function assertProjectWriteAccess(projectId: string, userId: string, userRole: Role) {
  const project = await assertProjectAccess(projectId, userId, userRole)
  if (userRole === Role.ADMIN) return project
  const member = project.members.find((item) => item.userId === userId)
  if (!member || !WRITE_ROLES.includes(member.role)) throw new AppError('Insufficient permissions to manage artifacts', 403)
  return project
}

async function resolveStepId(projectId: string, stepNumber: number) {
  const step = await prisma.rMFStep.upsert({
    where: { projectId_stepNumber: { projectId, stepNumber } },
    create: { projectId, stepNumber },
    update: {},
    select: { id: true },
  })
  return step.id
}

async function assertPoamBelongsToProject(projectId: string, poamItemId: string) {
  const item = await prisma.pOAMItem.findUnique({ where: { id: poamItemId }, select: { projectId: true } })
  if (!item || item.projectId !== projectId) throw new AppError('POA&M item not found for this project', 404)
}

async function assertArtifactBelongsToProject(projectId: string, artifactId: string) {
  const artifact = await prisma.artifact.findUnique({ where: { id: artifactId } })
  if (!artifact) throw new AppError('Artifact not found', 404)
  if (artifact.projectId !== projectId) throw new AppError('Artifact does not belong to this project', 404)
  return artifact
}

function removeUploadedFile(fileUrl: string) {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads')
  const relative = fileUrl.replace(/^\/uploads\/?/, '')
  const absolute = path.resolve(uploadDir, relative)
  if (!absolute.startsWith(uploadDir)) return
  fs.promises.unlink(absolute).catch(() => undefined)
}
