import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { InfoSystem } from '../models/InfoSystem'
import { isModelReady, streamGenerate, getModelPath } from '../services/ollama'

const router = Router()
router.use(requireAuth)

router.get('/status', async (_req, res) => {
  const ready = await isModelReady()
  res.json({ running: ready, model: getModelPath() })
})

router.post('/suggest', async (req, res) => {
  const {
    systemId,
    controlId,
    controlTitle,
    controlStatement,
    supplementalGuidance,
    currentStatement,
  } = req.body

  if (!systemId || !controlId || !controlStatement) {
    res.status(400).json({ error: 'systemId, controlId, and controlStatement are required' })
    return
  }

  const system = await InfoSystem.findOne({ _id: systemId, userId: req.userId })
  if (!system) {
    res.status(404).json({ error: 'System not found' })
    return
  }

  const prompt = buildPrompt({
    systemName: system.name,
    systemDescription: system.description ?? '',
    systemType: system.systemType ?? '',
    selectedBaseline: system.selectedBaseline ?? 'Moderate',
    controlId,
    controlTitle,
    controlStatement,
    supplementalGuidance,
    currentStatement,
  })

  // Stream via Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    await streamGenerate(
      prompt,
      (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`)
      }
    )
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  } catch (err: any) {
    const isConnErr = err.code === 'ECONNREFUSED' || err.message?.includes('fetch')
    const message = isConnErr
      ? 'Ollama is not running. Run: ollama serve'
      : (err.message ?? 'Generation failed')
    res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`)
  }

  res.end()
})

function buildPrompt(p: {
  systemName: string
  systemDescription: string
  systemType: string
  selectedBaseline: string
  controlId: string
  controlTitle: string
  controlStatement: string
  supplementalGuidance?: string
  currentStatement?: string
}): string {
  const lines: string[] = [
    `You are a cybersecurity expert writing NIST RMF implementation statements for DoD/Federal information systems.`,
    ``,
    `SYSTEM INFORMATION:`,
    `- Name: ${p.systemName}`,
    `- Type: ${p.systemType || 'Information System'}`,
    `- Description: ${p.systemDescription || 'Not provided'}`,
    `- Security Baseline: ${p.selectedBaseline}`,
    ``,
    `CONTROL: ${p.controlId} - ${p.controlTitle}`,
    `Statement: ${p.controlStatement}`,
  ]

  if (p.supplementalGuidance) {
    lines.push(`Supplemental Guidance: ${p.supplementalGuidance}`)
  }

  if (p.currentStatement) {
    lines.push(``, `EXISTING STATEMENT TO IMPROVE:`, p.currentStatement)
  }

  lines.push(
    ``,
    `Write a specific, technical implementation statement (2-4 paragraphs) that:`,
    `- Begins with "The ${p.systemName} system..."`,
    `- Explains HOW the system specifically implements this control`,
    `- References concrete mechanisms, tools, policies, or procedures`,
    `- Is suitable for an SSP/ATO package per DoD RMF and NIST 800-53 Rev 5`,
    `- Avoids generic boilerplate — be specific to this system`,
    `- Uses professional, formal language`,
    ``,
    `Write only the implementation statement with no preamble or headers.`,
    ``,
    `Implementation Statement:`
  )

  return lines.join('\n')
}

export default router
