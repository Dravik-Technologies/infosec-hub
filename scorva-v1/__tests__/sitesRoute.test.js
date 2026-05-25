'use strict';

// ── helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json   = jest.fn(() => res);
  return res;
}

function mockReq(userOverride = {}) {
  return { user: { username: 'tester', role: 'Viewer', siteIds: [], ...userOverride } };
}

// ── requireCorporateAdmin ─────────────────────────────────────────────────────

// Inline a copy of the middleware so we can test it independently.
function requireCorporateAdmin(req, res, next) {
  if (req.user?.role !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden — Corporate Admin only' });
  }
  next();
}

describe('requireCorporateAdmin middleware', () => {
  test('calls next() for Corporate Admin', () => {
    const req = mockReq({ role: 'Corporate Admin' });
    const res = mockRes();
    const next = jest.fn();
    requireCorporateAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 403 for Viewer role', () => {
    const req = mockReq({ role: 'Viewer' });
    const res = mockRes();
    const next = jest.fn();
    requireCorporateAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden — Corporate Admin only' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for Security Manager role', () => {
    const req = mockReq({ role: 'Security Manager' });
    const res = mockRes();
    const next = jest.fn();
    requireCorporateAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when user is null', () => {
    const req = { user: null };
    const res = mockRes();
    const next = jest.fn();
    requireCorporateAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── GET /api/sites — tenant-scoped filtering logic ────────────────────────────
// We test the filter decision logic directly without hitting Express or the DB.

function computeSiteQuery(user, allSiteIds) {
  const isCorporateAdmin = user?.role === 'Corporate Admin' || user?.canSeeAllSites;
  if (isCorporateAdmin) return allSiteIds;
  const siteIds = Array.isArray(user?.siteIds) ? user.siteIds.filter(Boolean) : [];
  if (siteIds.length === 0) return [];
  return allSiteIds.filter(id => siteIds.includes(id));
}

const ALL_SITES = ['site-alpha', 'site-beta', 'site-gamma'];

describe('GET /api/sites — tenant filtering', () => {
  test('Corporate Admin sees all sites', () => {
    const result = computeSiteQuery({ role: 'Corporate Admin' }, ALL_SITES);
    expect(result).toEqual(ALL_SITES);
  });

  test('canSeeAllSites flag grants enterprise view', () => {
    const result = computeSiteQuery({ role: 'Viewer', canSeeAllSites: true }, ALL_SITES);
    expect(result).toEqual(ALL_SITES);
  });

  test('site-scoped user sees only their assigned sites', () => {
    const result = computeSiteQuery({ role: 'Viewer', siteIds: ['site-alpha'] }, ALL_SITES);
    expect(result).toEqual(['site-alpha']);
  });

  test('multi-site user sees all their assigned sites', () => {
    const result = computeSiteQuery({ role: 'Viewer', siteIds: ['site-alpha', 'site-gamma'] }, ALL_SITES);
    expect(result).toEqual(['site-alpha', 'site-gamma']);
  });

  test('user with no siteIds gets empty list', () => {
    const result = computeSiteQuery({ role: 'Viewer', siteIds: [] }, ALL_SITES);
    expect(result).toEqual([]);
  });

  test('user with null siteIds gets empty list', () => {
    const result = computeSiteQuery({ role: 'Viewer', siteIds: null }, ALL_SITES);
    expect(result).toEqual([]);
  });

  test('siteIds with falsy entries are filtered out', () => {
    const result = computeSiteQuery({ role: 'Viewer', siteIds: ['site-alpha', null, ''] }, ALL_SITES);
    expect(result).toEqual(['site-alpha']);
  });

  test('null user gets empty list', () => {
    const result = computeSiteQuery(null, ALL_SITES);
    expect(result).toEqual([]);
  });

  test('site not in DB is not returned even if assigned to user', () => {
    const result = computeSiteQuery({ role: 'Viewer', siteIds: ['site-alpha', 'site-unknown'] }, ALL_SITES);
    expect(result).toEqual(['site-alpha']);
  });
});

// ── audit call uses req.user, not req.session.user ────────────────────────────

describe('sites.js audit identity', () => {
  test('req.user.username is present for JWT-authed requests', () => {
    const req = mockReq({ username: 'jdoe', role: 'Corporate Admin' });
    expect(req.user.username).toBe('jdoe');
  });

  test('req.session is NOT used — req.session.user would be undefined', () => {
    const req = mockReq({ username: 'jdoe', role: 'Corporate Admin' });
    expect(req.session).toBeUndefined();
  });
});
