import { create } from 'zustand'
import { api } from '@/lib/api'

export interface ProjectControl {
  id: string
  controlId: string
  controlTitle: string
  family: string
  status: string
  implementationStatement: string | null
  standardText: string | null
  autoFilled: boolean
  tailoringRequired: boolean
  implementationOrigin: string
  evidenceLinks: string[]
  assessorNotes: string | null
  validatedAt: string | null
  validatedBy: string | null
  siteId: string
}

export interface ControlsSummary {
  total: number
  autoFilled: number
  tailoringRequired: number
  validated?: number
}

export interface HydratePayload {
  externalId: string
  name: string
  abbreviation: string
  systemType: string
  organization: string
  description?: string
  classificationMarking?: string
  systemOwner?: string
  isso?: string
  issm?: string
  confidentiality: string
  integrity: string
  availability: string
  baseline: string
  controlIds: string[]
  siteId: string
}

interface ProjectControlsState {
  controls: Record<string, ProjectControl[]>
  summary: Record<string, ControlsSummary>
  _fetched: Record<string, boolean>
  _loading: Record<string, boolean>
  fetchControlsForSystem: (systemId: string) => Promise<void>
  hydrateSystem: (systemId: string, payload: HydratePayload) => Promise<ControlsSummary>
  updateControl: (systemId: string, controlId: string, updates: Partial<ProjectControl>) => Promise<void>
  signOffControl: (systemId: string, controlId: string, validatedBy: string) => Promise<void>
  getControlsForSystem: (systemId: string) => ProjectControl[]
  getSummaryForSystem: (systemId: string) => ControlsSummary | null
  isHydrated: (systemId: string) => boolean
}

export const useProjectControlsStore = create<ProjectControlsState>((set, get) => ({
  controls: {},
  summary: {},
  _fetched: {},
  _loading: {},

  async fetchControlsForSystem(systemId) {
    if (get()._fetched[systemId] || get()._loading[systemId]) return
    set(s => ({ _loading: { ...s._loading, [systemId]: true } }))
    try {
      const data = await api.get<{ controls: ProjectControl[]; summary: ControlsSummary }>(
        `/crater/systems/${systemId}/controls`
      )
      set(s => ({
        controls: { ...s.controls, [systemId]: data.controls },
        summary: { ...s.summary, [systemId]: data.summary },
        _fetched: { ...s._fetched, [systemId]: true },
        _loading: { ...s._loading, [systemId]: false },
      }))
    } catch {
      set(s => ({ _loading: { ...s._loading, [systemId]: false } }))
    }
  },

  async hydrateSystem(systemId, payload) {
    const data = await api.post<{
      controls: ProjectControl[]
      summary: ControlsSummary
    }>('/crater/hydrate', payload)
    set(s => ({
      controls: { ...s.controls, [systemId]: data.controls },
      summary: { ...s.summary, [systemId]: data.summary },
      _fetched: { ...s._fetched, [systemId]: true },
    }))
    return data.summary
  },

  async updateControl(systemId, controlId, updates) {
    const updated = await api.put<ProjectControl>(
      `/crater/systems/${systemId}/controls/${controlId}`,
      updates
    )
    set(s => ({
      controls: {
        ...s.controls,
        [systemId]: (s.controls[systemId] ?? []).map(c =>
          c.controlId === controlId ? { ...c, ...updated } : c
        ),
      },
    }))
  },

  async signOffControl(systemId, controlId, validatedBy) {
    const now = new Date().toISOString()
    const updated = await api.put<ProjectControl>(
      `/crater/systems/${systemId}/controls/${controlId}`,
      { status: 'Validated', validatedAt: now, validatedBy }
    )
    set(s => ({
      controls: {
        ...s.controls,
        [systemId]: (s.controls[systemId] ?? []).map(c =>
          c.controlId === controlId ? { ...c, ...updated } : c
        ),
      },
    }))
  },

  getControlsForSystem(systemId) {
    return get().controls[systemId] ?? []
  },

  getSummaryForSystem(systemId) {
    return get().summary[systemId] ?? null
  },

  isHydrated(systemId) {
    return !!get()._fetched[systemId]
  },
}))
