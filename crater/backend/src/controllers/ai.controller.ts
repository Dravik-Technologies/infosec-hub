import { Response, NextFunction } from 'express'
import { AiService } from '../services/ai.service'
import type { AuthRequest } from '../middleware/auth'

const aiService = new AiService()

export async function generateImplementation(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generateImplementation(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generateImplementationStream(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const gen = aiService.streamImplementation(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })

    for await (const event of gen) {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
  }

  res.end()
}

export async function explainControl(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.explainControl(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function tailorControls(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.tailorControls(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generatePoamSuggestions(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generatePOAMSuggestions(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generateAssessmentFindings(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generateAssessmentFindings(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generateRiskRationale(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generateRiskRationale(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generateMonitoringReport(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generateMonitoringReport(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generatePolicy(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generatePolicy(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generateProcedure(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generateProcedure(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generateRiskAcceptanceLetter(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generateRiskAcceptanceLetter(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function generateDocument(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.generateFormalDocument(req.body, {
      userId: req.user!.id,
      role: req.user!.role,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}
