import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service'
import type { AuthRequest } from '../middleware/auth'

const authService = new AuthService()

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getProfile(req.user!.id)
    res.json(user)
  } catch (err) {
    next(err)
  }
}
