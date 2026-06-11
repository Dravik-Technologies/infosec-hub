import { Router } from 'express'
import { register, login, getMe } from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { registerSchema, loginSchema } from '../utils/schemas'

const router = Router()

// POST /api/auth/register
router.post('/register', validate(registerSchema), register)

// POST /api/auth/login
router.post('/login', validate(loginSchema), login)

// GET /api/auth/me
router.get('/me', authenticate, getMe)

export default router
