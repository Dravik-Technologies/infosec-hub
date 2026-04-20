import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { SCTMEntry } from '../models/SCTMEntry'

const router = Router()
router.use(requireAuth)

router.get('/:systemId/sctm', async (req, res) => {
  try {
    const entries = await SCTMEntry.find({ systemId: req.params.systemId, userId: req.userId })
    res.json(entries)
  } catch {
    res.status(500).json({ error: 'Failed to fetch SCTM entries' })
  }
})

router.post('/:systemId/sctm/initialize', async (req, res) => {
  try {
    const { controlIds }: { controlIds: string[] } = req.body
    const existing = await SCTMEntry.countDocuments({ systemId: req.params.systemId, userId: req.userId })
    if (existing > 0) {
      const entries = await SCTMEntry.find({ systemId: req.params.systemId, userId: req.userId })
      res.json({ count: entries.length, entries })
      return
    }
    const docs = controlIds.map((controlId) => ({
      userId: req.userId,
      systemId: req.params.systemId,
      controlId,
      status: 'Not Implemented',
      implementationOrigin: 'System Specific',
      responsibleRole: '',
      implementationStatement: '',
      assessorNotes: '',
      evidenceLinks: [],
      inheritedFrom: null,
      targetCompletionDate: null,
    }))
    await SCTMEntry.insertMany(docs)
    const entries = await SCTMEntry.find({ systemId: req.params.systemId, userId: req.userId })
    res.status(201).json({ count: entries.length, entries })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:systemId/sctm/:controlId', async (req, res) => {
  try {
    const { id: _id, systemId: _sid, controlId: _cid, createdAt: _ca, ...rest } = req.body
    const entry = await SCTMEntry.findOneAndUpdate(
      { systemId: req.params.systemId, controlId: req.params.controlId, userId: req.userId },
      { ...rest },
      { new: true, upsert: true }
    )
    res.json(entry)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:systemId/sctm/bulk-status', async (req, res) => {
  try {
    const { controlIds, status }: { controlIds: string[]; status: string } = req.body
    await SCTMEntry.updateMany(
      { systemId: req.params.systemId, controlId: { $in: controlIds }, userId: req.userId },
      { status }
    )
    res.json({ updated: controlIds.length })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:systemId/sctm/bulk', async (req, res) => {
  try {
    const updates: Array<{ controlId: string; [key: string]: any }> = req.body.updates
    const ops = updates.map(({ controlId, ...fields }) => ({
      updateOne: {
        filter: { systemId: req.params.systemId, controlId, userId: req.userId },
        update: { $set: fields },
      },
    }))
    const result = await SCTMEntry.bulkWrite(ops)
    res.json({ modified: result.modifiedCount })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:systemId/sctm', async (req, res) => {
  try {
    await SCTMEntry.deleteMany({ systemId: req.params.systemId, userId: req.userId })
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Failed to delete SCTM entries' })
  }
})

export default router
