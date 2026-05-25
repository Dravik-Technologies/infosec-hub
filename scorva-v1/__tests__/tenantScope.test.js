'use strict';

const {
  normalizeSiteIds,
  getUserSiteScope,
  resolveTenantScope,
  buildSiteWhere,
  assertSiteAccess,
  assertDocumentAccess,
  isEnterpriseScopeRequest,
  resolveWriteSiteId,
} = require('../server/lib/tenantScope');

// ── getUserSiteScope ───────────────────���──────────────────────────────────────

describe('getUserSiteScope', () => {
  test('handles null user gracefully', () => {
    const s = getUserSiteScope(null);
    expect(s.siteId).toBeNull();
    expect(s.siteIds).toEqual([]);
    expect(s.canSeeAllSites).toBe(false);
    expect(s.securityRole).toBeNull();
  });

  test('normalizes lowercase HUB fields (siteId / siteIds)', () => {
    const s = getUserSiteScope({ siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], role: 'Viewer' });
    expect(s.siteId).toBe('MTSI-HVL');
    expect(s.siteIds).toEqual(['MTSI-HVL']);
    expect(s.canSeeAllSites).toBe(false);
  });

  test('normalizes legacy uppercase fields (siteID / siteIDs)', () => {
    const s = getUserSiteScope({ siteID: 'MTSI-HVL', siteIDs: ['MTSI-HVL'], role: 'Viewer' });
    expect(s.siteId).toBe('MTSI-HVL');
    expect(s.siteIds).toContain('MTSI-HVL');
  });

  test('merges uppercase and lowercase without duplicates', () => {
    const s = getUserSiteScope({
      siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'],
      siteID: 'MTSI-HVL', siteIDs: ['MTSI-HVL'],
    });
    expect(s.siteIds).toEqual(['MTSI-HVL']);
  });

  test('multi-site user has all sites in siteIds', () => {
    const s = getUserSiteScope({ siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX', 'MTSI-HVL'], role: 'Viewer' });
    expect(s.siteIds).toEqual(['MTSI-ALX', 'MTSI-HVL']);
  });

  test('canSeeAllSites true when explicit flag is set', () => {
    const s = getUserSiteScope({ siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX'], canSeeAllSites: true, role: 'Viewer' });
    expect(s.canSeeAllSites).toBe(true);
  });

  test('canSeeAllSites true for Corporate Admin role (legacy token fallback)', () => {
    const s = getUserSiteScope({ siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX'], role: 'Corporate Admin' });
    expect(s.canSeeAllSites).toBe(true);
  });

  test('canSeeAllSites false for regular security role user', () => {
    const s = getUserSiteScope({
      siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'],
      role: 'Viewer', securityRole: 'Facility Security',
    });
    expect(s.canSeeAllSites).toBe(false);
  });

  test('propagates securityRole', () => {
    const s = getUserSiteScope({ securityRole: 'Information Security' });
    expect(s.securityRole).toBe('Information Security');
  });
});

// ── resolveTenantScope ───────────────────────���────────────────────────────────

function makeReq(user, query = {}) {
  return { user, query };
}

describe('resolveTenantScope', () => {
  test('single-site user with no query returns mode:single for their site', () => {
    const req = makeReq({ siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], role: 'Viewer' });
    const scope = resolveTenantScope(req);
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-HVL' });
  });

  test('single-site user requesting their own site returns mode:single', () => {
    const req = makeReq(
      { siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], role: 'Viewer' },
      { siteId: 'MTSI-HVL' }
    );
    const scope = resolveTenantScope(req);
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-HVL' });
  });

  test('single-site user requesting a different site throws 403', () => {
    const req = makeReq(
      { siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], role: 'Viewer' },
      { siteId: 'MTSI-ALX' }
    );
    expect(() => resolveTenantScope(req)).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('multi-site user with no query returns mode:multi', () => {
    const req = makeReq({ siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX', 'MTSI-HVL'], role: 'Viewer' });
    const scope = resolveTenantScope(req);
    expect(scope).toEqual({ mode: 'multi', siteIds: ['MTSI-ALX', 'MTSI-HVL'] });
  });

  test('multi-site user requesting an allowed site returns mode:single', () => {
    const req = makeReq(
      { siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX', 'MTSI-HVL'], role: 'Viewer' },
      { siteId: 'MTSI-HVL' }
    );
    const scope = resolveTenantScope(req);
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-HVL' });
  });

  test('multi-site user requesting an unassigned site throws 403', () => {
    const req = makeReq(
      { siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX', 'MTSI-HVL'], role: 'Viewer' },
      { siteId: 'MTSI-ZZZ' }
    );
    expect(() => resolveTenantScope(req)).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('enterprise user with no query returns mode:all', () => {
    const req = makeReq({ siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX'], canSeeAllSites: true });
    const scope = resolveTenantScope(req);
    expect(scope).toEqual({ mode: 'all' });
  });

  test('enterprise user requesting a specific site returns mode:single', () => {
    const req = makeReq(
      { siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX'], canSeeAllSites: true },
      { siteId: 'MTSI-HVL' }
    );
    const scope = resolveTenantScope(req);
    expect(scope).toEqual({ mode: 'single', siteId: 'MTSI-HVL' });
  });

  test('user with no sites throws 403', () => {
    const req = makeReq({ role: 'Viewer', siteIds: [] });
    expect(() => resolveTenantScope(req)).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('null user throws 403', () => {
    const req = makeReq(null);
    expect(() => resolveTenantScope(req)).toThrow(expect.objectContaining({ status: 403 }));
  });
});

// ── buildSiteWhere ─────────────────────────��───────────────────────────��──────

describe('buildSiteWhere', () => {
  test('mode:all returns base clause unchanged', () => {
    const where = buildSiteWhere({ mode: 'all' }, { status: 'Active' });
    expect(where).toEqual({ status: 'Active' });
  });

  test('mode:single adds siteId filter', () => {
    const where = buildSiteWhere({ mode: 'single', siteId: 'MTSI-HVL' }, { status: 'Active' });
    expect(where).toEqual({ status: 'Active', siteId: 'MTSI-HVL' });
  });

  test('mode:multi adds siteId:in filter', () => {
    const where = buildSiteWhere({ mode: 'multi', siteIds: ['MTSI-ALX', 'MTSI-HVL'] }, {});
    expect(where).toEqual({ siteId: { in: ['MTSI-ALX', 'MTSI-HVL'] } });
  });

  test('works with no base clause', () => {
    const where = buildSiteWhere({ mode: 'single', siteId: 'MTSI-HVL' });
    expect(where).toEqual({ siteId: 'MTSI-HVL' });
  });
});

// ── assertSiteAccess ────────────────────��─────────────────────────────────────

describe('assertSiteAccess', () => {
  test('enterprise user can access any site', () => {
    const user = { siteIds: ['MTSI-ALX'], canSeeAllSites: true };
    expect(assertSiteAccess(user, 'MTSI-HVL')).toBe(true);
    expect(assertSiteAccess(user, 'MTSI-ZZZ')).toBe(true);
  });

  test('user with matching siteId can access their site', () => {
    const user = { siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], role: 'Viewer' };
    expect(assertSiteAccess(user, 'MTSI-HVL')).toBe(true);
  });

  test('user without matching siteId cannot access another site', () => {
    const user = { siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], role: 'Viewer' };
    expect(assertSiteAccess(user, 'MTSI-ALX')).toBe(false);
  });

  test('returns false for null user', () => {
    expect(assertSiteAccess(null, 'MTSI-HVL')).toBe(false);
  });

  test('returns false for null siteId', () => {
    const user = { siteIds: ['MTSI-HVL'] };
    expect(assertSiteAccess(user, null)).toBe(false);
  });
});

// ── assertDocumentAccess ────────────��─────────────────────────────────────────

describe('assertDocumentAccess', () => {
  test('enterprise user can access any document', () => {
    const user = { canSeeAllSites: true, siteIds: ['MTSI-ALX'] };
    expect(assertDocumentAccess(user, { siteId: 'MTSI-HVL' })).toBe(true);
  });

  test('user can access document belonging to their site', () => {
    const user = { siteIds: ['MTSI-HVL'] };
    expect(assertDocumentAccess(user, { siteId: 'MTSI-HVL' })).toBe(true);
  });

  test('user cannot access document belonging to another site', () => {
    const user = { siteIds: ['MTSI-HVL'] };
    expect(assertDocumentAccess(user, { siteId: 'MTSI-ALX' })).toBe(false);
  });

  test('returns false for null document', () => {
    const user = { siteIds: ['MTSI-HVL'] };
    expect(assertDocumentAccess(user, null)).toBe(false);
  });
});

// ── isEnterpriseScopeRequest ─────────────────────��────────────────────────────

describe('isEnterpriseScopeRequest', () => {
  test('enterprise user with no siteId query is enterprise scope', () => {
    const req = makeReq({ canSeeAllSites: true });
    expect(isEnterpriseScopeRequest(req)).toBe(true);
  });

  test('enterprise user with explicit siteId query is NOT enterprise scope', () => {
    const req = makeReq({ canSeeAllSites: true }, { siteId: 'MTSI-HVL' });
    expect(isEnterpriseScopeRequest(req)).toBe(false);
  });

  test('non-enterprise user is never enterprise scope', () => {
    const req = makeReq({ siteIds: ['MTSI-HVL'], canSeeAllSites: false });
    expect(isEnterpriseScopeRequest(req)).toBe(false);
  });
});

// ── resolveWriteSiteId ───────────────────────��────────────────────────────────

describe('resolveWriteSiteId', () => {
  function makeWriteReq(user, body = {}) {
    return { user, body };
  }

  test('uses body.siteId when provided and user has access', () => {
    const req = makeWriteReq(
      { siteIds: ['MTSI-HVL', 'MTSI-ALX'], canSeeAllSites: false },
      { siteId: 'MTSI-HVL' }
    );
    expect(resolveWriteSiteId(req)).toBe('MTSI-HVL');
  });

  test('falls back to user primary siteId when body has none', () => {
    const req = makeWriteReq(
      { siteId: 'MTSI-HVL', siteIds: ['MTSI-HVL'], canSeeAllSites: false },
      {}
    );
    expect(resolveWriteSiteId(req)).toBe('MTSI-HVL');
  });

  test('throws 403 when body siteId is not in user scope', () => {
    const req = makeWriteReq(
      { siteIds: ['MTSI-HVL'], canSeeAllSites: false },
      { siteId: 'MTSI-ALX' }
    );
    expect(() => resolveWriteSiteId(req)).toThrow(expect.objectContaining({ status: 403 }));
  });

  test('throws 400 when no siteId can be resolved', () => {
    const req = makeWriteReq({ siteIds: [], canSeeAllSites: false }, {});
    expect(() => resolveWriteSiteId(req)).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('enterprise user can write to any site', () => {
    const req = makeWriteReq(
      { siteIds: ['MTSI-ALX'], canSeeAllSites: true },
      { siteId: 'MTSI-HVL' }
    );
    expect(resolveWriteSiteId(req)).toBe('MTSI-HVL');
  });
});

// ── normalizeSiteIds ───────────────────��────────────────────────────────��─────

describe('normalizeSiteIds', () => {
  test('deduplicates values', () => {
    const ids = normalizeSiteIds('MTSI-HVL', 'MTSI-HVL', ['MTSI-HVL']);
    expect(ids).toEqual(['MTSI-HVL']);
  });

  test('flattens arrays', () => {
    const ids = normalizeSiteIds(['MTSI-ALX', 'MTSI-HVL']);
    expect(ids).toEqual(['MTSI-ALX', 'MTSI-HVL']);
  });

  test('filters out empty/falsy values', () => {
    const ids = normalizeSiteIds(null, undefined, '', 'MTSI-HVL');
    expect(ids).toEqual(['MTSI-HVL']);
  });

  test('trims whitespace', () => {
    const ids = normalizeSiteIds('  MTSI-HVL  ');
    expect(ids).toEqual(['MTSI-HVL']);
  });
});
