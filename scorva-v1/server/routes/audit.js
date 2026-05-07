'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
  const offset = parseInt(req.query.offset) || 0;

  const and = [];
  const username = String(req.query.username || '').trim();
  const action = String(req.query.action || '').trim();
  const reqSite = String(req.query.siteID || req.query.site || '').trim();

  if (username) and.push({ username: { contains: username, mode: 'insensitive' } });
  if (action) and.push({ action: { contains: action, mode: 'insensitive' } });

  // Tenant scoping — include system-wide entries alongside the active site so admin views stay useful.
  if (reqSite) {
    if (!req.tenantSiteIds?.length || req.tenantSiteIds.includes(reqSite)) {
      and.push({ OR: [{ siteId: reqSite }, { siteId: 'SYSTEM' }] });
    }
  } else if (req.tenantSiteIds?.length) {
    and.push({ OR: [{ siteId: { in: req.tenantSiteIds } }, { siteId: 'SYSTEM' }] });
  }

  const where = and.length ? { AND: and } : {};

  try {
    const [rows, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, skip: offset, take: limit }),
      db.auditLog.count({ where }),
    ]);
    res.json({ total, rows });
  } catch (err) { next(err); }
});

module.exports = router;
