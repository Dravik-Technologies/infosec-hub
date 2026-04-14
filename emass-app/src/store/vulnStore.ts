import { create } from 'zustand'
import type { Vulnerability } from '@/types'
import { api } from '@/lib/api'

interface VulnState {
  items: Record<string, Vulnerability[]>
  _fetched: Record<string, boolean>

  fetchVulnsForSystem: (systemId: string) => Promise<void>
  addVuln: (systemId: string, vuln: Vulnerability) => Promise<void>
  updateVuln: (systemId: string, vulnId: string, updates: Partial<Vulnerability>) => Promise<void>
  deleteVuln: (systemId: string, vulnId: string) => Promise<void>
  deleteSystemVulns: (systemId: string) => Promise<void>
  escalateToPOAM: (systemId: string, vulnId: string, poamId: string) => Promise<void>

  getVulnsForSystem: (systemId: string) => Vulnerability[]
}

export const useVulnStore = create<VulnState>((set, get) => ({
  items: {},
  _fetched: {},

  fetchVulnsForSystem: async (systemId) => {
    if (get()._fetched[systemId]) return
    try {
      const vulns = await api.get<Vulnerability[]>(`/systems/${systemId}/vulnerabilities`)
      set((state) => ({
        items: { ...state.items, [systemId]: vulns },
        _fetched: { ...state._fetched, [systemId]: true },
      }))
    } catch {}
  },

  addVuln: async (systemId, vuln) => {
    const created = await api.post<Vulnerability>(`/systems/${systemId}/vulnerabilities`, vuln)
    set((state) => ({
      items: {
        ...state.items,
        [systemId]: [...(state.items[systemId] ?? []), created],
      },
    }))
  },

  updateVuln: async (systemId, vulnId, updates) => {
    const updated = await api.put<Vulnerability>(
      `/systems/${systemId}/vulnerabilities/${vulnId}`,
      updates
    )
    set((state) => ({
      items: {
        ...state.items,
        [systemId]: (state.items[systemId] ?? []).map((v) => (v.id === vulnId ? updated : v)),
      },
    }))
  },

  deleteVuln: async (systemId, vulnId) => {
    await api.delete(`/systems/${systemId}/vulnerabilities/${vulnId}`)
    set((state) => ({
      items: {
        ...state.items,
        [systemId]: (state.items[systemId] ?? []).filter((v) => v.id !== vulnId),
      },
    }))
  },

  deleteSystemVulns: async (systemId) => {
    await api.delete(`/systems/${systemId}/vulnerabilities`)
    set((state) => {
      const { [systemId]: _, ...rest } = state.items
      return { items: rest }
    })
  },

  escalateToPOAM: async (systemId, vulnId, poamId) => {
    const updated = await api.put<Vulnerability>(
      `/systems/${systemId}/vulnerabilities/${vulnId}`,
      { poamId, status: 'POAM Created' }
    )
    set((state) => ({
      items: {
        ...state.items,
        [systemId]: (state.items[systemId] ?? []).map((v) => (v.id === vulnId ? updated : v)),
      },
    }))
  },

  getVulnsForSystem: (systemId) => get().items[systemId] ?? [],
}))
