import { Router } from 'express'
import { listControls } from '../controllers/project.controller'

const router = Router()

// GET /api/controls
// Public — static NIST 800-53 reference data, no auth required.
router.get('/', listControls)

export default router
