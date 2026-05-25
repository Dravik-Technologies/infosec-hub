'use strict';

/**
 * Unit tests for the backfillMashRelational.js field mappers and resolveSiteId logic.
 *
 * The script itself is not require()-able as a module (it has side-effects at
 * the module level — dotenv, DB, CLI arg parsing), so we extract and test the
 * pure mapping functions by reproducing them here.  Any change to the mapper
 * signatures in the script must be reflected here.
 */

// ── Reproduce pure helpers from the script ────────────────────────────────────

function makeResolveSiteId(map = {}) {
  return (raw) => {
    if (!raw) return null;
    return map[raw] ?? raw;
  };
}

// Minimal reproduce of mapPersonnel (only the fields under test)
function makeMapPersonnel(resolveSiteId) {
  return function mapPersonnel(r) {
    return {
      id:       r.id || 'generated',
      siteId:   resolveSiteId(r.siteId || r.siteID),
      username: r.username || null,
      name:     r.name || r.person || null,
    };
  };
}

// Minimal reproduce of mapMedia (only fields under test)
function makeMapMedia(resolveSiteId) {
  return function mapMedia(r) {
    return {
      id:         r.id || 'generated',
      siteId:     resolveSiteId(r.siteId || r.siteID),
      mediaId:    r.mediaId || r.media_id || null,
      capacityGB: r.capacityGB ?? r.capacityGb ?? r.capacity_gb ?? null,
    };
  };
}

// Minimal reproduce of mapFacility (siteId only)
function makeMapFacility(resolveSiteId) {
  return function mapFacility(r) {
    return {
      id:    r.id || 'generated',
      siteId: resolveSiteId(r.siteId || r.siteID),
      name:  r.name || null,
    };
  };
}

// ── resolveSiteId ─────────────────────────────────────────────────────────────
describe('resolveSiteId', () => {
  test('returns null for null/undefined input', () => {
    const resolve = makeResolveSiteId({});
    expect(resolve(null)).toBeNull();
    expect(resolve(undefined)).toBeNull();
    expect(resolve('')).toBeNull();
  });

  test('maps a legacy ID to its real value', () => {
    const resolve = makeResolveSiteId({ 'site-001': 'cm_real_abc' });
    expect(resolve('site-001')).toBe('cm_real_abc');
  });

  test('passes through an unknown ID unchanged (not in map)', () => {
    const resolve = makeResolveSiteId({ 'site-001': 'cm_real_abc' });
    expect(resolve('cm_already_real')).toBe('cm_already_real');
  });

  test('empty map is a pass-through for all values', () => {
    const resolve = makeResolveSiteId({});
    expect(resolve('lincolnia-hq')).toBe('lincolnia-hq');
  });
});

// ── validSiteIds preflight check (simulated) ──────────────────────────────────
describe('site ID validation logic', () => {
  // Simulate the check that backfillDomain now performs:
  // after resolving, verify the result exists in validSiteIds Set.
  function isValidSite(resolvedId, validSiteIds) {
    return resolvedId && validSiteIds.has(resolvedId);
  }

  const validSiteIds = new Set(['cm_real_abc', 'cm_real_def']);

  test('resolved ID in valid set is accepted', () => {
    expect(isValidSite('cm_real_abc', validSiteIds)).toBe(true);
  });

  test('unmapped legacy ID not in valid set is rejected', () => {
    expect(isValidSite('site-001', validSiteIds)).toBe(false);
  });

  test('mapped ID that resolves to a real value is accepted', () => {
    const resolve = makeResolveSiteId({ 'site-001': 'cm_real_abc' });
    expect(isValidSite(resolve('site-001'), validSiteIds)).toBe(true);
  });

  test('mapped ID that resolves to a wrong value is rejected', () => {
    const resolve = makeResolveSiteId({ 'site-001': 'cm_wrong_id' });
    expect(isValidSite(resolve('site-001'), validSiteIds)).toBe(false);
  });

  test('null resolvedId is rejected', () => {
    expect(isValidSite(null, validSiteIds)).toBeFalsy();
  });
});

// ── mapPersonnel name/person fallback ─────────────────────────────────────────
describe('mapPersonnel name fallback', () => {
  const mapPersonnel = makeMapPersonnel(makeResolveSiteId({}));

  test('uses name when present', () => {
    expect(mapPersonnel({ name: 'Alice', siteId: 's1' }).name).toBe('Alice');
  });

  test('falls back to person when name is absent', () => {
    expect(mapPersonnel({ person: 'Bob', siteId: 's1' }).name).toBe('Bob');
  });

  test('returns null when neither name nor person', () => {
    expect(mapPersonnel({ siteId: 's1' }).name).toBeNull();
  });

  test('prefers name over person when both present', () => {
    expect(mapPersonnel({ name: 'Alice', person: 'Bob', siteId: 's1' }).name).toBe('Alice');
  });
});

// ── mapPersonnel siteId resolution ────────────────────────────────────────────
describe('mapPersonnel siteId via resolveSiteId', () => {
  test('translates legacy siteId through map', () => {
    const mapPersonnel = makeMapPersonnel(makeResolveSiteId({ 'site-001': 'cm_real' }));
    expect(mapPersonnel({ name: 'Alice', siteId: 'site-001' }).siteId).toBe('cm_real');
  });

  test('passes through already-real siteId', () => {
    const mapPersonnel = makeMapPersonnel(makeResolveSiteId({}));
    expect(mapPersonnel({ name: 'Alice', siteId: 'cm_real' }).siteId).toBe('cm_real');
  });

  test('handles siteID (uppercase D) variant', () => {
    const mapPersonnel = makeMapPersonnel(makeResolveSiteId({ 'site-001': 'cm_real' }));
    expect(mapPersonnel({ name: 'Alice', siteID: 'site-001' }).siteId).toBe('cm_real');
  });

  test('returns null when no siteId/siteID field', () => {
    const mapPersonnel = makeMapPersonnel(makeResolveSiteId({}));
    expect(mapPersonnel({ name: 'Alice' }).siteId).toBeNull();
  });
});

// ── mapMedia field names ───────────────────────────────────────────────────────
describe('mapMedia field names', () => {
  const mapMedia = makeMapMedia(makeResolveSiteId({}));

  test('capacityGB reads capacityGB (Prisma field name)', () => {
    expect(mapMedia({ id: 'm1', siteId: 's1', capacityGB: 32 }).capacityGB).toBe(32);
  });

  test('capacityGB falls back to legacy capacityGb', () => {
    expect(mapMedia({ id: 'm1', siteId: 's1', capacityGb: 16 }).capacityGB).toBe(16);
  });

  test('capacityGB falls back to snake_case capacity_gb', () => {
    expect(mapMedia({ id: 'm1', siteId: 's1', capacity_gb: 8 }).capacityGB).toBe(8);
  });

  test('capacityGB is null when absent', () => {
    expect(mapMedia({ id: 'm1', siteId: 's1' }).capacityGB).toBeNull();
  });
});

// ── mapFacility siteId resolution ─────────────────────────────────────────────
describe('mapFacility siteId', () => {
  test('translates legacy IDs from all known seed values', () => {
    const legacyIds = ['site-001', 'site-002', 'lincolnia-hq', 'maryland-warehouse'];
    const map = Object.fromEntries(legacyIds.map((id, i) => [id, `cm_real_${i}`]));
    const mapFacility = makeMapFacility(makeResolveSiteId(map));

    for (const [i, legacy] of legacyIds.entries()) {
      const result = mapFacility({ id: `f${i}`, name: 'Test', siteId: legacy });
      expect(result.siteId).toBe(`cm_real_${i}`);
    }
  });
});
