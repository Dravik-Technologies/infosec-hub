'use strict';

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockFacility   = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() };
const mockPersonnel  = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() };
const mockActivities = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() };
const mockDocuments  = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() };
const mockMedia      = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() };
const mockInspection = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() };
const mockFinding    = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() };

jest.mock('../../packages/db/src', () => ({
  db: {
    mashFacilitySecurity:   mockFacility,
    mashPersonnelSecurity:  mockPersonnel,
    mashActivitiesSecurity: mockActivities,
    mashDocumentControl:    mockDocuments,
    mashMediaControl:       mockMedia,
    mashSelfInspectionOp:   mockInspection,
    mashSecurityFinding:    mockFinding,
  },
}));

// DATABASE_URL must be set so getDb() returns the mock
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

const mashDb = require('../lib/mashDb');

beforeEach(() => {
  jest.clearAllMocks();
});

// ── RELATIONAL_DOMAINS ────────────────────────────────────────────────────────
describe('RELATIONAL_DOMAINS', () => {
  test('contains all 7 domains', () => {
    const expected = [
      'facility_security', 'personnel_security', 'activities_security',
      'document_control', 'media_control', 'self_inspection_ops', 'security_findings',
    ];
    expected.forEach(d => expect(mashDb.RELATIONAL_DOMAINS.has(d)).toBe(true));
  });

  test('does not contain non-mash collections', () => {
    expect(mashDb.RELATIONAL_DOMAINS.has('security_workspace_settings')).toBe(false);
    expect(mashDb.RELATIONAL_DOMAINS.has('workspace_role_mappings')).toBe(false);
  });
});

// ── buildWhere ────────────────────────────────────────────────────────────────
describe('buildWhere', () => {
  test('mode=all returns base object', () => {
    expect(mashDb.buildWhere({ mode: 'all' })).toEqual({});
    expect(mashDb.buildWhere({ mode: 'all' }, { foo: 1 })).toEqual({ foo: 1 });
  });

  test('mode=single returns siteId scalar', () => {
    expect(mashDb.buildWhere({ mode: 'single', siteId: 'site-001' }))
      .toEqual({ siteId: 'site-001' });
  });

  test('mode=multi returns siteId:in clause', () => {
    expect(mashDb.buildWhere({ mode: 'multi', siteIds: ['site-001', 'site-002'] }))
      .toEqual({ siteId: { in: ['site-001', 'site-002'] } });
  });

  test('null scope returns base', () => {
    expect(mashDb.buildWhere(null)).toEqual({});
  });
});

// ── findMany ──────────────────────────────────────────────────────────────────
describe('findMany', () => {
  test('passes where clause derived from scope to model', async () => {
    const rows = [{ id: '1', siteId: 'site-001' }];
    mockFacility.findMany.mockResolvedValue(rows);

    const result = await mashDb.findMany('facility_security', { mode: 'single', siteId: 'site-001' });

    expect(mockFacility.findMany).toHaveBeenCalledWith({
      where: { siteId: 'site-001' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toBe(rows);
  });

  test('mode=all passes empty where', async () => {
    mockPersonnel.findMany.mockResolvedValue([]);
    await mashDb.findMany('personnel_security', { mode: 'all' });
    expect(mockPersonnel.findMany).toHaveBeenCalledWith({ where: {}, orderBy: { createdAt: 'asc' } });
  });

  test('mode=multi passes siteId:in', async () => {
    mockDocuments.findMany.mockResolvedValue([]);
    await mashDb.findMany('document_control', { mode: 'multi', siteIds: ['s1', 's2'] });
    expect(mockDocuments.findMany).toHaveBeenCalledWith({
      where: { siteId: { in: ['s1', 's2'] } },
      orderBy: { createdAt: 'asc' },
    });
  });

  test('throws 400 for unknown collection', async () => {
    await expect(mashDb.findMany('not_a_domain', {})).rejects.toMatchObject({ status: 400 });
  });
});

// ── findById ──────────────────────────────────────────────────────────────────
describe('findById', () => {
  test('calls findUnique with id', async () => {
    const row = { id: 'abc', siteId: 'site-001' };
    mockMedia.findUnique.mockResolvedValue(row);

    const result = await mashDb.findById('media_control', 'abc');
    expect(mockMedia.findUnique).toHaveBeenCalledWith({ where: { id: 'abc' } });
    expect(result).toBe(row);
  });

  test('returns null when not found', async () => {
    mockFinding.findUnique.mockResolvedValue(null);
    const result = await mashDb.findById('security_findings', 'missing');
    expect(result).toBeNull();
  });
});

// ── create ────────────────────────────────────────────────────────────────────
describe('create', () => {
  test('passes data to model.create', async () => {
    const data = { id: 'new-1', siteId: 'site-001', title: 'Test Activity' };
    const created = { ...data, createdAt: new Date() };
    mockActivities.create.mockResolvedValue(created);

    const result = await mashDb.create('activities_security', data);
    expect(mockActivities.create).toHaveBeenCalledWith({ data });
    expect(result).toBe(created);
  });
});

// ── update ────────────────────────────────────────────────────────────────────
describe('update', () => {
  test('calls model.update with id and data', async () => {
    const updated = { id: 'u1', siteId: 'site-001', status: 'Completed' };
    mockInspection.update.mockResolvedValue(updated);

    const result = await mashDb.update('self_inspection_ops', 'u1', { status: 'Completed' });
    expect(mockInspection.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { status: 'Completed' },
    });
    expect(result).toBe(updated);
  });
});

// ── remove ────────────────────────────────────────────────────────────────────
describe('remove', () => {
  test('calls model.delete with id', async () => {
    const deleted = { id: 'd1' };
    mockFinding.delete.mockResolvedValue(deleted);

    const result = await mashDb.remove('security_findings', 'd1');
    expect(mockFinding.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    expect(result).toBe(deleted);
  });
});

// ── aggregateOverview ─────────────────────────────────────────────────────────
describe('aggregateOverview', () => {
  test('returns all 7 collections keyed correctly', async () => {
    const scope = { mode: 'single', siteId: 'site-001' };
    const where = { siteId: 'site-001' };

    mockFacility.findMany.mockResolvedValue([{ id: 'f1' }]);
    mockPersonnel.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    mockActivities.findMany.mockResolvedValue([]);
    mockDocuments.findMany.mockResolvedValue([{ id: 'd1' }]);
    mockMedia.findMany.mockResolvedValue([]);
    mockFinding.findMany.mockResolvedValue([{ id: 'fi1' }]);
    mockInspection.findMany.mockResolvedValue([{ id: 'i1' }]);

    const result = await mashDb.aggregateOverview(scope);

    expect(result).toEqual({
      facilities:  [{ id: 'f1' }],
      personnel:   [{ id: 'p1' }, { id: 'p2' }],
      activities:  [],
      docs:        [{ id: 'd1' }],
      media:       [],
      findings:    [{ id: 'fi1' }],
      inspections: [{ id: 'i1' }],
    });

    // All 7 models queried with the same where clause
    expect(mockFacility.findMany).toHaveBeenCalledWith({ where });
    expect(mockPersonnel.findMany).toHaveBeenCalledWith({ where });
    expect(mockActivities.findMany).toHaveBeenCalledWith({ where });
    expect(mockDocuments.findMany).toHaveBeenCalledWith({ where });
    expect(mockMedia.findMany).toHaveBeenCalledWith({ where });
    expect(mockFinding.findMany).toHaveBeenCalledWith({ where });
    expect(mockInspection.findMany).toHaveBeenCalledWith({ where });
  });

  test('mode=all passes empty where to all models', async () => {
    [mockFacility, mockPersonnel, mockActivities, mockDocuments, mockMedia, mockFinding, mockInspection]
      .forEach(m => m.findMany.mockResolvedValue([]));

    await mashDb.aggregateOverview({ mode: 'all' });

    [mockFacility, mockPersonnel, mockActivities, mockDocuments, mockMedia, mockFinding, mockInspection]
      .forEach(m => expect(m.findMany).toHaveBeenCalledWith({ where: {} }));
  });
});

// ── error: no DATABASE_URL ────────────────────────────────────────────────────
describe('no DATABASE_URL', () => {
  let originalUrl;

  beforeAll(() => {
    originalUrl = process.env.DATABASE_URL;
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalUrl;
    // Reset module so subsequent tests get the mocked db back
    jest.resetModules();
  });

  test('throws 503 when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    jest.resetModules();
    // Re-require without mock to exercise the getDb() null path
    const freshMashDb = require('../lib/mashDb');
    await expect(freshMashDb.findMany('facility_security', {})).rejects.toMatchObject({ status: 503 });
  });
});
