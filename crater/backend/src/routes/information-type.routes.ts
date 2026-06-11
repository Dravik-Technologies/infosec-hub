import { Router } from 'express'
import { listInformationTypes } from '../controllers/information-type.controller'

const router = Router()

console.log('[routes] information-type routes loaded')

// GET /api/information-types
// Public — static reference data, no auth required.
router.get('/', listInformationTypes)

export default router
