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
    const s = getUserSiteScope({ siteId: 'MTSI-OH', siteIds: ['MTSI-OH'], role: 'Viewer' });
    expect(s.siteId).toBe('MTSI-OH');
    expect(s.siteIds).toEqual(['MTSI-OH']);
  });

  test('normalizes legacy uppercase fields', () => {
    const s = getUserSiteScope({ siteID: 'MTSI-OH', siteIDs: ['MTSI-OH'], role: 'Viewer' });
    expect(s.siteId).toBe('MTSI-OH');
    expect(s.siteIds).toContain('MTSI-OH');
  });

  test('merges both without duplicates', () => {
    const s = getUserSiteScope({
      siteId: 'MTSI-OH', siteIds: ['MTSI-OH'],
      siteID: 'MTSI-OH', siteIDs: ['MTSI-OH'],
    });
    expect(s.siteIds).toEqual(['MTSI-OH']);
  });

  test('canSeeAllSites true when flag is set', () => {
    const s = getUserSiteScope({ siteIds: ['MTSI-VA'], canSeeAllSites: true });
    expect(s.canSeeAllSites).toBe(true);
  });

  test('canSeeAllSites true for Corporate Admin role (legacy fallback)', () => {
    const s = getUserSiteScope({ siteIds: ['MTSI-VA'], role: 'Corporate Admin' });
    expect(s.canSeeAllSites).toBe(true);
  });

  test('canSeeAllSites false for regular user', () => {
    const s = getUserSiteScope({ siteIds: ['MTSI-OH'], role: 'Viewer', canSeeAllSites: false });
    expect(s.canSeeAllSites).toBe(false);
  });
});

// ── resolveTenantScope ──────���─────────────────────────────────────────────────

function makeReq(user, query = {}) {
  return { user, query };
}

describe('resolveTenantScope', () => {
  test('single-site user returns mode:single', () => {
    const scope = resolveTenantScope(makeReq({ siteId: 'MTSI-OH', siteIds: ['MTSI-OH'] }));
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-OH' });
  });

  test('single-site user requesting their site returns mode:single', () => {
    const scope = resolveTenantScope(
      makeReq({ siteIds: ['MTSI-OH'] }, { siteId: 'MTSI-OH' })
    );
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-OH' });
  });

  test('single-site user requesting another site throws 403', () => {
    expect(() =>
      resolveTenantScope(makeReq({ siteIds: ['MTSI-OH'] }, { siteId: 'MTSI-VA' }))
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('multi-site user with no query returns mode:multi', () => {
    const scope = resolveTenantScope(
      makeReq({ siteIds: ['MTSI-VA', 'MTSI-OH'] })
    );
    expect(scope).toEqual({ mode: 'multi', siteIds: ['MTSI-VA', 'MTSI-OH'] });
  });

  test('multi-site user requesting allowed site returns mode:single', () => {
    const scope = resolveTenantScope(
      makeReq({ siteIds: ['MTSI-VA', 'MTSI-OH'] }, { siteId: 'MTSI-OH' })
    );
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-OH' });
  });

  test('multi-site user requesting unassigned site throws 403', () => {
    expect(() =>
      resolveTenantScope(makeReq({ siteIds: ['MTSI-OH'] }, { siteId: 'MTSI-ZZZ' }))
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('enterprise user with no query returns mode:all', () => {
    const scope = resolveTenantScope(makeReq({ canSeeAllSites: true, siteIds: ['MTSI-VA'] }));
    expect(scope).toEqual({ mode: 'all' });
  });

  test('enterprise user requesting specific site returns mode:single', () => {
    const scope = resolveTenantScope(
      makeReq({ canSeeAllSites: true, siteIds: ['MTSI-VA'] }, { siteId: 'MTSI-OH' })
    );
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-OH' });
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
    { id: '1', siteId: 'MTSI-VA', name: 'A' },
    { id: '2', siteId: 'MTSI-OH', name: 'B' },
    { id: '3', siteId: 'MTSI-OH', name: 'C' },
  ];

  test('mode:all returns all items', () => {
    expect(applyScopeFilter(items, { mode: 'all' })).toHaveLength(3);
  });

  test('mode:single filters to one site', () => {
    const result = applyScopeFilter(items, { mode: 'single', siteId: 'MTSI-OH' });
    expect(result).toHaveLength(2);
    result.forEach(i => expect(i.siteId).toBe('MTSI-OH'));
  });

  test('mode:multi filters to multiple sites', () => {
    const result = applyScopeFilter(items, { mode: 'multi', siteIds: ['MTSI-VA'] });
    expect(result).toHaveLength(1);
    expect(result[0].siteId).toBe('MTSI-VA');
  });

  test('mode:single with no matching items returns empty array', () => {
    expect(applyScopeFilter(items, { mode: 'single', siteId: 'MTSI-ZZZ' })).toHaveLength(0);
  });

  test('non-array input returned as-is', () => {
    expect(applyScopeFilter(null, { mode: 'single', siteId: 'MTSI-OH' })).toBeNull();
  });

  test('Site A user cannot see Site B records', () => {
    const siteAItems = applyScopeFilter(items, { mode: 'single', siteId: 'MTSI-VA' });
    siteAItems.forEach(i => expect(i.siteId).not.toBe('MTSI-OH'));
  });
});

// ── buildSiteWhere ───────────��────────────���───────────────────────────────────

describe('buildSiteWhere', () => {
  test('mode:all returns base unchanged', () => {
    expect(buildSiteWhere({ mode: 'all' }, { status: 'Active' })).toEqual({ status: 'Active' });
  });

  test('mode:single adds siteId filter', () => {
    expect(buildSiteWhere({ mode: 'single', siteId: 'MTSI-OH' }, {}))
      .toEqual({ siteId: 'MTSI-OH' });
  });

  test('mode:multi adds siteId:in filter', () => {
    expect(buildSiteWhere({ mode: 'multi', siteIds: ['MTSI-VA', 'MTSI-OH'] }, {}))
      .toEqual({ siteId: { in: ['MTSI-VA', 'MTSI-OH'] } });
  });
});

// ── assertSiteAccess ──────────────────────────────────────────────────────────

describe('assertSiteAccess', () => {
  test('enterprise user can access any site', () => {
    expect(assertSiteAccess({ canSeeAllSites: true, siteIds: ['MTSI-VA'] }, 'MTSI-OH')).toBe(true);
    expect(assertSiteAccess({ canSeeAllSites: true, siteIds: ['MTSI-VA'] }, 'UNKNOWN')).toBe(true);
  });

  test('user with matching siteId can access it', () => {
    expect(assertSiteAccess({ siteIds: ['MTSI-OH'] }, 'MTSI-OH')).toBe(true);
  });

  test('user without matching siteId cannot access it', () => {
    expect(assertSiteAccess({ siteIds: ['MTSI-OH'] }, 'MTSI-VA')).toBe(false);
  });

  test('returns false for null user', () => {
    expect(assertSiteAccess(null, 'MTSI-OH')).toBe(false);
  });

  test('returns false for null siteId', () => {
    expect(assertSiteAccess({ siteIds: ['MTSI-OH'] }, null)).toBe(false);
  });

  test('Site A user cannot access Site B', () => {
    const siteAUser = { siteId: 'MTSI-VA', siteIds: ['MTSI-VA'], canSeeAllSites: false };
    expect(assertSiteAccess(siteAUser, 'MTSI-OH')).toBe(false);
  });
});

// ── resolveWriteSiteId ────────���────────────────────────────────────���──────────

describe('resolveWriteSiteId', () => {
  function makeWriteReq(user, body = {}) {
    return { user, body };
  }

  test('uses body.siteId when user has access', () => {
    const req = makeWriteReq({ siteIds: ['MTSI-OH'] }, { siteId: 'MTSI-OH' });
    expect(resolveWriteSiteId(req)).toBe('MTSI-OH');
  });

  test('throws 400 when body.siteId is omitted even if user has a primary site', () => {
    const req = makeWriteReq({ siteId: 'MTSI-OH', siteIds: ['MTSI-OH'] }, {});
    expect(() => resolveWriteSiteId(req)).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('throws 403 when body siteId is out of user scope', () => {
    const req = makeWriteReq({ siteIds: ['MTSI-OH'] }, { siteId: 'MTSI-VA' });
    expect(() => resolveWriteSiteId(req)).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('throws 400 when no siteId can be resolved', () => {
    const req = makeWriteReq({ siteIds: [] }, {});
    expect(() => resolveWriteSiteId(req)).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('enterprise user can write to any site', () => {
    const req = makeWriteReq({ canSeeAllSites: true, siteIds: ['MTSI-VA'] }, { siteId: 'MTSI-OH' });
    expect(resolveWriteSiteId(req)).toBe('MTSI-OH');
  });

  test('cross-site write by regular user is denied', () => {
    const req = makeWriteReq(
      { siteId: 'MTSI-OH', siteIds: ['MTSI-OH'], canSeeAllSites: false },
      { siteId: 'MTSI-VA' }
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
    const req = makeReq({ canSeeAllSites: true }, { siteId: 'MTSI-OH' });
    expect(isEnterpriseScopeRequest(req)).toBe(false);
  });

  test('non-enterprise user is never enterprise scope', () => {
    const req = makeReq({ siteIds: ['MTSI-OH'] });
    expect(isEnterpriseScopeRequest(req)).toBe(false);
  });
});

// ── normalizeSiteIds ──────────────────────────────────��───────────────────────

describe('normalizeSiteIds', () => {
  test('deduplicates', () => {
    expect(normalizeSiteIds('MTSI-OH', 'MTSI-OH', ['MTSI-OH'])).toEqual(['MTSI-OH']);
  });

  test('flattens arrays', () => {
    expect(normalizeSiteIds(['MTSI-VA', 'MTSI-OH'])).toEqual(['MTSI-VA', 'MTSI-OH']);
  });

  test('filters falsy values', () => {
    expect(normalizeSiteIds(null, undefined, '', 'MTSI-OH')).toEqual(['MTSI-OH']);
  });

  test('trims whitespace', () => {
    expect(normalizeSiteIds('  MTSI-OH  ')).toEqual(['MTSI-OH']);
  });
});
