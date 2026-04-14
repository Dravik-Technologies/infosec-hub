import type { BaselineProfile, ImpactLevel, ControlFamily } from '@/types'
import { CONTROL_CATALOG } from './controls'

// NIST SP 800-53B baseline: HIGH-WATER MARK rule (FIPS 199)
// The system's overall impact level = max(C, I, A)
export function computeBaseline(
  confidentiality: ImpactLevel,
  integrity: ImpactLevel,
  availability: ImpactLevel
): BaselineProfile {
  const rank = (level: ImpactLevel): number => {
    if (level === 'High') return 3
    if (level === 'Moderate') return 2
    if (level === 'Low') return 1
    return 0
  }
  const max = Math.max(rank(confidentiality), rank(integrity), rank(availability))
  if (max >= 3) return 'HIGH'
  if (max >= 2) return 'MODERATE'
  return 'LOW'
}

export function getControlIdsForBaseline(baseline: BaselineProfile): string[] {
  return CONTROL_CATALOG.filter(c => {
    if (baseline === 'HIGH') return c.highBaseline
    if (baseline === 'MODERATE') return c.moderateBaseline
    return c.lowBaseline
  }).map(c => c.id)
}

export function getEnhancementIdsForBaseline(baseline: BaselineProfile): string[] {
  const ids: string[] = []
  for (const control of CONTROL_CATALOG) {
    for (const enh of control.enhancements) {
      if (baseline === 'HIGH' && enh.highBaseline) ids.push(enh.id)
      else if (baseline === 'MODERATE' && enh.moderateBaseline) ids.push(enh.id)
      else if (baseline === 'LOW' && enh.lowBaseline) ids.push(enh.id)
    }
  }
  return ids
}

export function getBaselineLabel(baseline: BaselineProfile): string {
  switch (baseline) {
    case 'LOW': return 'NIST SP 800-53 Rev 5 — Low Baseline'
    case 'MODERATE': return 'NIST SP 800-53 Rev 5 — Moderate Baseline'
    case 'HIGH': return 'NIST SP 800-53 Rev 5 — High Baseline'
  }
}

export function getBaselineControlCount(baseline: BaselineProfile): number {
  return getControlIdsForBaseline(baseline).length
}

export function getDrivingFactor(
  confidentiality: ImpactLevel,
  integrity: ImpactLevel,
  availability: ImpactLevel
): 'Confidentiality' | 'Integrity' | 'Availability' {
  const rank = (level: ImpactLevel): number => {
    if (level === 'High') return 3
    if (level === 'Moderate') return 2
    if (level === 'Low') return 1
    return 0
  }
  const c = rank(confidentiality), i = rank(integrity), a = rank(availability)
  if (c >= i && c >= a) return 'Confidentiality'
  if (i >= a) return 'Integrity'
  return 'Availability'
}

export interface FamilyCoverage {
  family: ControlFamily
  total: number
  inBaseline: number
}

export function getFamilyCoverage(baseline: BaselineProfile): FamilyCoverage[] {
  const families = [...new Set(CONTROL_CATALOG.map(c => c.family))]
  return families.map(family => {
    const familyControls = CONTROL_CATALOG.filter(c => c.family === family)
    const inBaseline = familyControls.filter(c => {
      if (baseline === 'HIGH') return c.highBaseline
      if (baseline === 'MODERATE') return c.moderateBaseline
      return c.lowBaseline
    }).length
    return { family, total: familyControls.length, inBaseline }
  }).filter(f => f.inBaseline > 0)
}
