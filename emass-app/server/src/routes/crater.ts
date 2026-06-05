import { Router } from 'express'
import type { Request } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { TECHNICAL_LIBRARY } from '../lib/technicalSeed'

const router = Router()

// Local types — Prisma client is @ts-ignore imported so we cast query results
interface StdLibEntry {
  controlId: string
  controlTitle: string
  family: string
  implementationStatement: string | null
  implementationOrigin: string
  tailoringRequired: boolean
}

interface PgControl {
  id: string
  projectSystemId: string
  controlId: string
  controlTitle: string
  family: string
  status: string
  implementationStatement: string | null
  standardText: string | null
  autoFilled: boolean
  tailoringRequired: boolean
  implementationOrigin: string
  evidenceLinks: string[]
  assessorNotes: string | null
  validatedAt: Date | null
  validatedBy: string | null
  siteId: string
}

// Module-level guard so auto-seed only runs once per process lifetime
let _librarySeedChecked = false

async function ensureLibrarySeeded() {
  if (_librarySeedChecked) return
  _librarySeedChecked = true
  const count = await prisma.standardLibrary.count()
  if (count === 0) {
    await prisma.standardLibrary.createMany({
      data: TECHNICAL_LIBRARY,
      skipDuplicates: true,
    })
    console.log(`[CRATER] Auto-seeded StandardLibrary with ${TECHNICAL_LIBRARY.length} technical entries`)
  }
}

/**
 * Verify the caller may access a given siteId.
 * Hub Admins and Corporate Admins (canSeeAllSites) are unrestricted.
 * For all others, the siteId must be in their allowed siteIds list.
 * Returns false for legacy local-auth tokens that carry no HUB claims.
 */
function assertSiteAccess(req: Request, siteId: string | null | undefined): boolean {
  const u = req.craterUser
  if (!u) return false  // no HUB claims — legacy local-auth token; cannot verify scope
  if (u.canSeeAllSites) return true
  if (siteId == null) return true  // null siteId = enterprise-wide record
  return u.siteIds.includes(siteId)
}

// ── POST /api/crater/hydrate ──────────────────────────────────────────────────
// Creates a ProjectSystem and auto-fills ProjectControls from StandardLibrary.
router.post('/hydrate', requireAuth, async (req, res) => {
  try {
    await ensureLibrarySeeded()

    const {
      externalId, name, abbreviation, systemType = 'Major Application',
      organization, description, classificationMarking,
      systemOwner, isso, issm,
      confidentiality = 'Low', integrity = 'Low', availability = 'Low',
      baseline, controlIds, siteId,
    } = req.body

    if (!name || !baseline || !Array.isArray(controlIds) || !siteId) {
      res.status(400).json({ error: 'name, baseline, controlIds[], and siteId are required' })
      return
    }

    if (!assertSiteAccess(req, siteId)) {
      res.status(403).json({ error: 'Access denied — siteId is outside your allowed site scope' })
      return
    }

    await prisma.site.upsert({
      where: { id: siteId },
      create: { id: siteId, label: siteId },
      update: {},
    })

    const projectSystem = await prisma.projectSystem.upsert({
      where: { externalId: externalId ?? '__none__' },
      create: {
        externalId: externalId ?? undefined,
        name, abbreviation, systemType, organization, description,
        classificationMarking, systemOwner, isso, issm,
        confidentiality, integrity, availability, baseline, siteId,
      },
      update: {
        baseline, confidentiality, integrity, availability,
        name, abbreviation, organization,
      },
    })

    const libraryEntries = await prisma.standardLibrary.findMany({
      where: { controlId: { in: controlIds } },
    }) as StdLibEntry[]
    const libMap = new Map<string, StdLibEntry>(libraryEntries.map(e => [e.controlId, e]))

    const insertData = controlIds.map((controlId: string) => {
      const lib = libMap.get(controlId)
      const family = controlId.split('-')[0]
      return {
        projectSystemId: projectSystem.id,
        controlId,
        controlTitle: lib?.controlTitle ?? controlId,
        family: lib?.family ?? family,
        standardText: lib?.implementationStatement ?? null,
        implementationStatement: lib?.implementationStatement ?? null,
        autoFilled: !!lib?.implementationStatement,
        tailoringRequired: lib?.tailoringRequired ?? true,
        implementationOrigin: lib?.implementationOrigin ?? 'System Specific',
        siteId,
      }
    })

    await prisma.projectControl.createMany({
      data: insertData,
      skipDuplicates: true,
    })

    const allControls = await prisma.projectControl.findMany({
      where: { projectSystemId: projectSystem.id },
      orderBy: { controlId: 'asc' },
    }) as PgControl[]

    const autoFilled = allControls.filter((c: PgControl) => c.autoFilled).length
    const tailoringRequired = allControls.filter((c: PgControl) => c.tailoringRequired).length

    res.json({
      projectSystem,
      controls: allControls,
      summary: { total: allControls.length, autoFilled, tailoringRequired },
    })
  } catch (err: any) {
    console.error('[CRATER] hydrate error:', err)
    res.status(500).json({ error: err.message ?? 'Hydration failed' })
  }
})

// ── GET /api/crater/systems/:externalId/controls ──────────────────────────────
router.get('/systems/:externalId/controls', requireAuth, async (req, res) => {
  try {
    const { externalId } = req.params
    const system = await prisma.projectSystem.findFirst({ where: { externalId } })
    if (!system) {
      res.status(404).json({ error: 'Project system not found. Run categorization first.' })
      return
    }
    if (!assertSiteAccess(req, system.siteId)) {
      res.status(403).json({ error: 'Access denied — system is outside your allowed site scope' })
      return
    }
    const controls = await prisma.projectControl.findMany({
      where: { projectSystemId: system.id },
      orderBy: { controlId: 'asc' },
    }) as PgControl[]
    const autoFilled = controls.filter((c: PgControl) => c.autoFilled).length
    const tailoringRequired = controls.filter((c: PgControl) => c.tailoringRequired).length
    const validated = controls.filter((c: PgControl) => c.validatedAt !== null).length
    res.json({
      system,
      controls,
      summary: { total: controls.length, autoFilled, tailoringRequired, validated },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch controls' })
  }
})

// ── PUT /api/crater/systems/:externalId/controls/:controlId ──────────────────
// Supports normal updates AND assessor sign-off (validatedAt/validatedBy)
router.put('/systems/:externalId/controls/:controlId', requireAuth, async (req, res) => {
  try {
    const { externalId, controlId } = req.params
    const {
      status, implementationStatement, assessorNotes,
      validatedAt, validatedBy,
    } = req.body

    const system = await prisma.projectSystem.findFirst({ where: { externalId } })
    if (!system) {
      res.status(404).json({ error: 'Project system not found' })
      return
    }
    if (!assertSiteAccess(req, system.siteId)) {
      res.status(403).json({ error: 'Access denied — system is outside your allowed site scope' })
      return
    }

    const updated = await prisma.projectControl.update({
      where: { projectSystemId_controlId: { projectSystemId: system.id, controlId } },
      data: {
        ...(status !== undefined && { status }),
        ...(implementationStatement !== undefined && { implementationStatement }),
        ...(assessorNotes !== undefined && { assessorNotes }),
        ...(validatedAt !== undefined && { validatedAt: validatedAt ? new Date(validatedAt) : null }),
        ...(validatedBy !== undefined && { validatedBy }),
        // Auto-mark tailoringRequired = false when implementation is provided
        ...(implementationStatement && { tailoringRequired: false }),
      },
    })
    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to update control' })
  }
})

// ── GET /api/crater/assets ────────────────────────────────────────────────────
// Returns site-isolated workstations from the shared PostgreSQL DB (SCORVA asset table)
router.get('/assets', requireAuth, async (req, res) => {
  try {
    const siteId = req.query.siteId as string
    if (!siteId) {
      res.status(400).json({ error: 'siteId query parameter is required' })
      return
    }
    if (!assertSiteAccess(req, siteId)) {
      res.status(403).json({ error: 'Access denied — siteId is outside your allowed site scope' })
      return
    }
    const assets = await prisma.workstation.findMany({
      where: { siteId },
      orderBy: { hostname: 'asc' },
      select: {
        id: true,
        assetTag: true,
        hostname: true,
        type: true,
        os: true,
        ip: true,
        location: true,
        classification: true,
        status: true,
        system: true,
        lastSeen: true,
        username: true,
      },
    })
    res.json({ assets, total: assets.length })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch assets' })
  }
})

// ── POST /api/crater/auto-seed ────────────────────────────────────────────────
// Admin: force re-seed the StandardLibrary with technical implementations
router.post('/auto-seed', requireAuth, async (req, res) => {
  try {
    let upserted = 0
    for (const entry of TECHNICAL_LIBRARY) {
      await prisma.standardLibrary.upsert({
        where: { controlId: entry.controlId },
        create: entry,
        update: {
          controlTitle: entry.controlTitle,
          implementationStatement: entry.implementationStatement,
          implementationOrigin: entry.implementationOrigin,
          tailoringRequired: entry.tailoringRequired,
        },
      })
      upserted++
    }
    _librarySeedChecked = true
    res.json({ upserted, total: TECHNICAL_LIBRARY.length })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Auto-seed failed' })
  }
})

// ── POST /api/crater/seed-library ─────────────────────────────────────────────
// Dev/admin: seed StandardLibrary from uploaded JSON payload
router.post('/seed-library', requireAuth, async (req, res) => {
  try {
    const { entries } = req.body as {
      entries: Array<{
        controlId: string
        controlTitle: string
        family: string
        implementationStatement: string
        implementationOrigin: string
        tailoringRequired: boolean
      }>
    }
    if (!Array.isArray(entries)) {
      res.status(400).json({ error: 'entries[] array required' })
      return
    }
    let upserted = 0
    for (const entry of entries) {
      await prisma.standardLibrary.upsert({
        where: { controlId: entry.controlId },
        create: entry,
        update: {
          controlTitle: entry.controlTitle,
          implementationStatement: entry.implementationStatement,
          implementationOrigin: entry.implementationOrigin,
          tailoringRequired: entry.tailoringRequired,
        },
      })
      upserted++
    }
    res.json({ upserted })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Seed failed' })
  }
})

export default router
