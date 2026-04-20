import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'
import { Diagram } from '../models/Diagram'
import { randomUUID } from 'crypto'

const router = Router()
router.use(requireAuth)

const UPLOADS_DIR = path.join(__dirname, '../../uploads/diagrams')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf', 'image/gif', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only images (PNG, JPG, SVG, GIF, WEBP) and PDFs are allowed'))
    }
  },
})

// GET all diagrams for a system
router.get('/:systemId/diagrams', async (req, res) => {
  try {
    const diagrams = await Diagram.find({ systemId: req.params.systemId, userId: req.userId })
      .sort({ createdAt: -1 })
    res.json(diagrams)
  } catch {
    res.status(500).json({ error: 'Failed to fetch diagrams' })
  }
})

// POST upload a new diagram
router.post('/:systemId/diagrams', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  try {
    const { name, diagramType, description } = req.body
    if (!name || !diagramType) {
      fs.unlinkSync(req.file.path)
      res.status(400).json({ error: 'name and diagramType are required' })
      return
    }
    const diagram = await Diagram.create({
      _id: randomUUID(),
      userId: req.userId,
      systemId: req.params.systemId,
      name,
      diagramType,
      description: description ?? '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    })
    res.status(201).json(diagram)
  } catch (err: any) {
    if (req.file) fs.unlinkSync(req.file.path)
    res.status(400).json({ error: err.message })
  }
})

// GET download a diagram file
router.get('/:systemId/diagrams/:id/file', async (req, res) => {
  try {
    const diagram = await Diagram.findOne({
      _id: req.params.id,
      systemId: req.params.systemId,
      userId: req.userId,
    })
    if (!diagram) { res.status(404).json({ error: 'Not found' }); return }

    const filePath = path.join(UPLOADS_DIR, diagram.filename)
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found on disk' }); return }

    res.setHeader('Content-Type', diagram.mimeType)
    res.setHeader('Content-Disposition', `inline; filename="${diagram.originalName}"`)
    res.sendFile(filePath)
  } catch {
    res.status(500).json({ error: 'Failed to retrieve file' })
  }
})

// DELETE a diagram
router.delete('/:systemId/diagrams/:id', async (req, res) => {
  try {
    const diagram = await Diagram.findOneAndDelete({
      _id: req.params.id,
      systemId: req.params.systemId,
      userId: req.userId,
    })
    if (!diagram) { res.status(404).json({ error: 'Not found' }); return }

    const filePath = path.join(UPLOADS_DIR, diagram.filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Failed to delete diagram' })
  }
})

export default router
