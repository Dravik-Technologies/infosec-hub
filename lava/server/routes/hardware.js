'use strict';

const router = require('express').Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { db } = require('../db');
const { writeAudit, actor } = require('../audit');
const { requireVulcan, isSiteAllowed } = require('../authz');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.includes('spreadsheetml') ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    cb(null, ok);
  },
});

const normalize = (value) => {
  const str = value !== undefined && value !== null ? String(value).trim() : '';
  return str || null;
};

async function findConflicts(systemRequestId, assets, ignoreId) {
  const assetTags = [...new Set(assets.map((asset) => normalize(asset.assetTag)).filter(Boolean))];
  const serialNumbers = [...new Set(assets.map((asset) => normalize(asset.serialNumber)).filter(Boolean))];
  const existing = await db.lavaAsset.findMany({
    where: {
      id: ignoreId ? { not: ignoreId } : undefined,
      OR: [
        assetTags.length ? { assetTag: { in: assetTags } } : undefined,
        serialNumbers.length ? { serialNumber: { in: serialNumbers } } : undefined,
      ].filter(Boolean),
    },
    select: { id: true, assetTag: true, serialNumber: true, systemRequestId: true },
  });

  const duplicates = [];
  for (const asset of assets) {
    const assetTag = normalize(asset.assetTag);
    const serialNumber = normalize(asset.serialNumber);
    const inBatch = assets.some((other) => other !== asset && (
      (assetTag && normalize(other.assetTag) === assetTag) ||
      (serialNumber && normalize(other.serialNumber) === serialNumber)
    ));
    const inDb = existing.some((row) =>
      (assetTag && row.assetTag === assetTag) ||
      (serialNumber && row.serialNumber === serialNumber)
    );
    if (inBatch || inDb) {
      duplicates.push(assetTag || serialNumber || 'unidentified asset');
    }
  }

  if (duplicates.length) {
    const msg = [...new Set(duplicates)].join(', ');
    throw new Error(`Duplicate asset tag or serial number detected: ${msg}`);
  }
}

async function writeAssignmentHistory(asset, nextAssignedUser, notes, req) {
  const previousAssignedUser = normalize(asset.assignedUser);
  const incomingAssignedUser = normalize(nextAssignedUser);
  if (previousAssignedUser === incomingAssignedUser) return;

  if (previousAssignedUser) {
    await db.lavaAssetAssignmentHistory.updateMany({
      where: {
        assetId: asset.id,
        assignedUser: previousAssignedUser,
        returnedAt: null,
      },
      data: {
        returnedAt: new Date(),
      },
    });
  }

  if (incomingAssignedUser) {
    await db.lavaAssetAssignmentHistory.create({
      data: {
        assetId: asset.id,
        assignedUser: incomingAssignedUser,
        previousUser: previousAssignedUser,
        assignedBy: actor(req),
        notes: notes || null,
      },
    });
  }
}

// ── Download Hardware Excel Template ─────────────────────────────────────────
router.get('/template', (_req, res) => {
  const header = ['Asset Tag', 'Serial Number', 'Make', 'Model', 'Type', 'Status', 'Classification', 'Assigned User', 'Location', 'Notes'];
  const sample = ['LAVA-001', 'SN123456789', 'Dell', 'Latitude 5540', 'Workstation', 'Assigned', 'UNCLASSIFIED', 'jsmith', 'Room 101', 'Initial issue'];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hardware Assets');

  sheet.addRow(header);
  sheet.addRow(sample);
  sheet.columns = header.map((column) => ({
    header: column,
    key: column,
    width: 22,
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  workbook.xlsx.writeBuffer().then((buf) => {
    res.set('Content-Disposition', 'attachment; filename="LAVA_Hardware_Template.xlsx"');
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buf));
  }).catch((err) => {
    console.error('[LAVA/hardware] template error', err);
    res.status(500).json({ error: 'Failed to generate hardware template' });
  });
});

// ── Upload & Bulk-Import Hardware from Excel ─────────────────────────────────
router.post('/upload/:systemId', requireVulcan, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const parentSystem = await db.lavaSystemRequest.findUnique({ where: { id: req.params.systemId } });
    if (!parentSystem) return res.status(404).json({ error: 'System not found' });
    if (!isSiteAllowed(req.session.user, parentSystem.siteId)) {
      return res.status(403).json({ error: 'Access denied — system is outside your site scope' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: 'Spreadsheet has no worksheets' });

    const headerRow = sheet.getRow(1);
    const headers = headerRow.values
      .slice(1)
      .map((value) => (value !== undefined && value !== null ? String(value).trim() : ''));
    const rows = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const cells = row.values.slice(1);
      if (!cells.some((value) => value !== undefined && value !== null && String(value).trim() !== '')) {
        continue;
      }

      const record = {};
      headers.forEach((header, index) => {
        if (!header) return;
        const value = cells[index];
        record[header] = value && typeof value === 'object' && value.text ? value.text : value;
      });
      rows.push(record);
    }

    if (!rows.length) return res.status(400).json({ error: 'Spreadsheet is empty or has no data rows' });

    // Inherit siteId from the parent system, not the uploader's primary site.
    // The parent system has already been scope-validated above.
    const assetSiteId = parentSystem.siteId;

    const assets = rows.map((row) => ({
      systemRequestId: req.params.systemId,
      assetTag:        normalize(row['Asset Tag']),
      serialNumber:    normalize(row['Serial Number']),
      make:            normalize(row['Make']),
      model:           normalize(row['Model']),
      assetType:       normalize(row['Type']),
      status:          normalize(row['Status']) || 'Assigned',
      classification:  normalize(row['Classification']) || 'UNCLASSIFIED',
      assignedUser:    normalize(row['Assigned User']),
      location:        normalize(row['Location']),
      notes:           normalize(row['Notes']),
      siteId:          assetSiteId,
    }));

    await findConflicts(req.params.systemId, assets);
    await db.lavaAsset.createMany({ data: assets });
    const createdAssets = await db.lavaAsset.findMany({
      where: { systemRequestId: req.params.systemId },
      orderBy: { createdAt: 'desc' },
      take: assets.length,
    });
    for (const asset of createdAssets) {
      await writeAssignmentHistory(asset, asset.assignedUser, asset.notes, req);
    }
    await writeAudit(
      req,
      'bulk_import',
      'hardware_asset',
      req.params.systemId,
      `Imported ${assets.length} hardware asset(s)`,
      assetSiteId
    );
    res.json({ imported: assets.length, message: `${assets.length} asset(s) imported into LAVA hardware registry.` });
  } catch (err) {
    console.error('[LAVA/hardware] upload error', err);
    res.status(500).json({ error: err.message || 'Failed to parse or import hardware data' });
  }
});

// ── List Assets ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { systemId } = req.query;
    const viewer = req.session.user;

    if (systemId) {
      const parentSystem = await db.lavaSystemRequest.findUnique({ where: { id: systemId } });
      if (!parentSystem) return res.status(404).json({ error: 'System not found' });
      if (!isSiteAllowed(viewer, parentSystem.siteId)) {
        return res.status(403).json({ error: 'Access denied — system is outside your site scope' });
      }
    }

    let baseWhere = systemId ? { systemRequestId: systemId } : {};
    if (!systemId) {
      const isCorporateAdmin = !viewer || viewer.role === 'Corporate Admin' || viewer.canSeeAllSites;
      if (!isCorporateAdmin) {
        const siteIds = Array.isArray(viewer.siteIds) ? viewer.siteIds.filter(Boolean) : [];
        if (viewer.siteId && !siteIds.includes(viewer.siteId)) siteIds.push(viewer.siteId);
        baseWhere = siteIds.length
          ? { OR: [{ siteId: { in: siteIds } }, { siteId: null }] }
          : { siteId: null };
      }
    }

    const assets = await db.lavaAsset.findMany({
      where:   baseWhere,
      include: {
        systemRequest: { select: { systemName: true } },
        assignmentHistory: { orderBy: { assignedAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

router.patch('/:id', requireVulcan, async (req, res) => {
  try {
    const existing = await db.lavaAsset.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    if (!isSiteAllowed(req.session.user, existing.siteId)) {
      return res.status(403).json({ error: 'Access denied — asset is outside your site scope' });
    }

    const payload = {
      assetTag: normalize(req.body.assetTag !== undefined ? req.body.assetTag : req.body.asset_tag),
      serialNumber: normalize(req.body.serialNumber !== undefined ? req.body.serialNumber : req.body.serial_number),
      make: normalize(req.body.make),
      model: normalize(req.body.model),
      assetType: normalize(req.body.assetType !== undefined ? req.body.assetType : req.body.asset_type),
      status: normalize(req.body.status) || 'Assigned',
      classification: normalize(req.body.classification) || 'UNCLASSIFIED',
      assignedUser: normalize(req.body.assignedUser !== undefined ? req.body.assignedUser : req.body.assigned_user),
      location: normalize(req.body.location),
      notes: normalize(req.body.notes),
    };

    await findConflicts(existing.systemRequestId, [payload], existing.id);

    await writeAssignmentHistory(existing, payload.assignedUser, payload.notes, req);

    const asset = await db.lavaAsset.update({
      where: { id: req.params.id },
      data: payload,
      include: {
        assignmentHistory: { orderBy: { assignedAt: 'desc' } },
      },
    });

    await writeAudit(
      req,
      'update',
      'hardware_asset',
      asset.id,
      `Updated asset ${asset.assetTag || asset.serialNumber || asset.id}`,
      asset.siteId
    );

    res.json(asset);
  } catch (err) {
    console.error('[LAVA/hardware] update error', err);
    res.status(500).json({ error: err.message || 'Failed to update asset' });
  }
});

// ── Delete Asset ─────────────────────────────────────────────────────────────
router.delete('/:id', requireVulcan, async (req, res) => {
  try {
    const existing = await db.lavaAsset.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    if (!isSiteAllowed(req.session.user, existing.siteId)) {
      return res.status(403).json({ error: 'Access denied — asset is outside your site scope' });
    }

    await db.lavaAsset.delete({ where: { id: req.params.id } });
    await writeAudit(
      req,
      'delete',
      'hardware_asset',
      existing.id,
      `Deleted asset ${existing.assetTag || existing.serialNumber || existing.id}`,
      existing.siteId
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

module.exports = router;
