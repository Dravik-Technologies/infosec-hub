'use strict';

const {
  SITE_OWNED_COLLECTIONS,
  GLOBAL_COLLECTIONS,
  normalizeSiteIds,
  getUserSiteScope,
  resolveTenantScope,
  applyScopeFilter,
  buildSiteWhere,
  assertSiteAccess,
  resolveWriteSiteId,
  isEnterpriseScopeRequest,
} = require('../lib/tenantScope');

// ── Collection classification ───���─────────────────────────────────────────────

describe('collection classification', () => {
  test('site-owned collections are declared', () => {
    const expected = [
      'facility_security', 'personnel_security', 'activities_security',
      'document_control', 'media_control', 'self_inspection_ops', 'security_findings',
    ];
    expected.forEach(c => expect(SITE_OWNED_COLLECTIONS.has(c)).toBe(true));
  });

  test('global collections are declared', () => {
    expect(GLOBAL_COLLECTIONS.has('security_workspace_settings')).toBe(true);
    expect(GLOBAL_COLLECTIONS.has('workspace_role_mappings')).toBe(true);
  });

  test('no collection appears in both sets', () => {
    for (const c of SITE_OWNED_COLLECTIONS) {
      expect(GLOBAL_COLLECTIONS.has(c)).toBe(false);
    }
  });
});

// ���─ getUserSiteScope ──────────────────────────────────────────��───────────────

describe('getUserSiteScope', () => {
  test('handles null user gracefully', () => {
    const s = getUserSiteScope(null);
    expect(s.siteId).toBeNull();
    expect(s.siteIds).toEqual([]);
    expect(s.canSeeAllSites).toBe(false);
  });

  test('normalizes lowercase HUB fields', () => {
    const s = getUserSiteScope({ siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], role: 'Viewer' });
    expect(s.siteId).toBe('MTSI-HVL');
    expect(s.siteIds).toEqual(['MTSI-HVL']);
  });

  test('normalizes legacy uppercase fields', () => {
    const s = getUserSiteScope({ siteID: 'MTSI-HVL', siteIDs: ['MTSI-HVL'], role: 'Viewer' });
    expect(s.siteId).toBe('MTSI-HVL');
    expect(s.siteIds).toContain('MTSI-HVL');
  });

  test('merges both without duplicates', () => {
    const s = getUserSiteScope({
      siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'],
      siteID: 'MTSI-HVL', siteIDs: ['MTSI-HVL'],
    });
    expect(s.siteIds).toEqual(['MTSI-HVL']);
  });

  test('canSeeAllSites true when flag is set', () => {
    const s = getUserSiteScope({ siteIds: ['MTSI-ALX'], canSeeAllSites: true });
    expect(s.canSeeAllSites).toBe(true);
  });

  test('canSeeAllSites true for Corporate Admin role (legacy fallback)', () => {
    const s = getUserSiteScope({ siteIds: ['MTSI-ALX'], role: 'Corporate Admin' });
    expect(s.canSeeAllSites).toBe(true);
  });

  test('canSeeAllSites false for regular user', () => {
    const s = getUserSiteScope({ siteIds: ['MTSI-HVL'], role: 'Viewer', canSeeAllSites: false });
    expect(s.canSeeAllSites).toBe(false);
  });
});

// ── resolveTenantScope ──────���─────────────────────────────────────────────────

function makeReq(user, query = {}) {
  return { user, query };
}

describe('resolveTenantScope', () => {
  test('single-site user returns mode:single', () => {
    const scope = resolveTenantScope(makeReq({ siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'] }));
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-HVL' });
  });

  test('single-site user requesting their site returns mode:single', () => {
    const scope = resolveTenantScope(
      makeReq({ siteIds: ['MTSI-HVL'] }, { siteId: 'MTSI-HVL' })
    );
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-HVL' });
  });

  test('single-site user requesting another site throws 403', () => {
    expect(() =>
      resolveTenantScope(makeReq({ siteIds: ['MTSI-HVL'] }, { siteId: 'MTSI-ALX' }))
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('multi-site user with no query returns mode:multi', () => {
    const scope = resolveTenantScope(
      makeReq({ siteIds: ['MTSI-ALX', 'MTSI-HVL'] })
    );
    expect(scope).toEqual({ mode: 'multi', siteIds: ['MTSI-ALX', 'MTSI-HVL'] });
  });

  test('multi-site user requesting allowed site returns mode:single', () => {
    const scope = resolveTenantScope(
      makeReq({ siteIds: ['MTSI-ALX', 'MTSI-HVL'] }, { siteId: 'MTSI-HVL' })
    );
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-HVL' });
  });

  test('multi-site user requesting unassigned site throws 403', () => {
    expect(() =>
      resolveTenantScope(makeReq({ siteIds: ['MTSI-HVL'] }, { siteId: 'MTSI-ZZZ' }))
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('enterprise user with no query returns mode:all', () => {
    const scope = resolveTenantScope(makeReq({ canSeeAllSites: true, siteIds: ['MTSI-ALX'] }));
    expect(scope).toEqual({ mode: 'all' });
  });

  test('enterprise user requesting specific site returns mode:single', () => {
    const scope = resolveTenantScope(
      makeReq({ canSeeAllSites: true, siteIds: ['MTSI-ALX'] }, { siteId: 'MTSI-HVL' })
    );
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-HVL' });
  });

  test('user with no sites throws 403', () => {
    expect(() => resolveTenantScope(makeReq({ siteIds: [] }))).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  test('null user throws 403', () => {
    expect(() => resolveTenantScope(makeReq(null))).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });
});

// ── applyScopeFilter ──���──────────────────────────────────���────────────────────

describe('applyScopeFilter', () => {
  const items = [
    { id: '1', siteId: 'MTSI-ALX', name: 'A' },
    { id: '2', siteId: 'MTSI-HVL', name: 'B' },
    { id: '3', siteId: 'MTSI-HVL', name: 'C' },
  ];

  test('mode:all returns all items', () => {
    expect(applyScopeFilter(items, { mode: 'all' })).toHaveLength(3);
  });

  test('mode:single filters to one site', () => {
    const result = applyScopeFilter(items, { mode: 'single', siteId: 'MTSI-HVL' });
    expect(result).toHaveLength(2);
    result.forEach(i => expect(i.siteId).toBe('MTSI-HVL'));
  });

  test('mode:multi filters to multiple sites', () => {
    const result = applyScopeFilter(items, { mode: 'multi', siteIds: ['MTSI-ALX'] });
    expect(result).toHaveLength(1);
    expect(result[0].siteId).toBe('MTSI-ALX');
  });

  test('mode:single with no matching items returns empty array', () => {
    expect(applyScopeFilter(items, { mode: 'single', siteId: 'MTSI-ZZZ' })).toHaveLength(0);
  });

  test('non-array input returned as-is', () => {
    expect(applyScopeFilter(null, { mode: 'single', siteId: 'MTSI-HVL' })).toBeNull();
  });

  test('Site A user cannot see Site B records', () => {
    const siteAItems = applyScopeFilter(items, { mode: 'single', siteId: 'MTSI-ALX' });
    siteAItems.forEach(i => expect(i.siteId).not.toBe('MTSI-HVL'));
  });
});

// ── buildSiteWhere ───────────��────────────���───────────────────────────────────

describe('buildSiteWhere', () => {
  test('mode:all returns base unchanged', () => {
    expect(buildSiteWhere({ mode: 'all' }, { status: 'Active' })).toEqual({ status: 'Active' });
  });

  test('mode:single adds siteId filter', () => {
    expect(buildSiteWhere({ mode: 'single', siteId: 'MTSI-HVL' }, {}))
      .toEqual({ siteId: 'MTSI-HVL' });
  });

  test('mode:multi adds siteId:in filter', () => {
    expect(buildSiteWhere({ mode: 'multi', siteIds: ['MTSI-ALX', 'MTSI-HVL'] }, {}))
      .toEqual({ siteId: { in: ['MTSI-ALX', 'MTSI-HVL'] } });
  });
});

// ── assertSiteAccess ──────────────────────────────────────────────────────────

describe('assertSiteAccess', () => {
  test('enterprise user can access any site', () => {
    expect(assertSiteAccess({ canSeeAllSites: true, siteIds: ['MTSI-ALX'] }, 'MTSI-HVL')).toBe(true);
    expect(assertSiteAccess({ canSeeAllSites: true, siteIds: ['MTSI-ALX'] }, 'UNKNOWN')).toBe(true);
  });

  test('user with matching siteId can access it', () => {
    expect(assertSiteAccess({ siteIds: ['MTSI-HVL'] }, 'MTSI-HVL')).toBe(true);
  });

  test('user without matching siteId cannot access it', () => {
    expect(assertSiteAccess({ siteIds: ['MTSI-HVL'] }, 'MTSI-ALX')).toBe(false);
  });

  test('returns false for null user', () => {
    expect(assertSiteAccess(null, 'MTSI-HVL')).toBe(false);
  });

  test('returns false for null siteId', () => {
    expect(assertSiteAccess({ siteIds: ['MTSI-HVL'] }, null)).toBe(false);
  });

  test('Site A user cannot access Site B', () => {
    const siteAUser = { siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX'], canSeeAllSites: false };
    expect(assertSiteAccess(siteAUser, 'MTSI-HVL')).toBe(false);
  });
});

// ── resolveWriteSiteId ────────���────────────────────────────────────���──────────

describe('resolveWriteSiteId', () => {
  function makeWriteReq(user, body = {}) {
    return { user, body };
  }

  test('uses body.siteId when user has access', () => {
    const req = makeWriteReq({ siteIds: ['MTSI-HVL'] }, { siteId: 'MTSI-HVL' });
    expect(resolveWriteSiteId(req)).toBe('MTSI-HVL');
  });

  test('falls back to user primary siteId', () => {
    const req = makeWriteReq({ siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'] }, {});
    expect(resolveWriteSiteId(req)).toBe('MTSI-HVL');
  });

  test('throws 403 when body siteId is out of user scope', () => {
    const req = makeWriteReq({ siteIds: ['MTSI-HVL'] }, { siteId: 'MTSI-ALX' });
    expect(() => resolveWriteSiteId(req)).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('throws 400 when no siteId can be resolved', () => {
    const req = makeWriteReq({ siteIds: [] }, {});
    expect(() => resolveWriteSiteId(req)).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('enterprise user can write to any site', () => {
    const req = makeWriteReq({ canSeeAllSites: true, siteIds: ['MTSI-ALX'] }, { siteId: 'MTSI-HVL' });
    expect(resolveWriteSiteId(req)).toBe('MTSI-HVL');
  });

  test('cross-site write by regular user is denied', () => {
    const req = makeWriteReq(
      { siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], canSeeAllSites: false },
      { siteId: 'MTSI-ALX' }
    );
    expect(() => resolveWriteSiteId(req)).toThrow(expect.objectContaining({ status: 403 }));
  });
});

// ── isEnterpriseScopeRequest ─────���────────────────────────────────────────────

describe('isEnterpriseScopeRequest', () => {
  test('enterprise user with no siteId param is enterprise scope', () => {
    const req = makeReq({ canSeeAllSites: true });
    expect(isEnterpriseScopeRequest(req)).toBe(true);
  });

  test('enterprise user with explicit siteId param is NOT enterprise scope', () => {
    const req = makeReq({ canSeeAllSites: true }, { siteId: 'MTSI-HVL' });
    expect(isEnterpriseScopeRequest(req)).toBe(false);
  });

  test('non-enterprise user is never enterprise scope', () => {
    const req = makeReq({ siteIds: ['MTSI-HVL'] });
    expect(isEnterpriseScopeRequest(req)).toBe(false);
  });
});

// ── normalizeSiteIds ──────────────────────────────────��───────────────────────

describe('normalizeSiteIds', () => {
  test('deduplicates', () => {
    expect(normalizeSiteIds('MTSI-HVL', 'MTSI-HVL', ['MTSI-HVL'])).toEqual(['MTSI-HVL']);
  });

  test('flattens arrays', () => {
    expect(normalizeSiteIds(['MTSI-ALX', 'MTSI-HVL'])).toEqual(['MTSI-ALX', 'MTSI-HVL']);
  });

  test('filters falsy values', () => {
    expect(normalizeSiteIds(null, undefined, '', 'MTSI-HVL')).toEqual(['MTSI-HVL']);
  });

  test('trims whitespace', () => {
    expect(normalizeSiteIds('  MTSI-HVL  ')).toEqual(['MTSI-HVL']);
  });
});
