import { createJSONStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'

/**
 * Zustand-compatible async storage backed by IndexedDB (via idb-keyval).
 * Writes are non-blocking — they never freeze the main thread.
 * On first access, transparently migrates any existing localStorage data.
 */
export const idbStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    // Check IndexedDB first
    const idbValue = await get<string>(name)
    if (idbValue !== undefined) return idbValue

    // Migrate from localStorage if present
    const lsValue = localStorage.getItem(name)
    if (lsValue !== null) {
      await set(name, lsValue)
      localStorage.removeItem(name)
      return lsValue
    }

    return null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name)
  },
}))
