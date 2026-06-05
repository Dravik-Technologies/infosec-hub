import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'

const router = Router()

router.post('/register', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Local registration is disabled in production. Use HUB SSO to access CRATER.' })
    return
  }
  try {
    const { username, email, password } = req.body
    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email, and password are required' })
      return
    }
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] })
    if (existing) {
      res.status(409).json({ error: 'Email or username already in use' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ username, email, passwordHash })
    const token = jwt.sign(
      { userId: (user._id as any).toString() },
      process.env.JWT_SECRET ?? 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any }
    )
    res.status(201).json({ token, user })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Local login is disabled in production. Use HUB SSO to access CRATER.' })
    return
  }
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' })
      return
    }
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }
    const token = jwt.sign(
      { userId: (user._id as any).toString() },
      process.env.JWT_SECRET ?? 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any }
    )
    res.json({ token, user })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Login failed' })
  }
})

/* GET /api/auth/sso?hub_token=<token>
 * Verifies the hub one-time token, issues a CRATER JWT, then returns a tiny
 * HTML page that writes crater-token / crater-user into localStorage and
 * redirects to /.  This avoids the React Router race condition where
 * ProtectedRoute would redirect to /login before any client-side useEffect
 * could read the hub_token query param.
 */
router.get('/sso', async (req, res) => {
  const hub_token = req.query.hub_token as string
  if (!hub_token) { console.log('[CRATER SSO] no hub_token in request'); res.redirect('/login'); return }
  try {
    const hubUrl = process.env.HUB_URL ?? 'http://localhost:3010'
    console.log(`[CRATER SSO] verifying token with hub at ${hubUrl}`)
    const r = await fetch(`${hubUrl}/api/sso/verify?token=${encodeURIComponent(hub_token)}`)
    const body = await r.json() as { valid: boolean; user?: any }
    console.log(`[CRATER SSO] hub response: status=${r.status} valid=${body.valid} user=${body.user?.username ?? 'none'}`)
    if (!r.ok || !body.valid || !body.user) {
      console.log('[CRATER SSO] verification failed — redirecting to login')
      res.status(401).json({ error: 'Invalid SSO token' }); return
    }

    if (body.user.requestedApp && body.user.requestedApp !== 'crater') {
      res.status(403).json({ error: 'Token was not issued for CRATER' }); return
    }
    const allowedApps: string[] = Array.isArray(body.user.allowedApps) ? body.user.allowedApps : []
    if (!allowedApps.includes('crater')) {
      res.status(403).json({ error: 'CRATER access has not been granted for this account' }); return
    }

    const siteIds: string[] = Array.isArray(body.user.siteIds) ? body.user.siteIds.filter(Boolean) : []
    const primarySiteId: string | null = body.user.primarySiteId || body.user.siteId || siteIds[0] || null
    const hubRole: string = body.user.hubRole || body.user.role || 'Hub Viewer'

    const token = jwt.sign(
      {
        userId: body.user.id,
        username: body.user.username,
        hubRole,
        jobRole: body.user.jobRole || body.user.securityRole || null,
        primarySiteId,
        siteIds,
        allowedApps,
        // Legacy aliases — kept for tokens decoded by older middleware
        role: body.user.role || hubRole,
        siteId: primarySiteId,
      },
      process.env.JWT_SECRET ?? 'secret',
      { expiresIn: '8h' }
    )
    const user = { id: body.user.id, username: body.user.username, email: body.user.email ?? '' }
    console.log(`[CRATER SSO] success — issuing JWT for ${user.username}`)
    res.json({ token, user })
  } catch (err: any) {
    console.error('[CRATER SSO] error:', err.message)
    res.status(500).json({ error: 'SSO failed' })
  }
})

export default router
