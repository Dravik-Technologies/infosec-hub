'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

function requireCorporateAdmin(req, res, next) {
  if (req.user?.role !== 'Corporate Admin' && req.user?.role !== 'Hub Admin' && !req.user?.canSeeAllSites) {
    return res.status(403).json({ error: 'Forbidden — Corporate Admin only' });
  }
  next();
}

// GET /api/sites
// Corporate Admins see all sites. Site-scoped users see only their assigned sites.
router.get('/', async (req, res, next) => {
  try {
    const isCorporateAdmin = req.user?.role === 'Corporate Admin' || req.user?.role === 'Hub Admin' || req.user?.canSeeAllSites;
    if (isCorporateAdmin) {
      res.json(await db.site.findMany({ orderBy: { id: 'asc' } }));
    } else {
      const siteIds = Array.isArray(req.user?.siteIds) ? req.user.siteIds.filter(Boolean) : [];
      if (siteIds.length === 0) return res.json([]);
      res.json(await db.site.findMany({ where: { id: { in: siteIds } }, orderBy: { id: 'asc' } }));
    }
  } catch (err) { next(err); }
});

// All mutations require Corporate Admin
router.post('/', requireCorporateAdmin, async (req, res, next) => {
  const { id, label } = req.body;
  try {
    const doc = await db.site.create({ data: { id, label } });
    await audit(req.user.username, 'SITE_ADD', id, `Added site: ${label}`);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', requireCorporateAdmin, async (req, res, next) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await db.site.update({ where: { id: req.params.id }, data: { label } });
    await audit(req.user.username, 'SITE_UPDATE', req.params.id, `Updated: ${label}`);
    res.json(doc);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

router.delete('/:id', requireCorporateAdmin, async (req, res, next) => {
  try {
    await db.site.delete({ where: { id: req.params.id } });
    await audit(req.user.username, 'SITE_DELETE', req.params.id, 'Deleted');
    res.json({ deleted: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

module.exports = router;
