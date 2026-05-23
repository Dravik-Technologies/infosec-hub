'use strict';

const express = require('express');
const { db } = require('../../../packages/db/src/index');
const audit = require('../middleware/audit');

let multer = null;
try { multer = require('multer'); } catch (_) {}

const router = express.Router();
const upload = multer ? multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}) : null;

const RESOURCE_MAP = {
  control: { model: 'control', label: 'Control' },
  conmon: { model: 'conMon', label: 'ConMon' },
  poam: { model: 'poam', label: 'POAM' },
  tracker: { model: 'tracker', label: 'Tracker' },
  inspectioncampaignitem: {
    model: 'inspectionCampaignItem',
    label: 'Inspection Campaign Item',
    load: async (id) => {
      const item = await db.inspectionCampaignItem.findUnique({
        where: { id },
        include: { campaign: { select: { siteId: true } } },
      });
      if (!item) return null;
      return { ...item, siteId: item.campaign?.siteId || null };
    },
  },
};

function actor(req) {
  return req.user?.username || req.session?.user?.username || 'system';
}

function normalizeResourceType(value) {
  const key = String(value || '').trim().toLowerCase();
  return RESOURCE_MAP[key] ? key : null;
}

async function loadResource(resourceType, resourceId) {
  const spec = RESOURCE_MAP[resourceType];
  if (!spec || !resourceId) return null;
  if (spec.load) return spec.load(resourceId);
  const model = db[spec.model];
  if (!model?.findUnique) return null;
  return model.findUnique({ where: { id: resourceId } });
}

async function resolveAuthorizedResource(req, resourceType, resourceId) {
  const doc = await loadResource(resourceType, resourceId);
  if (!doc) return { error: 'Resource not found', status: 404 };
  if (!req.assertTenantDocument(doc)) return { error: 'Forbidden', status: 403 };
  return { doc };
}

function serializeArtifact(doc) {
  if (!doc) return doc;
  return {
    id: doc.id,
    resourceType: doc.resourceType,
    resourceId: doc.resourceId,
    filename: doc.filename,
    mimeType: doc.mimeType,
    size: doc.size,
    artifactType: doc.artifactType,
    notes: doc.notes,
    uploadedBy: doc.uploadedBy,
    siteId: doc.siteId,
    createdAt: doc.createdAt,
  };
}

router.get('/', async (req, res, next) => {
  const resourceType = normalizeResourceType(req.query.resourceType);
  const resourceId = String(req.query.resourceId || '').trim();
  if (!resourceType || !resourceId) {
    return res.status(400).json({ error: 'resourceType and resourceId are required' });
  }

  try {
    const resolved = await resolveAuthorizedResource(req, resourceType, resourceId);
    if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

    const docs = await db.evidenceArtifact.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        filename: true,
        mimeType: true,
        size: true,
        artifactType: true,
        notes: true,
        uploadedBy: true,
        siteId: true,
        createdAt: true,
      },
    });
    res.json(docs);
  } catch (err) { next(err); }
});

router.post('/', (req, res, next) => {
  if (!upload) return res.status(503).json({ error: 'Upload dependencies are unavailable.' });
  upload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message || 'File upload failed' });

    const resourceType = normalizeResourceType(req.body.resourceType);
    const resourceId = String(req.body.resourceId || '').trim();
    const artifactType = String(req.body.artifactType || '').trim() || null;
    const notes = String(req.body.notes || '').trim() || null;

    if (!resourceType || !resourceId) {
      return res.status(400).json({ error: 'resourceType and resourceId are required' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'A file is required' });
    }

    try {
      const resolved = await resolveAuthorizedResource(req, resourceType, resourceId);
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

      const created = await db.evidenceArtifact.create({
        data: {
          resourceType,
          resourceId,
          filename: req.file.originalname || 'artifact',
          mimeType: req.file.mimetype || 'application/octet-stream',
          size: req.file.size || req.file.buffer.length,
          artifactType,
          notes,
          uploadedBy: actor(req),
          data: req.file.buffer,
          siteId: resolved.doc.siteId || null,
        },
      });

      await audit(
        actor(req),
        'EVIDENCE_UPLOAD',
        `${resourceType}:${resourceId}`,
        `Uploaded evidence: ${created.filename}`,
        created.siteId || 'SYSTEM'
      );

      res.status(201).json(serializeArtifact(created));
    } catch (err) { next(err); }
  });
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const doc = await db.evidenceArtifact.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const resolved = await resolveAuthorizedResource(req, doc.resourceType, doc.resourceId);
    if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

    await audit(
      actor(req),
      'EVIDENCE_DOWNLOAD',
      `${doc.resourceType}:${doc.resourceId}`,
      `Downloaded evidence: ${doc.filename}`,
      doc.siteId || 'SYSTEM'
    );

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(doc.size || doc.data?.length || 0));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`);
    res.send(Buffer.from(doc.data));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.evidenceArtifact.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const resolved = await resolveAuthorizedResource(req, doc.resourceType, doc.resourceId);
    if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

    await db.evidenceArtifact.delete({ where: { id: req.params.id } });
    await audit(
      actor(req),
      'EVIDENCE_DELETE',
      `${doc.resourceType}:${doc.resourceId}`,
      `Deleted evidence: ${doc.filename}`,
      doc.siteId || 'SYSTEM'
    );
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
