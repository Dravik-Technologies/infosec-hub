import { create } from 'zustand'
import type { InfoSystem } from '@/types'
import { api } from '@/lib/api'

interface SystemState {
  systems: InfoSystem[]
  activeSystemId: string | null
  isLoading: boolean
  error: string | null

  fetchSystems: () => Promise<void>
  addSystem: (system: InfoSystem) => Promise<void>
  updateSystem: (id: string, updates: Partial<InfoSystem>) => Promise<void>
  deleteSystem: (id: string) => Promise<void>
  setActiveSystem: (id: string | null) => void
  getSystemById: (id: string) => InfoSystem | undefined
}

export const useSystemStore = create<SystemState>((set, get) => ({
  systems: [],
  activeSystemId: null,
  isLoading: false,
  error: null,

  fetchSystems: async () => {
    set({ isLoading: true, error: null })
    try {
      const systems = await api.get<InfoSystem[]>('/systems')
      set({ systems, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  addSystem: async (system) => {
    await api.post<InfoSystem>('/systems', system)
    set((state) => ({ systems: [...state.systems, system] }))
  },

  updateSystem: async (id, updates) => {
    const updated = await api.put<InfoSystem>(`/systems/${id}`, updates)
    set((state) => ({
      systems: state.systems.map((s) => (s.id === id ? updated : s)),
    }))
  },

  deleteSystem: async (id) => {
    await api.delete(`/systems/${id}`)
    set((state) => ({
      systems: state.systems.filter((s) => s.id !== id),
      activeSystemId: state.activeSystemId === id ? null : state.activeSystemId,
    }))
  },

  setActiveSystem: (id) => set({ activeSystemId: id }),

  getSystemById: (id) => get().systems.find((s) => s.id === id),
}))
