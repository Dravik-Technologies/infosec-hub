import { create } from 'zustand'
import { useAuthStore } from '@/store/authStore'
import type { Diagram } from '@/types'

interface DiagramState {
  diagrams: Record<string, Diagram[]>
  _fetched: Record<string, boolean>

  fetchDiagrams: (systemId: string) => Promise<void>
  uploadDiagram: (systemId: string, formData: FormData) => Promise<void>
  deleteDiagram: (systemId: string, diagramId: string) => Promise<void>
  getDiagrams: (systemId: string) => Diagram[]
}

async function authedFetch(method: string, path: string, body?: FormData): Promise<Response> {
  const token = useAuthStore.getState().token
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api${path}`, { method, headers, body })
  if (res.status === 401) {
    useAuthStore.getState().logout()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  return res
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  diagrams: {},
  _fetched: {},

  fetchDiagrams: async (systemId) => {
    if (get()._fetched[systemId]) return
    try {
      const res = await authedFetch('GET', `/systems/${systemId}/diagrams`)
      const data = await res.json()
      set((state) => ({
        diagrams: { ...state.diagrams, [systemId]: data },
        _fetched: { ...state._fetched, [systemId]: true },
      }))
    } catch {}
  },

  uploadDiagram: async (systemId, formData) => {
    const res = await authedFetch('POST', `/systems/${systemId}/diagrams`, formData)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Upload failed')
    set((state) => ({
      diagrams: {
        ...state.diagrams,
        [systemId]: [data, ...(state.diagrams[systemId] ?? [])],
      },
    }))
  },

  deleteDiagram: async (systemId, diagramId) => {
    const res = await authedFetch('DELETE', `/systems/${systemId}/diagrams/${diagramId}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Delete failed')
    }
    set((state) => ({
      diagrams: {
        ...state.diagrams,
        [systemId]: (state.diagrams[systemId] ?? []).filter((d) => d.id !== diagramId),
      },
    }))
  },

  getDiagrams: (systemId) => get().diagrams[systemId] ?? [],
}))
