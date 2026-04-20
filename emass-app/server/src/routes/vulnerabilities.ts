import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { Vulnerability } from '../models/Vulnerability'

const router = Router()
router.use(requireAuth)

router.get('/:systemId/vulnerabilities', async (req, res) => {
  try {
    const vulns = await Vulnerability.find({ systemId: req.params.systemId, userId: req.userId })
    res.json(vulns)
  } catch {
    res.status(500).json({ error: 'Failed to fetch vulnerabilities' })
  }
})

router.post('/:systemId/vulnerabilities', async (req, res) => {
  try {
    const { id, createdAt: _ca, updatedAt: _ua, ...rest } = req.body
    const vuln = await Vulnerability.create({ _id: id, ...rest, systemId: req.params.systemId, userId: req.userId })
    res.status(201).json(vuln)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.put('/:systemId/vulnerabilities/:id', async (req, res) => {
  try {
    const { id: _id, systemId: _sid, userId: _uid, createdAt: _ca, ...rest } = req.body
    const vuln = await Vulnerability.findOneAndUpdate(
      { _id: req.params.id, systemId: req.params.systemId, userId: req.userId },
      { ...rest },
      { new: true }
    )
    if (!vuln) { res.status(404).json({ error: 'Not found' }); return }
    res.json(vuln)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:systemId/vulnerabilities/:id', async (req, res) => {
  try {
    const vuln = await Vulnerability.findOneAndDelete({
      _id: req.params.id,
      systemId: req.params.systemId,
      userId: req.userId,
    })
    if (!vuln) { res.status(404).json({ error: 'Not found' }); return }
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Failed to delete vulnerability' })
  }
})

router.delete('/:systemId/vulnerabilities', async (req, res) => {
  try {
    await Vulnerability.deleteMany({ systemId: req.params.systemId, userId: req.userId })
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Failed to delete vulnerabilities' })
  }
})

export default router
