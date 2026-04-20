import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { InfoSystem } from '../models/InfoSystem'
import { SCTMEntry } from '../models/SCTMEntry'
import { POAMItem } from '../models/POAMItem'
import { Vulnerability } from '../models/Vulnerability'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  try {
    const systems = await InfoSystem.find({ userId: req.userId })
    res.json(systems)
  } catch {
    res.status(500).json({ error: 'Failed to fetch systems' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { id, createdAt: _ca, updatedAt: _ua, ...rest } = req.body
    const system = await InfoSystem.create({ _id: id, ...rest, userId: req.userId })
    res.status(201).json(system)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id: _id, userId: _uid, createdAt: _ca, ...rest } = req.body
    const system = await InfoSystem.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { ...rest },
      { new: true }
    )
    if (!system) { res.status(404).json({ error: 'Not found' }); return }
    res.json(system)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const system = await InfoSystem.findOneAndDelete({ _id: req.params.id, userId: req.userId })
    if (!system) { res.status(404).json({ error: 'Not found' }); return }
    const sid = req.params.id
    await Promise.all([
      SCTMEntry.deleteMany({ systemId: sid, userId: req.userId }),
      POAMItem.deleteMany({ systemId: sid, userId: req.userId }),
      Vulnerability.deleteMany({ systemId: sid, userId: req.userId }),
    ])
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Failed to delete system' })
  }
})

export default router
