import { create } from 'zustand'
import type { POAMItem } from '@/types'
import { format } from 'date-fns'
import { api } from '@/lib/api'

interface POAMState {
  items: Record<string, POAMItem[]>
  _fetched: Record<string, boolean>

  fetchItemsForSystem: (systemId: string) => Promise<void>
  addItem: (systemId: string, item: POAMItem) => Promise<void>
  updateItem: (systemId: string, itemId: string, updates: Partial<POAMItem>) => Promise<void>
  deleteItem: (systemId: string, itemId: string) => Promise<void>
  deleteSystemItems: (systemId: string) => Promise<void>

  getItemsForSystem: (systemId: string) => POAMItem[]
  generatePoamId: (systemId: string) => string
}

export const usePOAMStore = create<POAMState>((set, get) => ({
  items: {},
  _fetched: {},

  fetchItemsForSystem: async (systemId) => {
    if (get()._fetched[systemId]) return
    try {
      const items = await api.get<POAMItem[]>(`/systems/${systemId}/poam`)
      set((state) => ({
        items: { ...state.items, [systemId]: items },
        _fetched: { ...state._fetched, [systemId]: true },
      }))
    } catch {}
  },

  addItem: async (systemId, item) => {
    const created = await api.post<POAMItem>(`/systems/${systemId}/poam`, item)
    set((state) => ({
      items: {
        ...state.items,
        [systemId]: [...(state.items[systemId] ?? []), created],
      },
    }))
  },

  updateItem: async (systemId, itemId, updates) => {
    const updated = await api.put<POAMItem>(`/systems/${systemId}/poam/${itemId}`, updates)
    set((state) => ({
      items: {
        ...state.items,
        [systemId]: (state.items[systemId] ?? []).map((item) =>
          item.id === itemId ? updated : item
        ),
      },
    }))
  },

  deleteItem: async (systemId, itemId) => {
    await api.delete(`/systems/${systemId}/poam/${itemId}`)
    set((state) => ({
      items: {
        ...state.items,
        [systemId]: (state.items[systemId] ?? []).filter((item) => item.id !== itemId),
      },
    }))
  },

  deleteSystemItems: async (systemId) => {
    await api.delete(`/systems/${systemId}/poam`)
    set((state) => {
      const { [systemId]: _, ...rest } = state.items
      return { items: rest }
    })
  },

  getItemsForSystem: (systemId) => get().items[systemId] ?? [],

  generatePoamId: (systemId) => {
    const existing = get().items[systemId] ?? []
    const year = format(new Date(), 'yyyy')
    const nextNum = existing.length + 1
    return `POAM-${year}-${String(nextNum).padStart(3, '0')}`
  },
}))
