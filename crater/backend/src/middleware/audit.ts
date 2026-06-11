import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { prisma } from '../prisma/client'

export function auditLog(action: string, entityType: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // For project DELETE, the project row is already gone by the time finish fires.
        // Inserting with projectId pointing to a deleted row violates the FK — store
        // undefined instead and keep the identity in entityId.
        const isProjectDelete = entityType === 'project' && req.method === 'DELETE'
        const projectId = isProjectDelete ? undefined : (req.params.id ?? undefined)

        // Pick the most specific route param as entityId (artifactId, poamId, etc.)
        // rather than always using the project :id param.
        const childId =
          req.params.artifactId ??
          req.params.poamId ??
          req.params.inventoryItemId ??
          req.params.ppsmEntryId ??
          req.params.diagramId ??
          req.params.stigId ??
          req.params.conmonEventId ??
          req.params.userId

        const entityId = childId ?? req.params.id

        prisma.auditLog
          .create({
            data: {
              userId: req.user?.id,
              projectId,
              action,
              entityType,
              entityId,
              details: {
                method: req.method,
                path: req.path,
                body: req.method !== 'GET' ? req.body : undefined,
              },
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          })
          .catch(console.error)
      }
    })
    next()
  }
}
