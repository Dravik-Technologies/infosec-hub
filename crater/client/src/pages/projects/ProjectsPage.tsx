import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Edit3, Plus, Trash2, X } from 'lucide-react'
import { projectsApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { CreateProjectInput, Project } from '@/types/project'

const projectSchema = z.object({
  name: z.string().min(1, 'Required').max(100, 'Max 100 characters'),
  description: z.string().max(2000, 'Max 2000 characters').optional(),
  impactLevel: z.enum(['LOW', 'MODERATE', 'HIGH']),
  authBoundary: z.string().max(2000, 'Max 2000 characters').optional(),
})

type ProjectFormData = z.infer<typeof projectSchema>

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; details?: Array<{ field?: string; message?: string }> } | undefined
    const detail = data?.details?.[0]
    if (detail?.message) return detail.field ? `${detail.field}: ${detail.message}` : detail.message
    if (data?.error) return data.error
    if (error.message) return error.message
  }

  return fallback
}

const defaultValues: ProjectFormData = {
  name: '',
  description: '',
  impactLevel: 'LOW',
  authBoundary: '',
}

function projectToFormValues(project: Project): ProjectFormData {
  return {
    name: project.name,
    description: project.description ?? '',
    impactLevel: project.impactLevel,
    authBoundary: project.authBoundary ?? '',
  }
}

function toProjectInput(data: ProjectFormData): CreateProjectInput {
  return {
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    impactLevel: data.impactLevel,
    authBoundary: data.authBoundary?.trim() || undefined,
  }
}

function impactBadgeClass(impactLevel: Project['impactLevel']) {
  if (impactLevel === 'HIGH') return 'text-red-alert border-red-alert/30 bg-red-alert/10'
  if (impactLevel === 'MODERATE') return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
  return 'text-green-matrix border-green-matrix/30 bg-green-matrix/10'
}

export default function ProjectsPage() {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: queryKeys.projects.all,
    queryFn: projectsApi.list,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues,
  })

  const createProject = useMutation({
    mutationFn: (data: ProjectFormData) => projectsApi.create(toProjectInput(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success('SYSTEM INITIALIZED')
      closeProjectModal()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'INITIALIZATION FAILED')),
  })

  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectFormData }) =>
      projectsApi.update(id, toProjectInput(data)),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      toast.success('SYSTEM UPDATED')
      closeProjectModal()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'UPDATE FAILED')),
  })

  const deleteProject = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) })
      toast.success('SYSTEM DELETED')
      setDeleteTarget(null)
    },
    onError: () => toast.error('DELETE FAILED'),
  })

  const isSaving = createProject.isPending || updateProject.isPending

  function openCreateModal() {
    setEditingProject(null)
    reset(defaultValues)
    setIsProjectModalOpen(true)
  }

  function openEditModal(project: Project) {
    setEditingProject(project)
    reset(projectToFormValues(project))
    setIsProjectModalOpen(true)
  }

  function closeProjectModal() {
    setIsProjectModalOpen(false)
    setEditingProject(null)
    reset(defaultValues)
  }

  function onSubmit(data: ProjectFormData) {
    if (editingProject) {
      updateProject.mutate({ id: editingProject.id, data })
      return
    }

    createProject.mutate(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="hud-label text-slate-600">REGISTRY</p>
          <h1 className="font-mono text-xl text-slate-100">INFORMATION SYSTEMS</h1>
        </div>
        <button onClick={openCreateModal} className="btn-primary inline-flex items-center justify-center gap-2">
          <Plus size={16} />
          INITIALIZE SYSTEM
        </button>
      </div>

      {isProjectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(11,15,25,0.85)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
        >
          <div className="rmf-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <span id="project-modal-title" className="hud-label">
                {editingProject ? 'EDIT SYSTEM' : 'INITIALIZE NEW SYSTEM'}
              </span>
              <button
                onClick={closeProjectModal}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close project form"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="project-name" className="hud-label mb-1.5 block">
                  SYSTEM NAME
                </label>
                <input
                  id="project-name"
                  {...register('name')}
                  className="input-hud"
                  placeholder="e.g., AEGIS-7 Financial System"
                />
                {errors.name && <p className="font-mono text-red-alert text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="project-impact" className="hud-label mb-1.5 block">
                  IMPACT LEVEL (FIPS 199)
                </label>
                <select id="project-impact" {...register('impactLevel')} className="input-hud">
                  <option value="LOW">LOW</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>

              <div>
                <label htmlFor="project-description" className="hud-label mb-1.5 block">
                  SYSTEM DESCRIPTION
                </label>
                <textarea
                  id="project-description"
                  {...register('description')}
                  className="input-hud"
                  rows={3}
                  placeholder="Brief description of the system's mission and functions..."
                />
                {errors.description && (
                  <p className="font-mono text-red-alert text-xs mt-1">{errors.description.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="project-boundary" className="hud-label mb-1.5 block">
                  AUTHORIZATION BOUNDARY
                </label>
                <textarea
                  id="project-boundary"
                  {...register('authBoundary')}
                  className="input-hud"
                  rows={2}
                  placeholder="Describe the system boundary..."
                />
                {errors.authBoundary && (
                  <p className="font-mono text-red-alert text-xs mt-1">{errors.authBoundary.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSaving} className="btn-primary flex-1">
                  {isSaving ? 'SAVING...' : editingProject ? 'SAVE CHANGES' : 'INITIALIZE'}
                </button>
                <button type="button" onClick={closeProjectModal} className="btn-secondary flex-1">
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(11,15,25,0.85)', backdropFilter: 'blur(4px)' }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
          aria-describedby="delete-project-description"
        >
          <div className="rmf-card w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="delete-project-title" className="hud-label text-red-alert">
                  DELETE SYSTEM
                </p>
                <p id="delete-project-description" className="text-sm text-slate-400 mt-3">
                  Delete <span className="font-mono text-slate-100">{deleteTarget.name}</span>? This removes the
                  project from the registry and cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Cancel delete"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={() => deleteProject.mutate(deleteTarget.id)}
                disabled={deleteProject.isPending}
                className="btn-danger flex-1"
              >
                {deleteProject.isPending ? 'DELETING...' : 'DELETE'}
              </button>
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rmf-card p-12 text-center">
          <p className="font-mono text-cyan-neon text-sm animate-pulse">LOADING SYSTEMS...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="rmf-card p-12 text-center">
          <p className="font-mono text-slate-500">NO SYSTEMS REGISTERED</p>
          <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 mt-4">
            <Plus size={16} />
            INITIALIZE SYSTEM
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="rmf-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <Link to={`/projects/${project.id}`} className="min-w-0 flex-1 group">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-mono text-sm text-slate-100 group-hover:text-cyan-neon transition-colors">
                      {project.name}
                    </p>
                    <span className={`font-mono text-xs px-2 py-0.5 rounded border ${impactBadgeClass(project.impactLevel)}`}>
                      {project.impactLevel}
                    </span>
                    <span className="font-mono text-xs text-slate-500">{project.status}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                    {project.description?.trim() || 'No description provided.'}
                  </p>
                  {project.authBoundary && (
                    <p className="hud-label text-slate-700 mt-3 truncate">
                      BOUNDARY: {project.authBoundary}
                    </p>
                  )}
                </Link>

                <div className="flex items-center gap-2 lg:flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(project)}
                    className="btn-secondary inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs"
                  >
                    <Edit3 size={14} />
                    EDIT
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(project)}
                    className="btn-danger inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs"
                  >
                    <Trash2 size={14} />
                    DELETE
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
