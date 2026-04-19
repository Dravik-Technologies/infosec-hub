'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const where = req.siteFilter ? { siteId: req.siteFilter } : {};
    res.json(await db.tracker.findMany({ where, orderBy: { createdAt: 'asc' } }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.tracker.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.siteId !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { name, description, columns, rows: dataRows, subtrackers } = req.body;
  const siteId = req.siteFilter ?? (req.body.siteId || req.body.siteID || null);
  try {
    const doc = await db.tracker.create({
      data: {
        name, description: description || null,
        columns: columns || [], rows: dataRows || [],
        subtrackers: subtrackers || [],
        siteId: siteId || null,
        createdBy: req.session.user.username,
      },
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const ALLOWED = ['name','description','columns','rows','subtrackers'];
  const data = {};
  for (const key of ALLOWED) {
    if (key in req.body) data[key] = req.body[key];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await db.tracker.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.siteId !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    if (req.siteFilter) data.siteId = req.siteFilter;
    const updated = await db.tracker.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.tracker.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.siteId !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    await db.tracker.delete({ where: { id: req.params.id } });
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
