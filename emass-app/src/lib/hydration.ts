import type { BaselineProfile, SCTMEntry } from '@/types'
import { DEFAULT_IMPLEMENTATIONS } from '@/data/defaultImplementations'
import { getControlIdsForBaseline } from '@/data/baselines'

export interface HydrationResult {
  hydrated: number
  skipped: number
  needsSiteSpecific: string[]
}

export function getStandardImplementation(controlId: string): string {
  return DEFAULT_IMPLEMENTATIONS[controlId]?.implementationStatement ?? ''
}

/** Controls that shipped with "System Specific" or "Hybrid" origin need site tailoring. */
export function controlNeedsTailoring(controlId: string): boolean {
  const impl = DEFAULT_IMPLEMENTATIONS[controlId]
  if (!impl) return false
  return impl.implementationOrigin === 'System Specific' || impl.implementationOrigin === 'Hybrid'
}

/** Returns list of control IDs in the baseline that still need site-specific input. */
export function getUntailoredControls(
  baseline: BaselineProfile,
  entries: SCTMEntry[],
): string[] {
  const baselineIds = new Set(getControlIdsForBaseline(baseline))
  return entries
    .filter((e) => {
      if (!baselineIds.has(e.controlId)) return false
      if (!controlNeedsTailoring(e.controlId)) return false
      const standard = getStandardImplementation(e.controlId)
      const current = e.implementationStatement ?? ''
      const strip = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      return strip(current) === strip(standard) || strip(current).length === 0
    })
    .map((e) => e.controlId)
}

/** Returns readiness score (0-100) weighted by control criticality. */
export function computeReadinessScore(entries: SCTMEntry[]): number {
  if (entries.length === 0) return 0
  const weights: Record<string, number> = {
    'Implemented': 1.0,
    'Inherited': 1.0,
    'Not Applicable': 1.0,
    'Partially Implemented': 0.5,
    'Planned': 0.25,
    'Under Review': 0.15,
    'Not Implemented': 0,
  }
  const total = entries.reduce((sum, e) => sum + (weights[e.status] ?? 0), 0)
  return Math.round((total / entries.length) * 100)
}
