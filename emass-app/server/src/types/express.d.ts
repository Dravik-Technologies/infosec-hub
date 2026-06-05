declare global {
  namespace Express {
    interface Request {
      userId?: string
      /** HUB identity claims decoded from the CRATER JWT (present for SSO-issued tokens). */
      craterUser?: {
        username: string | null
        hubRole: string
        jobRole: string | null
        primarySiteId: string | null
        siteIds: string[]
        allowedApps: string[]
        canSeeAllSites: boolean
      }
    }
  }
}

export {}
