import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma/client'

type ImpactScore = 'LOW' | 'MODERATE' | 'HIGH'

interface InformationTypeResponse {
  id: string
  name: string
  family: string
  description: string
  confidentiality: ImpactScore
  integrity: ImpactScore
  availability: ImpactScore
}

// ─── Module-level cache ───────────────────────────────────────────────────────
// Null = not yet loaded. [] = loaded but empty (seed not run). Populated array = ready.
// Use `!== null` not truthiness — an empty array is truthy but still a valid cache hit.
let cache: InformationTypeResponse[] | null = null

function deriveImpact(low: boolean, mod: boolean, high: boolean): ImpactScore {
  if (high) return 'HIGH'
  if (mod) return 'MODERATE'
  return 'LOW'
}

export async function listInformationTypes(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  console.log('[GET /api/information-types] request received')

  try {
    if (cache !== null) {
      console.log(`[GET /api/information-types] returning ${cache.length} cached records`)
      res.json(cache)
      return
    }

    // 800-53 controls always have a dash in their controlId (e.g. AC-1, AU-2).
    // 800-60 information types use dot notation (c.2.1.1, hc.1.1, d.3.2, etc.) — no dash.
    console.log('[GET /api/information-types] querying DB...')
    const records = await prisma.control.findMany({
      where: {
        NOT: { controlId: { contains: '-' } },
      },
      select: {
        controlId:    true,
        family:       true,
        title:        true,
        description:  true,
        lowBaseline:  true,
        modBaseline:  true,
        highBaseline: true,
      },
      orderBy: [{ family: 'asc' }, { controlId: 'asc' }],
    })

    console.log(`[GET /api/information-types] DB returned ${records.length} records`)

    if (records.length === 0) {
      console.warn('[GET /api/information-types] WARNING: no information types found — has the seed been run?')
      console.warn('  Run: docker compose -f docker-compose.dev.yml exec backend npm run prisma:seed')
    }

    cache = records.map(r => {
      const impact = deriveImpact(r.lowBaseline, r.modBaseline, r.highBaseline)
      return {
        id:              r.controlId,
        name:            r.title,
        family:          r.family,
        description:     r.description,
        confidentiality: impact,
        integrity:       impact,
        availability:    impact,
      }
    })

    res.json(cache)
  } catch (err) {
    console.error('[GET /api/information-types] error:', err)
    next(err)
  }
}

// Call this to bust the cache if information types are re-seeded without a server restart.
export function clearInformationTypeCache(): void {
  cache = null
  console.log('[information-types] cache cleared')
}
