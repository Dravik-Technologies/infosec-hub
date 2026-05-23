'use strict';

const express = require('express');
const { db } = require('../../../packages/db/src/index');

const router = express.Router();

router.get('/templates', async (_req, res, next) => {
  try {
    const docs = await db.checklistTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ source: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        source: true,
        version: true,
        description: true,
      },
    });
    res.json(docs);
  } catch (err) { next(err); }
});

router.get('/templates/:id', async (req, res, next) => {
  try {
    const doc = await db.checklistTemplate.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        source: true,
        version: true,
        description: true,
        sections: {
          orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
          select: {
            id: true,
            sectionCode: true,
            title: true,
            sortOrder: true,
            _count: { select: { items: true } },
          },
        },
      },
    });
    if (!doc) return res.status(404).json({ error: 'Template not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.get('/items', async (req, res, next) => {
  const templateId = String(req.query.templateId || '').trim();
  const sectionId = String(req.query.sectionId || '').trim();
  const search = String(req.query.search || '').trim();
  const riskCategory = String(req.query.riskCategory || '').trim();

  if (!templateId) {
    return res.status(400).json({ error: 'templateId is required' });
  }

  const where = {
    section: {
      templateId,
      ...(sectionId ? { id: sectionId } : {}),
    },
  };

  if (riskCategory) {
    where.riskCategory = riskCategory;
  }

  if (search) {
    where.OR = [
      { questionText: { contains: search, mode: 'insensitive' } },
      { itemCode: { contains: search, mode: 'insensitive' } },
      { nispomRef: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const docs = await db.checklistItem.findMany({
      where,
      orderBy: [
        { section: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
      ],
      select: {
        id: true,
        itemCode: true,
        nispomRef: true,
        questionText: true,
        applicabilityNote: true,
        riskCategory: true,
        evidenceRequired: true,
        controlRef: true,
        sortOrder: true,
        section: {
          select: {
            id: true,
            sectionCode: true,
            title: true,
          },
        },
      },
    });
    res.json(docs);
  } catch (err) { next(err); }
});

module.exports = router;
