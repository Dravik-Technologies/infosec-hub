'use strict';

const express = require('express');
const { db } = require('../../../packages/db/src');
const audit = require('../middleware/audit');
const { assertSiteAccess, getUserSiteScope } = require('../lib/tenantScope');

const router = express.Router();

function actor(req) {
  return req.user?.username || req.session?.user?.username || 'system';
}

function isHubAdmin(user) {
  return Boolean(
    user?.canSeeAllSites ||
    user?.role === 'Hub Admin' ||
    user?.hubRole === 'Hub Admin' ||
    user?.role === 'Corporate Admin'
  );
}

function serializeCatalog(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    control_key: doc.controlKey,
    implementation_default: doc.implementationDefault,
    owner_type: doc.ownerType,
    owner_site_id: doc.ownerSiteId,
    is_template: doc.isTemplate,
    is_active: doc.isActive,
  };
}

function buildCatalogVisibilityWhere(req) {
  const scope = getUserSiteScope(req.user);
  const selectedSiteId = req.tenantSiteId || req.query?.siteId || null;
  const ownerScope = String(req.query?.ownerScope || 'all').trim();

  const or = [];
  if (ownerScope === 'all' || ownerScope === 'enterprise') {
    or.push({ ownerType: 'enterprise' });
  }

  if (ownerScope === 'all' || ownerScope === 'site') {
    if (selectedSiteId) {
      or.push({ ownerType: 'site', ownerSiteId: selectedSiteId });
    } else if (scope.canSeeAllSites) {
      or.push({ ownerType: 'site' });
    } else if (scope.siteIds.length) {
      or.push({ ownerType: 'site', ownerSiteId: { in: scope.siteIds } });
    }
  }

  if (!or.length) return { id: '__no_match__' };
  return { OR: or };
}

function normalizeCatalogInput(body = {}) {
  return {
    controlKey: String(body.controlKey || body.control_key || '').trim(),
    title: String(body.title || '').trim(),
    family: body.family ? String(body.family).trim() : null,
    baseline: body.baseline ? String(body.baseline).trim() : null,
    description: body.description ? String(body.description).trim() : null,
    source: body.source ? String(body.source).trim() : null,
    implementationDefault: body.implementationDefault || body.implementation_default || null,
    ownerType: String(body.ownerType || body.owner_type || 'enterprise').trim(),
    ownerSiteId: body.ownerSiteId || body.owner_site_id || null,
    isTemplate: body.isTemplate ?? body.is_template ?? true,
    isActive: body.isActive ?? body.is_active ?? true,
    version: body.version ? String(body.version).trim() : null,
    tenantId: body.tenantId || body.tenant_id || null,
  };
}

function validateCatalogWrite(req, payload, existing = null) {
  if (!payload.controlKey) {
    const err = new Error('controlKey is required');
    err.status = 400;
    throw err;
  }
  if (!payload.title) {
    const err = new Error('title is required');
    err.status = 400;
    throw err;
  }

  const ownerType = payload.ownerType === 'site' ? 'site' : 'enterprise';
  payload.ownerType = ownerType;

  if (ownerType === 'enterprise') {
    if (!isHubAdmin(req.user)) {
      const err = new Error('Only Hub Admin users may manage enterprise control definitions');
      err.status = 403;
      throw err;
    }
    payload.ownerSiteId = null;
    return payload;
  }

  const ownerSiteId = payload.ownerSiteId || existing?.ownerSiteId || req.tenantSiteId || null;
  if (!ownerSiteId) {
    const err = new Error('ownerSiteId is required for site-owned control definitions');
    err.status = 400;
    throw err;
  }
  if (!assertSiteAccess(req.user, ownerSiteId)) {
    const err = new Error(`Site access denied: ${ownerSiteId}`);
    err.status = 403;
    throw err;
  }
  payload.ownerSiteId = ownerSiteId;
  return payload;
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await db.controlCatalog.findMany({
      where: buildCatalogVisibilityWhere(req),
      orderBy: [
        { family: 'asc' },
        { controlKey: 'asc' },
      ],
    });
    res.json(docs.map(serializeCatalog));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.controlCatalog.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const visible = await db.controlCatalog.findFirst({
      where: {
        id: req.params.id,
        ...buildCatalogVisibilityWhere(req),
      },
    });
    if (!visible) return res.status(403).json({ error: 'Forbidden' });

    res.json(serializeCatalog(doc));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = validateCatalogWrite(req, normalizeCatalogInput(req.body));
    const doc = await db.controlCatalog.create({ data });
    await audit(actor(req), 'CONTROL_CATALOG_ADD', doc.id, `Added catalog definition ${doc.controlKey}`, data.ownerSiteId || null);
    res.status(201).json(serializeCatalog(doc));
  } catch (err) {
    next(err);
  }
});

router.post('/import', async (req, res, next) => {
  const definitions = Array.isArray(req.body?.definitions)
    ? req.body.definitions
    : Array.isArray(req.body?.controls)
      ? req.body.controls
      : [];
  const overwrite = Boolean(req.body?.overwrite);

  if (!definitions.length) {
    return res.status(400).json({ error: 'definitions must be a non-empty array' });
  }

  let inserted = 0;
  let overwritten = 0;
  let skipped = 0;
  const errors = [];

  try {
    for (const raw of definitions) {
      try {
        const payload = validateCatalogWrite(req, normalizeCatalogInput(raw));
        const where = {
          tenantId_ownerType_ownerSiteId_controlKey: {
            tenantId: payload.tenantId,
            ownerType: payload.ownerType,
            ownerSiteId: payload.ownerSiteId,
            controlKey: payload.controlKey,
          },
        };

        if (overwrite) {
          await db.controlCatalog.upsert({
            where,
            create: payload,
            update: payload,
          });
          overwritten += 1;
        } else {
          try {
            await db.controlCatalog.create({ data: payload });
            inserted += 1;
          } catch (err) {
            if (err.code === 'P2002') skipped += 1;
            else throw err;
          }
        }
      } catch (err) {
        errors.push({
          controlKey: raw?.controlKey || raw?.control_key || null,
          reason: err.message,
        });
      }
    }

    await audit(
      actor(req),
      'CONTROL_CATALOG_IMPORT',
      'bulk',
      `Catalog import: ${overwrite ? overwritten : inserted} written, ${skipped} skipped`,
      req.tenantSiteId || null
    );

    res.json({ inserted, overwritten, skipped, errors: errors.slice(0, 25) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await db.controlCatalog.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const visible = await db.controlCatalog.findFirst({
      where: {
        id: req.params.id,
        ...buildCatalogVisibilityWhere(req),
      },
    });
    if (!visible) return res.status(403).json({ error: 'Forbidden' });

    const normalized = normalizeCatalogInput({ ...existing, ...req.body });
    const data = validateCatalogWrite(req, normalized, existing);
    const doc = await db.controlCatalog.update({
      where: { id: req.params.id },
      data,
    });

    await audit(actor(req), 'CONTROL_CATALOG_UPDATE', doc.id, `Updated catalog definition ${doc.controlKey}`, data.ownerSiteId || null);
    res.json(serializeCatalog(doc));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await db.controlCatalog.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { siteImplementations: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const visible = await db.controlCatalog.findFirst({
      where: {
        id: req.params.id,
        ...buildCatalogVisibilityWhere(req),
      },
    });
    if (!visible) return res.status(403).json({ error: 'Forbidden' });

    if (existing._count.siteImplementations > 0) {
      return res.status(409).json({
        error: 'Cannot delete a control definition that already has site implementation records',
      });
    }

    await db.controlCatalog.delete({ where: { id: req.params.id } });
    await audit(actor(req), 'CONTROL_CATALOG_DELETE', existing.id, `Deleted catalog definition ${existing.controlKey}`, existing.ownerSiteId || null);
    res.json({ deleted: existing.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
