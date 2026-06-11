import { Response, NextFunction } from 'express'
import { ConMonService } from '../services/conmon.service'
import type { AuthRequest } from '../middleware/auth'
import type { CreateConMonEventDto, UpdateConMonEventDto } from '../utils/schemas'

const service = new ConMonService()

export async function listConMonEvents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1
    const events = await service.list(req.params.id, req.user!.id, req.user!.role, year, month)
    res.json(events)
  } catch (err) {
    next(err)
  }
}

export async function listUpcomingConMonEvents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const days = parseInt(req.query.days as string) || 90
    const events = await service.listUpcoming(req.params.id, req.user!.id, req.user!.role, days)
    res.json(events)
  } catch (err) {
    next(err)
  }
}

export async function createConMonEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const event = await service.create(
      req.params.id,
      req.body as CreateConMonEventDto,
      req.user!.id,
      req.user!.role,
    )
    res.status(201).json(event)
  } catch (err) {
    next(err)
  }
}

export async function updateConMonEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const event = await service.update(
      req.params.conmonEventId,
      req.params.id,
      req.body as UpdateConMonEventDto,
      req.user!.id,
      req.user!.role,
    )
    res.json(event)
  } catch (err) {
    next(err)
  }
}

export async function deleteConMonEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.delete(req.params.conmonEventId, req.params.id, req.user!.id, req.user!.role)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function completeConMonEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const nextEvent = await service.complete(
      req.params.conmonEventId,
      req.params.id,
      req.user!.id,
      req.user!.role,
    )
    res.json({ completed: true, nextEvent })
  } catch (err) {
    next(err)
  }
}
