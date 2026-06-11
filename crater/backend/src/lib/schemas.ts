import { z } from 'zod'
import { ImpactLevel, ProjectStatus } from '@prisma/client'

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  systemDescription: z.string().max(2000).optional(),
  impactLevel: z.nativeEnum(ImpactLevel).default('LOW'),
  authBoundary: z.string().max(2000).optional(),
})

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    systemDescription: z.string().max(2000).optional(),
    impactLevel: z.nativeEnum(ImpactLevel).optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    authBoundary: z.string().max(2000).optional(),
    atoExpiry: z.string().datetime().optional(),
  })
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field is required' })

export type RegisterDto = z.infer<typeof registerSchema>
export type LoginDto = z.infer<typeof loginSchema>
export type CreateProjectDto = z.infer<typeof createProjectSchema>
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>
