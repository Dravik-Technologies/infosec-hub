'use strict';

const express = require('express');
const ConMon = require('../models/ConMon');
const audit = require('../middleware/audit');

let multer = null;
let ExcelJS = null;
try {
  multer = require('multer');
  ExcelJS = require('exceljs');
} catch (_) {
  // Optional runtime dependency: route returns a clear 503 if package is unavailable.
}

const router = express.Router();

const upload = multer ? multer({ storage: multer.memoryStorage() }) : null;

function tenantSiteFilter(req) {
  if (!Array.isArray(req.tenantSiteIDs) || !req.tenantSiteIDs.length) return {};
  return { siteID: { $in: req.tenantSiteIDs } };
}

function normalizeStatus(input) {
  return String(input || '').trim() === 'Completed' ? 'Completed' : 'Pending';
}

function normalizeControl(input, siteID) {
  const controlID = String(input.controlID ?? input.control_id ?? '').trim();
  const controlTitle = String(input.controlTitle ?? input.control_title ?? '').trim();
  const family = String(input.family ?? '').trim();
  const dueDate = String(input.dueDate ?? input.due_date ?? '').trim();

  if (!controlID) return null;

  const status = normalizeStatus(input.status);
  const completedDate = status === 'Completed'
    ? String(input.completedDate ?? input.completed_date ?? new Date().toISOString().slice(0, 10)).trim()
    : null;

  return {
    siteID,
    controlID,
    controlTitle: controlTitle || '',
    family: family || '',
    status,
    dueDate: dueDate || '',
    daagJsigFrequency: String(input.daagJsigFrequency ?? input.daag_jsig_frequency ?? '').trim(),
    baselineApplicability: String(input.baselineApplicability ?? input.baseline_applicability ?? '').trim(),
    conmonGroup: String(input.conmonGroup ?? input.conmon_group ?? '').trim(),
    notes: String(input.notes ?? '').trim(),
    completedDate,
  };
}

async function upsertControls(controls, siteID) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of controls) {
    const doc = normalizeControl(raw, siteID);
    if (!doc) {
      skipped += 1;
      continue;
    }

    const existing = await ConMon.exists({ siteID, controlID: doc.controlID });
    await ConMon.updateOne(
      { siteID, controlID: doc.controlID },
      { $set: doc },
      { upsert: true }
    );
    if (existing) updated += 1;
    else inserted += 1;
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
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('').trim();
  }
  return String(value).trim();
}

async function parseExcelRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const vals = row.values.slice(1).map(normalizeCell);
    if (rowNumber === 1) {
      rows.push(vals);
      return;
    }
    if (vals.some(v => String(v || '').trim())) rows.push(vals);
  });
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  const mapped = rows.slice(1).map(raw => {
    const rowObj = {};
    headers.forEach((h, idx) => { rowObj[h] = raw[idx] ?? ''; });
    return rowObj;
  });

  return mapped.map(row => ({
    controlID: rowValue(row, ['control id', 'control_id']),
    controlTitle: rowValue(row, ['control title', 'title']),
    family: rowValue(row, ['family']),
    dueDate: rowValue(row, ['due date', 'due_date']),
    status: rowValue(row, ['status']),
    daagJsigFrequency: rowValue(row, ['daag/jsig frequency', 'frequency', 'daag', 'jsig']),
    baselineApplicability: rowValue(row, ['baseline applicability', 'baseline']),
    conmonGroup: rowValue(row, ['conmon group', 'conmon_group', 'group']),
    notes: rowValue(row, ['notes/dependencies', 'notes', 'dependencies']),
  })).filter(row => String(row.controlID || '').trim());
}

/* GET all (strict tenant scope by siteID only) */
router.get('/', async (req, res, next) => {
  try {
    const docs = await ConMon.find(tenantSiteFilter(req)).sort({ controlID: 1 });
    res.json(docs);
  } catch (err) { next(err); }
});

/* GET one */
router.get('/:id([0-9a-fA-F]{24})', async (req, res, next) => {
  try {
    const doc = await ConMon.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

/* Bulk import from parsed rows (upsert by siteID + controlID) */
router.post('/bulk', async (req, res, next) => {
  const siteID = req.resolveTenantSiteID(req.body);
  const controls = Array.isArray(req.body.controls) ? req.body.controls : [];

  if (!siteID) return res.status(400).json({ error: 'siteID is required for import' });
  if (!controls.length) return res.status(400).json({ error: 'controls must be a non-empty array' });

  try {
    const result = await upsertControls(controls, siteID);
    await audit(
      req.user?.username || 'system',
      'CONMON_BULK_IMPORT',
      'bulk',
      `ConMon import upserted: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`,
      siteID
    );
    res.json(result);
  } catch (err) { next(err); }
});

/* Excel file import using multer + exceljs */
router.post('/import-excel', (req, res, next) => {
  if (!upload || !ExcelJS) {
    return res.status(503).json({ error: 'Excel import dependencies are unavailable on this server instance.' });
  }

  upload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return next(uploadErr);

    const siteID = req.resolveTenantSiteID(req.body);
    if (!siteID) return res.status(400).json({ error: 'siteID is required for import' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'Excel file is required' });

    try {
      const controls = await parseExcelRows(req.file.buffer);
      if (!controls.length) {
        return res.status(400).json({ error: 'No control rows found in spreadsheet' });
      }

      const result = await upsertControls(controls, siteID);
      await audit(
        req.user?.username || 'system',
        'CONMON_EXCEL_IMPORT',
        'file',
        `Excel import upserted: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`,
        siteID
      );
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });
});

/* POST create */
router.post('/', async (req, res, next) => {
  const siteID = req.resolveTenantSiteID(req.body);
  const doc = normalizeControl(req.body, siteID);
  if (!siteID) return res.status(400).json({ error: 'siteID is required' });
  if (!doc?.controlID) return res.status(400).json({ error: 'controlID is required' });

  try {
    const created = await ConMon.create(doc);
    await audit(req.user?.username || 'system', 'CONMON_ADD', created.id, `Added: ${created.controlID}`, siteID);
    res.status(201).json(created);
  } catch (err) { next(err); }
});

/* PATCH update */
router.patch('/:id([0-9a-fA-F]{24})', async (req, res, next) => {
  try {
    const existing = await ConMon.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    const siteID = existing.siteID;
    const normalized = normalizeControl({ ...existing.toObject(), ...req.body }, siteID);
    const updated = await ConMon.findByIdAndUpdate(req.params.id, { $set: normalized }, { new: true });

    await audit(
      req.user?.username || 'system',
      'CONMON_UPDATE',
      req.params.id,
      `Updated ConMon control: ${updated.controlID}`,
      siteID
    );
    res.json(updated);
  } catch (err) { next(err); }
});

/* DELETE */
router.delete('/:id([0-9a-fA-F]{24})', async (req, res, next) => {
  try {
    const doc = await ConMon.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });

    await ConMon.findByIdAndDelete(req.params.id);
    await audit(
      req.user?.username || 'system',
      'CONMON_DELETE',
      req.params.id,
      `Deleted: ${doc.controlID}`,
      doc.siteID
    );
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
