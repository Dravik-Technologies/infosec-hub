'use strict';

const router = require('express').Router();
const multer = require('multer');
const XLSX   = require('xlsx');
const { db } = require('../db');
const { writeAudit, actor } = require('../audit');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
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
  const wb     = XLSX.utils.book_new();
  const header = ['Asset Tag', 'Serial Number', 'Make', 'Model', 'Type', 'Status', 'Classification', 'Assigned User', 'Location', 'Notes'];
  const sample = ['LAVA-001', 'SN123456789', 'Dell', 'Latitude 5540', 'Workstation', 'Assigned', 'UNCLASSIFIED', 'jsmith', 'Room 101', 'Initial issue'];
  const ws     = XLSX.utils.aoa_to_sheet([header, sample]);
  ws['!cols']  = header.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Hardware Assets');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.set('Content-Disposition', 'attachment; filename="LAVA_Hardware_Template.xlsx"');
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ── Upload & Bulk-Import Hardware from Excel ─────────────────────────────────
router.post('/upload/:systemId', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    if (!rows.length) return res.status(400).json({ error: 'Spreadsheet is empty or has no data rows' });

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
      req.session && req.session.user ? req.session.user.siteId : null
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
    const assets = await db.lavaAsset.findMany({
      where:   systemId ? { systemRequestId: systemId } : {},
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

router.patch('/:id', async (req, res) => {
  try {
    const existing = await db.lavaAsset.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Asset not found' });

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
router.delete('/:id', async (req, res) => {
  try {
    const asset = await db.lavaAsset.delete({ where: { id: req.params.id } });
    await writeAudit(
      req,
      'delete',
      'hardware_asset',
      asset.id,
      `Deleted asset ${asset.assetTag || asset.serialNumber || asset.id}`,
      asset.siteId
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

module.exports = router;
