import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

interface CraterJwtPayload {
  userId?: string
  username?: string
  // Canonical HUB claim fields (present in SSO-issued tokens)
  hubRole?: string
  jobRole?: string | null
  primarySiteId?: string | null
  siteIds?: string[]
  allowedApps?: string[]
  // Legacy aliases — present in older tokens and kept for backward compat
  role?: string
  siteId?: string | null
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as CraterJwtPayload
    req.userId = decoded.userId

    // Populate craterUser for SSO-issued tokens that carry HUB identity claims.
    // Legacy local-auth tokens (userId only) will leave craterUser undefined,
    // which downstream site-scope helpers treat as "cannot verify scope → deny".
    const hubRole = decoded.hubRole || decoded.role || ''
    const siteIds = Array.isArray(decoded.siteIds) ? decoded.siteIds.filter(Boolean) : []
    if (hubRole || siteIds.length || decoded.allowedApps) {
      req.craterUser = {
        username: decoded.username ?? null,
        hubRole: hubRole || 'Hub Viewer',
        jobRole: decoded.jobRole ?? null,
        primarySiteId: decoded.primarySiteId || decoded.siteId || siteIds[0] || null,
        siteIds,
        allowedApps: Array.isArray(decoded.allowedApps) ? decoded.allowedApps : [],
        canSeeAllSites: hubRole === 'Hub Admin' || hubRole === 'Corporate Admin',
      }
    }

    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
