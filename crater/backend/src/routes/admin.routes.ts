import { Router } from 'express'
import { Role } from '@prisma/client'
import { listUsers, updateUser, getPlatformStats, getAdminAuditLog } from '../controllers/admin.controller'
import { authenticate, requireRole } from '../middleware/auth'

const router = Router()

router.use(authenticate)
router.use(requireRole(Role.ADMIN))

router.get('/users', listUsers)
router.patch('/users/:id', updateUser)
router.get('/stats', getPlatformStats)
router.get('/audit', getAdminAuditLog)

export default router
