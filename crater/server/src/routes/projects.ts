import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { auditLog } from '../middleware/audit'

const router = Router()
router.use(authenticate)

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  systemDescription: z.string().optional(),
  impactLevel: z.enum(['LOW', 'MODERATE', 'HIGH']).default('LOW'),
  authBoundary: z.string().optional(),
})

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { members: { some: { userId: req.user!.id } } },
      include: {
        _count: { select: { controlInstances: true, diagrams: true, poamItems: true } },
        rmfSteps: { orderBy: { stepNumber: 'asc' }, select: { stepNumber: true, status: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(projects)
  } catch (err) {
    next(err)
  }
})

router.post('/', auditLog('CREATE', 'project'), async (req: AuthRequest, res, next) => {
  try {
    const body = createProjectSchema.parse(req.body)
    const project = await prisma.project.create({
      data: {
        ...body,
        members: { create: { userId: req.user!.id, role: req.user!.role as any } },
        rmfSteps: {
          createMany: { data: Array.from({ length: 7 }, (_, i) => ({ stepNumber: i })) },
        },
      },
    })
    res.status(201).json(project)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, members: { some: { userId: req.user!.id } } },
      include: {
        rmfSteps: { orderBy: { stepNumber: 'asc' } },
        members: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
        _count: { select: { controlInstances: true, diagrams: true, poamItems: true } },
      },
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    res.json(project)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', auditLog('UPDATE', 'project'), async (req: AuthRequest, res, next) => {
  try {
    const body = createProjectSchema.partial().parse(req.body)
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, members: { some: { userId: req.user!.id } } },
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    const updated = await prisma.project.update({ where: { id: req.params.id }, data: body })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

export default router
