'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
  const offset = parseInt(req.query.offset) || 0;

  const where = {};
  if (req.query.username) where.username = req.query.username;
  if (req.query.action)   where.action   = req.query.action;

  // Tenant scoping — AuditLog.siteId is a plain string (may be 'SYSTEM')
  if (req.tenantSiteIds?.length) where.siteId = { in: req.tenantSiteIds };

  if (req.query.siteID || req.query.site) {
    const reqSite = req.query.siteID || req.query.site;
    if (!req.tenantSiteIds?.length || req.tenantSiteIds.includes(reqSite)) {
      where.siteId = reqSite;
    }
  }

  try {
    const [rows, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, skip: offset, take: limit }),
      db.auditLog.count({ where }),
    ]);
    res.json({ total, rows });
  } catch (err) { next(err); }
});

module.exports = router;
