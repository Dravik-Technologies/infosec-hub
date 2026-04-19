'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.notification.findMany({
      where: req.applyTenantFilter({}), orderBy: { createdAt: 'desc' },
    }));
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const existing = await db.notification.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const doc = await db.notification.update({ where: { id: req.params.id }, data: { read: true } });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/read-all', async (req, res, next) => {
  try {
    await db.notification.updateMany({ where: req.applyTenantFilter({}), data: { read: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { type, title, message } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  try {
    const last    = await db.notification.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('N-', '')) || 0 : 0;
    const id      = 'N-' + String(lastNum + 1).padStart(3, '0');

    const doc = await db.notification.create({
      data: { id, type: type || 'info', title, message: message || null, siteId: siteId || null },
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.notification.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.notification.delete({ where: { id: req.params.id } });
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
