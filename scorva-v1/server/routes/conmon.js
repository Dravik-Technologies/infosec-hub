'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const { completeTasksForSource, ensureTaskForSource } = require('../utils/taskAutomation');

let multer  = null;
let ExcelJS = null;
try { multer  = require('multer');  } catch (_) {}
try { ExcelJS = require('exceljs'); } catch (_) {}

const router = express.Router();
const upload = multer ? multer({ storage: multer.memoryStorage() }) : null;

function tenantSiteFilter(req) {
  if (!Array.isArray(req.tenantSiteIds) || !req.tenantSiteIds.length) return {};
  return { siteId: { in: req.tenantSiteIds } };
}

function normalizeStatus(input) {
  return String(input || '').trim() === 'Completed' ? 'Completed' : 'Pending';
}

function normalizeControl(input, siteId) {
  const controlId    = String(input.controlID ?? input.controlId ?? input.control_id ?? '').trim();
  const controlTitle = String(input.controlTitle ?? input.control_title ?? '').trim();
  const family       = String(input.family ?? '').trim();
  const dueDate      = String(input.dueDate ?? input.due_date ?? '').trim();
  if (!controlId) return null;

  const status        = normalizeStatus(input.status);
  const completedDate = status === 'Completed'
    ? String(input.completedDate ?? input.completed_date ?? new Date().toISOString().slice(0, 10)).trim()
    : null;

  return {
    siteId, controlId, controlTitle: controlTitle || '',
    family: family || '', status, dueDate: dueDate || '',
    daagJsigFrequency:    String(input.daagJsigFrequency    ?? input.daag_jsig_frequency    ?? '').trim(),
    baselineApplicability: String(input.baselineApplicability ?? input.baseline_applicability ?? '').trim(),
    conmonGroup:          String(input.conmonGroup           ?? input.conmon_group            ?? '').trim(),
    assignee:             String(input.assignee              ?? '').trim() || null,
    reviewOutcome:        String(input.reviewOutcome         ?? input.review_outcome          ?? '').trim() || null,
    notes:                String(input.notes ?? '').trim(),
    completedDate,
  };
}

async function upsertControls(controls, siteId) {
  let inserted = 0, updated = 0, skipped = 0;
  for (const raw of controls) {
    const doc = normalizeControl(raw, siteId);
    if (!doc) { skipped++; continue; }
    const existing = await db.conMon.findFirst({
      where: { siteId, controlId: doc.controlId }, select: { id: true },
    });
    await db.conMon.upsert({
      where: { siteId_controlId: { siteId, controlId: doc.controlId } },
      update: doc,
      create: doc,
    });
    if (existing) updated++; else inserted++;
  }
  return { inserted, updated, skipped };
}

function rowValue(row, aliases) {
  const byKey = new Map(Object.entries(row || {}).map(([k, v]) => [String(k).trim().toLowerCase(), v]));
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    if (byKey.has(key)) return byKey.get(key);
    const partial = [...byKey.keys()].find(k => k.includes(key));
    if (partial) return byKey.get(partial);
  }
  return '';
}

function normalizeCell(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text.trim();
    if (value.result != null) return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map(p => p.text || '').join('').trim();
  }
  return String(value).trim();
}

function serializeConMon(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    control_id: doc.controlId ?? doc.control_id ?? '',
    control_title: doc.controlTitle ?? doc.control_title ?? '',
    due_date: doc.dueDate ?? doc.due_date ?? '',
    daag_jsig_frequency: doc.daagJsigFrequency ?? doc.daag_jsig_frequency ?? '',
    baseline_applicability: doc.baselineApplicability ?? doc.baseline_applicability ?? '',
    conmon_group: doc.conmonGroup ?? doc.conmon_group ?? '',
    review_outcome: doc.reviewOutcome ?? doc.review_outcome ?? '',
    completed_date: doc.completedDate ?? doc.completed_date ?? null,
    linked_controls: doc.linkedControls ?? doc.linked_controls ?? [],
    site_id: doc.siteId ?? doc.site_id ?? null,
  };
}

function shouldCreateConMonTask(doc) {
  if (!doc || doc.status === 'Completed' || !doc.dueDate) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  const due = new Date(doc.dueDate);
  const now = new Date(todayStr);
  if (Number.isNaN(due.getTime())) return false;
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return days <= 30 || doc.reviewOutcome === 'Finding' || doc.reviewOutcome === 'Needs POA&M';
}

async function syncConMonTask(doc, username) {
  if (!shouldCreateConMonTask(doc)) return null;
  return ensureTaskForSource({
    source: 'conmon',
    sourceId: doc.id,
    siteId: doc.siteId,
    title: `ConMon review: ${doc.controlId}${doc.controlTitle ? ` - ${doc.controlTitle}` : ''}`,
    type: doc.reviewOutcome === 'Finding' || doc.reviewOutcome === 'Needs POA&M' ? 'Finding' : 'Task',
    priority: doc.reviewOutcome === 'Finding' || doc.reviewOutcome === 'Needs POA&M' ? 'High' : 'Medium',
    assignee: doc.assignee || null,
    dueDate: doc.dueDate || null,
    control: doc.controlId || null,
    linkedControls: doc.linkedControls || [],
    notes: doc.notes || null,
    username,
  });
}

async function parseExcelRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const vals = row.values.slice(1).map(normalizeCell);
    if (rowNumber === 1) { rows.push(vals); return; }
    if (vals.some(v => String(v || '').trim())) rows.push(vals);
  });
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  const mapped  = rows.slice(1).map(raw => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = raw[i] ?? ''; });
    return obj;
  });
  return mapped.map(row => ({
    controlID:            rowValue(row, ['control id', 'control_id']),
    controlTitle:         rowValue(row, ['control title', 'title']),
    family:               rowValue(row, ['family']),
    dueDate:              rowValue(row, ['due date', 'due_date']),
    status:               rowValue(row, ['status']),
    daagJsigFrequency:    rowValue(row, ['daag/jsig frequency', 'frequency', 'daag', 'jsig']),
    baselineApplicability: rowValue(row, ['baseline applicability', 'baseline']),
    conmonGroup:          rowValue(row, ['conmon group', 'conmon_group', 'group']),
    notes:                rowValue(row, ['notes/dependencies', 'notes', 'dependencies']),
  })).filter(r => String(r.controlID || '').trim());
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await db.conMon.findMany({
      where: tenantSiteFilter(req), orderBy: { controlId: 'asc' },
    });
    res.json(docs.map(serializeConMon));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.conMon.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(serializeConMon(doc));
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const siteId   = req.resolveTenantSiteId(req.body);
  const controls = Array.isArray(req.body.controls) ? req.body.controls : [];
  if (!siteId)         return res.status(400).json({ error: 'siteID is required for import' });
  if (!controls.length) return res.status(400).json({ error: 'controls must be a non-empty array' });
  try {
    const result = await upsertControls(controls, siteId);
    await audit(req.user?.username || 'system', 'CONMON_BULK_IMPORT', 'bulk',
      `ConMon import: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`, siteId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/import-excel', (req, res, next) => {
  if (!upload || !ExcelJS) {
    return res.status(503).json({ error: 'Excel import dependencies are unavailable.' });
  }
  upload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return next(uploadErr);
    const siteId = req.resolveTenantSiteId(req.body);
    if (!siteId)            return res.status(400).json({ error: 'siteID is required for import' });
    if (!req.file?.buffer)  return res.status(400).json({ error: 'Excel file is required' });
    try {
      const controls = await parseExcelRows(req.file.buffer);
      if (!controls.length) return res.status(400).json({ error: 'No control rows found in spreadsheet' });
      const result = await upsertControls(controls, siteId);
      await audit(req.user?.username || 'system', 'CONMON_EXCEL_IMPORT', 'file',
        `Excel import: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`, siteId);
      return res.json(result);
    } catch (err) { return next(err); }
  });
});

router.post('/', async (req, res, next) => {
  const siteId = req.resolveTenantSiteId(req.body);
  const doc    = normalizeControl(req.body, siteId);
  if (!siteId)        return res.status(400).json({ error: 'siteID is required' });
  if (!doc?.controlId) return res.status(400).json({ error: 'controlID is required' });
  try {
    const created = await db.conMon.create({ data: doc });
    await syncConMonTask(created, req.user?.username || 'system');
    await audit(req.user?.username || 'system', 'CONMON_ADD', created.id,
      `Added: ${created.controlId}`, siteId);
    res.status(201).json(serializeConMon(created));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await db.conMon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    const normalized = normalizeControl({ ...existing, ...req.body }, existing.siteId);
    const updated    = await db.conMon.update({ where: { id: req.params.id }, data: normalized });
    if (updated.status === 'Completed') {
      await completeTasksForSource('conmon', updated.id, updated.notes || 'ConMon review completed');
    } else {
      await syncConMonTask(updated, req.user?.username || 'system');
    }
    await audit(req.user?.username || 'system', 'CONMON_UPDATE', req.params.id,
      `Updated ConMon control: ${updated.controlId}`, existing.siteId);
    res.json(serializeConMon(updated));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.conMon.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.conMon.delete({ where: { id: req.params.id } });
    await audit(req.user?.username || 'system', 'CONMON_DELETE', req.params.id,
      `Deleted: ${doc.controlId}`, doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
