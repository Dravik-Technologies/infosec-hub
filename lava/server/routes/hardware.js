'use strict';

const router = require('express').Router();
const multer = require('multer');
const XLSX   = require('xlsx');
const { db } = require('../db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
    cb(null, ok);
  },
});

// ── Download Hardware Excel Template ─────────────────────────────────────────
router.get('/template', (_req, res) => {
  const wb     = XLSX.utils.book_new();
  const header = ['Asset Tag', 'Serial Number', 'Make', 'Model', 'Type', 'Classification', 'Assigned User', 'Location', 'Notes'];
  const sample = ['LAVA-001', 'SN123456789', 'Dell', 'Latitude 5540', 'Workstation', 'UNCLASSIFIED', 'jsmith', 'Room 101', 'Initial issue'];
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

    const str = (v) => (v !== undefined && v !== null ? String(v).trim() : null) || null;

    const assets = rows.map((row) => ({
      systemRequestId: req.params.systemId,
      assetTag:        str(row['Asset Tag']),
      serialNumber:    str(row['Serial Number']),
      make:            str(row['Make']),
      model:           str(row['Model']),
      assetType:       str(row['Type']),
      classification:  str(row['Classification']) || 'UNCLASSIFIED',
      assignedUser:    str(row['Assigned User']),
      location:        str(row['Location']),
      notes:           str(row['Notes']),
    }));

    await db.lavaAsset.createMany({ data: assets });
    res.json({ imported: assets.length, message: `${assets.length} asset(s) imported into LAVA hardware registry.` });
  } catch (err) {
    console.error('[LAVA/hardware] upload error', err);
    res.status(500).json({ error: 'Failed to parse or import hardware data' });
  }
});

// ── List Assets ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { systemId } = req.query;
    const assets = await db.lavaAsset.findMany({
      where:   systemId ? { systemRequestId: systemId } : {},
      include: { systemRequest: { select: { systemName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// ── Delete Asset ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.lavaAsset.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

module.exports = router;
