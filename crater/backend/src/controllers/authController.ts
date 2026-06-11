import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/authService'
import type { AuthRequest } from '../middleware/auth'
import type { RegisterDto, LoginDto } from '../lib/schemas'

const authService = new AuthService()

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body as RegisterDto)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body as LoginDto)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await authService.getById(req.user!.id)
    res.json(user)
  } catch (err) {
    next(err)
  }
}
