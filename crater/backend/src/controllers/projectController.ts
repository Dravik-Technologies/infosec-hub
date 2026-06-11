import { Response, NextFunction } from 'express'
import { ProjectService } from '../services/projectService'
import type { AuthRequest } from '../middleware/auth'
import type { CreateProjectDto, UpdateProjectDto } from '../lib/schemas'

const projectService = new ProjectService()

export async function listProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projects = await projectService.findByUser(req.user!.id, req.user!.role)
    res.json(projects)
  } catch (err) {
    next(err)
  }
}

export async function getProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await projectService.findById(req.params.id, req.user!.id, req.user!.role)
    res.json(project)
  } catch (err) {
    next(err)
  }
}

export async function createProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await projectService.create(req.body as CreateProjectDto, req.user!.id)
    res.status(201).json(project)
  } catch (err) {
    next(err)
  }
}

export async function updateProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await projectService.update(
      req.params.id,
      req.body as UpdateProjectDto,
      req.user!.id,
      req.user!.role,
    )
    res.json(project)
  } catch (err) {
    next(err)
  }
}

export async function deleteProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await projectService.delete(req.params.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
