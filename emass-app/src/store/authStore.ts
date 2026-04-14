import { create } from 'zustand'

export interface AuthUser {
  id: string
  username: string
  email: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

function loadUser(): AuthUser | null {
  try {
    const u = localStorage.getItem('crater-user')
    return u ? JSON.parse(u) : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('crater-token'),
  user: loadUser(),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Login failed')
      localStorage.setItem('crater-token', data.token)
      localStorage.setItem('crater-user', JSON.stringify(data.user))
      set({ token: data.token, user: data.user, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')
      localStorage.setItem('crater-token', data.token)
      localStorage.setItem('crater-user', JSON.stringify(data.user))
      set({ token: data.token, user: data.user, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('crater-token')
    localStorage.removeItem('crater-user')
    set({ token: null, user: null })
  },
}))
