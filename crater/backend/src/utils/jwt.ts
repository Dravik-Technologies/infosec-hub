import jwt from 'jsonwebtoken'
import { AppError } from './errors'

export interface TokenPayload {
  sub: string
  role: string
  iat?: number
  exp?: number
}

export function signToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new AppError('JWT_SECRET is not configured', 500)
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new AppError('JWT_SECRET is not configured', 500)
  try {
    return jwt.verify(token, secret) as TokenPayload
  } catch {
    throw new AppError('Invalid or expired token', 401)
  }
}
