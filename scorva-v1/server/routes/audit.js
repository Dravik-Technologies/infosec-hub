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
  if (req.query.site)     filter.site     = req.query.site;

  try {
    const [rows, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(offset).limit(limit),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ total, rows });
  } catch (err) { next(err); }
});

module.exports = router;
