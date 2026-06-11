import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setApiAuthToken } from '@/api/client'
import type { User } from '@/types/auth'

interface StoredAuth {
  user: User | null
  token: string | null
}

interface AuthContextValue extends StoredAuth {
  isAuthenticated: boolean
  isLoading: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

const STORAGE_KEY = 'crater-auth'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredAuth(): StoredAuth {
  const emptyAuth: StoredAuth = { user: null, token: null }
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) return emptyAuth

  try {
    const parsed = JSON.parse(raw)
    const auth = parsed?.state ?? parsed

    return {
      user: auth?.user ?? null,
      token: auth?.token ?? null,
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return emptyAuth
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setStoredAuth] = useState<StoredAuth>(() => readStoredAuth())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setApiAuthToken(auth.token)

    if (auth.token && auth.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }

    setIsLoading(false)
  }, [auth])

  const setAuth = useCallback((user: User, token: string) => {
    setStoredAuth({ user, token })
  }, [])

  const clearAuth = useCallback(() => {
    setStoredAuth({ user: null, token: null })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      isAuthenticated: Boolean(auth.user && auth.token),
      isLoading,
      setAuth,
      clearAuth,
    }),
    [auth, clearAuth, isLoading, setAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
