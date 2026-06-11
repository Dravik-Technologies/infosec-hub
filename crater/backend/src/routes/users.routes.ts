import { Router } from 'express'
import { prisma } from '../prisma/client'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

// GET /api/users — all active platform users (name + role only; no sensitive fields)
router.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
})

export default router
