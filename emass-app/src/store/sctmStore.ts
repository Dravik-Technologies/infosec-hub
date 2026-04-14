import { create } from 'zustand'
import type { SCTMEntry, ControlStatus, ImplementationOrigin, BaselineProfile } from '@/types'
import { getControlIdsForBaseline } from '@/data/baselines'
import { DEFAULT_IMPLEMENTATIONS } from '@/data/defaultImplementations'
import { api } from '@/lib/api'

interface SCTMState {
  entries: Record<string, Record<string, SCTMEntry>>
  _loading: Record<string, boolean>
  _fetched: Record<string, boolean>

  fetchEntriesForSystem: (systemId: string) => Promise<void>
  initializeSystem: (systemId: string, baseline: BaselineProfile) => Promise<void>
  updateEntry: (systemId: string, controlId: string, updates: Partial<SCTMEntry>) => Promise<void>
  bulkUpdateStatus: (systemId: string, controlIds: string[], status: ControlStatus) => Promise<void>
  applyDefaultImplementations: (systemId: string, overwrite: boolean) => Promise<number>
  deleteSystemEntries: (systemId: string) => Promise<void>

  getEntriesForSystem: (systemId: string) => SCTMEntry[]
  getEntry: (systemId: string, controlId: string) => SCTMEntry | undefined
}

export const useSCTMStore = create<SCTMState>((set, get) => ({
  entries: {},
  _loading: {},
  _fetched: {},

  fetchEntriesForSystem: async (systemId) => {
    if (get()._fetched[systemId]) return
    set((state) => ({ _loading: { ...state._loading, [systemId]: true } }))
    try {
      const list = await api.get<SCTMEntry[]>(`/systems/${systemId}/sctm`)
      const byControl: Record<string, SCTMEntry> = {}
      for (const entry of list) byControl[entry.controlId] = entry
      set((state) => ({
        entries: { ...state.entries, [systemId]: byControl },
        _loading: { ...state._loading, [systemId]: false },
        _fetched: { ...state._fetched, [systemId]: true },
      }))
    } catch {
      set((state) => ({ _loading: { ...state._loading, [systemId]: false } }))
    }
  },

  initializeSystem: async (systemId, baseline) => {
    const existing = get().entries[systemId]
    if (existing && Object.keys(existing).length > 0) return
    const controlIds = getControlIdsForBaseline(baseline)
    const result = await api.post<{ entries: SCTMEntry[] }>(
      `/systems/${systemId}/sctm/initialize`,
      { controlIds }
    )
    const byControl: Record<string, SCTMEntry> = {}
    for (const entry of result.entries) byControl[entry.controlId] = entry
    set((state) => ({
      entries: { ...state.entries, [systemId]: byControl },
      _fetched: { ...state._fetched, [systemId]: true },
    }))
  },

  updateEntry: async (systemId, controlId, updates) => {
    const updated = await api.put<SCTMEntry>(
      `/systems/${systemId}/sctm/${controlId}`,
      updates
    )
    set((state) => ({
      entries: {
        ...state.entries,
        [systemId]: { ...state.entries[systemId], [controlId]: updated },
      },
    }))
  },

  bulkUpdateStatus: async (systemId, controlIds, status) => {
    await api.post(`/systems/${systemId}/sctm/bulk-status`, { controlIds, status })
    set((state) => {
      const systemEntries = { ...(state.entries[systemId] ?? {}) }
      const now = new Date().toISOString()
      for (const controlId of controlIds) {
        if (systemEntries[controlId]) {
          systemEntries[controlId] = { ...systemEntries[controlId], status, updatedAt: now }
        }
      }
      return { entries: { ...state.entries, [systemId]: systemEntries } }
    })
  },

  applyDefaultImplementations: async (systemId, overwrite) => {
    const systemEntries = get().entries[systemId] ?? {}
    const updates: Array<{
      controlId: string
      implementationStatement: string
      status: ControlStatus
      implementationOrigin: ImplementationOrigin
    }> = []

    for (const [controlId, defaults] of Object.entries(DEFAULT_IMPLEMENTATIONS)) {
      const existing = systemEntries[controlId]
      if (!existing) continue
      const isEmpty = !existing.implementationStatement?.trim()
      if (!overwrite && !isEmpty) continue
      updates.push({
        controlId,
        implementationStatement: defaults.implementationStatement,
        status: defaults.status,
        implementationOrigin: defaults.implementationOrigin,
      })
    }

    if (updates.length === 0) return 0

    const result = await api.post<{ modified: number }>(
      `/systems/${systemId}/sctm/bulk`,
      { updates }
    )

    const now = new Date().toISOString()
    set((state) => {
      const entries = { ...(state.entries[systemId] ?? {}) }
      for (const { controlId, ...fields } of updates) {
        if (entries[controlId]) {
          entries[controlId] = { ...entries[controlId], ...fields, updatedAt: now }
        }
      }
      return { entries: { ...state.entries, [systemId]: entries } }
    })

    return result.modified
  },

  deleteSystemEntries: async (systemId) => {
    await api.delete(`/systems/${systemId}/sctm`)
    set((state) => {
      const { [systemId]: _, ...restEntries } = state.entries
      const { [systemId]: _f, ...restFetched } = state._fetched
      return { entries: restEntries, _fetched: restFetched }
    })
  },

  getEntriesForSystem: (systemId) => {
    const systemEntries = get().entries[systemId] ?? {}
    return Object.values(systemEntries)
  },

  getEntry: (systemId, controlId) => {
    return get().entries[systemId]?.[controlId]
  },
}))
