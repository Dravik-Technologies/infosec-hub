'use strict';

const express  = require('express');
const AuditLog = require('../models/AuditLog');
const router   = express.Router();

router.get('/', async (req, res, next) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
  const offset = parseInt(req.query.offset) || 0;

  const filter = {};
  if (req.query.username) filter.username = req.query.username;
  if (req.query.action)   filter.action   = req.query.action;
  if (req.query.siteID || req.query.site) {
    const siteID = req.query.siteID || req.query.site;
    filter.$or = [{ siteID }, { site: siteID }];
  }
  const tenantFilter = req.applyTenantFilter(filter);

  try {
    const [rows, total] = await Promise.all([
      AuditLog.find(tenantFilter).sort({ timestamp: -1 }).skip(offset).limit(limit),
      AuditLog.countDocuments(tenantFilter),
    ]);
    res.json({ total, rows });
  } catch (err) { next(err); }
});

module.exports = router;
