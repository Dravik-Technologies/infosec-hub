import { Router } from 'express'
import authRoutes from './auth.routes'
import projectRoutes from './project.routes'
import informationTypeRoutes from './information-type.routes'
import controlsRoutes from './controls.routes'
import oscalRoutes from './oscal.routes'
import aiRoutes from './ai.routes'
import adminRoutes from './admin.routes'
import usersRoutes from './users.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/projects', projectRoutes)
router.use('/information-types', informationTypeRoutes)
router.use('/controls', controlsRoutes)
router.use('/oscal', oscalRoutes)
router.use('/ai', aiRoutes)
router.use('/admin', adminRoutes)
router.use('/users', usersRoutes)

console.log('[routes] index mounted: /auth, /projects, /information-types, /controls, /oscal, /ai, /admin, /users')

export default router
