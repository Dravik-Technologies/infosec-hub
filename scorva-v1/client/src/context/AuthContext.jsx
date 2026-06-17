import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';
const TOKEN_KEY = 'scorva_token';
const SELECTED_SITE_KEY = 'scorva_selected_site';
const AuthContext = createContext(null);

/**
 * Creates auth headers from the locally stored JWT.
 */
function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [selectedSite, setSelectedSite] = useState(localStorage.getItem(SELECTED_SITE_KEY) || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        // Prefer the secure cookie/session path so SSO does not depend on localStorage.
        const cookieSession = await axios.get(`${BASE}/api/me`, { withCredentials: true });
        if (!mounted) return;
        localStorage.removeItem(TOKEN_KEY);
        setUser(cookieSession.data);
        setLoading(false);
        return;
      } catch (_) {}

      try {
        const bearerSession = await axios.get(`${BASE}/api/me`, { headers: authHeaders() });
        if (!mounted) return;
        setUser(bearerSession.data);
      } catch (_) {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Authenticates the user, stores JWT, and hydrates user claims.
   */
  async function login(username, password) {
    const { data } = await axios.post(`${BASE}/auth/login`, { username, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    const isAdmin = Boolean(data.user?.canSeeAllSites) || data.user?.hubRole === 'Hub Admin' || data.user?.role === 'Corporate Admin';
    if (!isAdmin) {
      localStorage.removeItem(SELECTED_SITE_KEY);
      setSelectedSite(null);
    }
    return data.user;
  }

  /**
   * Clears local auth state and token.
   */
  async function logout() {
    try {
      await axios.post(`${BASE}/auth/logout`, {}, { headers: authHeaders() });
    } catch (_) {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SELECTED_SITE_KEY);
    setUser(null);
    setSelectedSite(null);
  }

  /**
   * Corporate Admin-only site switcher state.
   * Site value is persisted and sent as `x-selected-site` header by the API client.
   */
  async function selectSite(siteId) {
    const nextSite = siteId || null;
    if (nextSite) localStorage.setItem(SELECTED_SITE_KEY, nextSite);
    else localStorage.removeItem(SELECTED_SITE_KEY);
    setSelectedSite(nextSite);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, selectedSite, selectSite }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
