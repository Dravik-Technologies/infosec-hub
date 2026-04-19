'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.site.findMany({ orderBy: { id: 'asc' } }));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { id, label } = req.body;
  try {
    const doc = await db.site.create({ data: { id, label } });
    await audit(req.session.user.username, 'SITE_ADD', id, `Added site: ${label}`);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await db.site.update({ where: { id: req.params.id }, data: { label } });
    await audit(req.session.user.username, 'SITE_UPDATE', req.params.id, `Updated: ${label}`);
    res.json(doc);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await db.site.delete({ where: { id: req.params.id } });
    await audit(req.session.user.username, 'SITE_DELETE', req.params.id, 'Deleted');
    res.json({ deleted: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

module.exports = router;
