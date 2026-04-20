import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { POAMItem } from '../models/POAMItem'

const router = Router()
router.use(requireAuth)

router.get('/:systemId/poam', async (req, res) => {
  try {
    const items = await POAMItem.find({ systemId: req.params.systemId, userId: req.userId })
    res.json(items)
  } catch {
    res.status(500).json({ error: 'Failed to fetch POAM items' })
  }
})

router.post('/:systemId/poam', async (req, res) => {
  try {
    const { id, createdAt: _ca, updatedAt: _ua, ...rest } = req.body
    const item = await POAMItem.create({ _id: id, ...rest, systemId: req.params.systemId, userId: req.userId })
    res.status(201).json(item)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.put('/:systemId/poam/:id', async (req, res) => {
  try {
    const { id: _id, systemId: _sid, userId: _uid, createdAt: _ca, ...rest } = req.body
    const item = await POAMItem.findOneAndUpdate(
      { _id: req.params.id, systemId: req.params.systemId, userId: req.userId },
      { ...rest },
      { new: true }
    )
    if (!item) { res.status(404).json({ error: 'Not found' }); return }
    res.json(item)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:systemId/poam/:id', async (req, res) => {
  try {
    const item = await POAMItem.findOneAndDelete({
      _id: req.params.id,
      systemId: req.params.systemId,
      userId: req.userId,
    })
    if (!item) { res.status(404).json({ error: 'Not found' }); return }
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Failed to delete POAM item' })
  }
})

router.delete('/:systemId/poam', async (req, res) => {
  try {
    await POAMItem.deleteMany({ systemId: req.params.systemId, userId: req.userId })
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Failed to delete POAM items' })
  }
})

export default router
