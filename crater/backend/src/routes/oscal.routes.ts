import multer from 'multer'
import { Role } from '@prisma/client'
import { Router } from 'express'
import { importOscal } from '../controllers/oscal.controller'
import { authenticate, requireRole } from '../middleware/auth'

const router = Router()

const oscalUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const name = file.originalname.toLowerCase()
    const allowed =
      name.endsWith('.json') ||
      name.endsWith('.xml') ||
      file.mimetype === 'application/json' ||
      file.mimetype === 'application/xml' ||
      file.mimetype === 'text/xml' ||
      file.mimetype === 'application/octet-stream'

    cb(null, allowed)
  },
})

router.use(authenticate)

// POST /api/oscal/import
// Imports an OSCAL catalog or profile and overrides the selected baseline flags.
router.post(
  '/import',
  requireRole(Role.ADMIN, Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE),
  oscalUpload.single('file'),
  importOscal,
)

export default router
