import { Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import type { AuthRequest } from '../middleware/auth'
import { AppError } from '../utils/errors'

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { ownedProjects: true } },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
}

export async function updateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { role, isActive } = req.body as { role?: Role; isActive?: boolean }

    if (id === req.user!.id) {
      throw new AppError('Cannot modify your own account via admin panel', 400)
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new AppError('User not found', 404)

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { ownedProjects: true } },
      },
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
}

export async function getAdminAuditLog(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, userId, action, entityType, from, to, page = '1', limit = '50' } = req.query as Record<string, string>

    const take = Math.min(100, Math.max(1, Number(limit)))
    const skip = (Math.max(1, Number(page)) - 1) * take

    const where = {
      ...(projectId ? { projectId } : {}),
      ...(userId ? { userId } : {}),
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

export async function getPlatformStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [userCount, activeCount, projectCount, controlCount, openPoamCount, roleGroups] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.project.count(),
      prisma.control.count(),
      prisma.pOAMItem.count({ where: { status: 'OPEN' } }),
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    ])

    const roleBreakdown = Object.fromEntries(roleGroups.map((g) => [g.role, g._count._all]))

    res.json({
      users: { total: userCount, active: activeCount, inactive: userCount - activeCount, byRole: roleBreakdown },
      projects: projectCount,
      controls: controlCount,
      openPoams: openPoamCount,
      config: {
        aiModel: process.env.LOCAL_AI_MODEL ?? 'llama3.1:8b',
        aiFastModel: process.env.LOCAL_AI_FAST_MODEL ?? process.env.LOCAL_AI_MODEL ?? 'llama3.1:8b',
        aiMaxTokens: Number(process.env.LOCAL_AI_MAX_TOKENS ?? 384),
        aiContextWindow: Number(process.env.LOCAL_AI_CONTEXT_WINDOW ?? 4096),
        aiMaxRagChunks: Number(process.env.LOCAL_AI_MAX_RAG_CHUNKS ?? 3),
        aiTemperature: 0.15,
        aiProvider: process.env.LOCAL_AI_PROVIDER ?? 'ollama',
        ollamaUrl: process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434',
        nodeEnv: process.env.NODE_ENV ?? 'production',
        port: Number(process.env.PORT ?? 3000),
      },
      version: {
        app: '1.0.0',
        rmfFramework: 'NIST SP 800-37 Rev. 2',
        nistControls: 'NIST SP 800-53 Rev. 5',
        jsig: 'Rev. 2',
        fips: 'FIPS 199 / FIPS 200',
        cnssi: 'CNSSI 1253',
      },
    })
  } catch (err) {
    next(err)
  }
}
