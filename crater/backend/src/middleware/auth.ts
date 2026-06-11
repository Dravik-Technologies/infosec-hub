import { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { verifyToken } from '../utils/jwt'
import { AppError } from '../utils/errors'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: Role
  }
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authorization header missing or malformed', 401)
    }

    const token = authHeader.slice(7)
    const payload = verifyToken(token)

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    })

    if (!user || !user.isActive) {
      throw new AppError('Account not found or has been disabled', 401)
    }

    req.user = { id: user.id, email: user.email, role: user.role }
    next()
  } catch (err) {
    next(err)
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Unauthenticated', 401))
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(
        `Access denied — requires one of: ${roles.join(', ')}`,
        403,
      ))
    }
    next()
  }
}
