import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'

export function auditLog(action: string, resource: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        prisma.auditLog
          .create({
            data: {
              userId: req.user?.id,
              action,
              resource,
              resourceId: req.params.id,
              ipAddress: req.ip,
              details: { method: req.method, path: req.path },
            },
          })
          .catch(() => {})
      }
    })
    next()
  }
}
