import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${BASE}/api/me`, { withCredentials: true })
      .then(r  => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const { data } = await axios.post(
      `${BASE}/auth/login`,
      { username, password },
      { withCredentials: true }
    );
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await axios.post(`${BASE}/auth/logout`, {}, { withCredentials: true });
    setUser(null);
  }

  /**
   * Generate a one-time SSO token and build the launch URL for an external app.
   * @param {string} appUrl   - base URL of the target app
   * @param {string|null} ssoPath - server-side SSO path (e.g. '/auth/sso'),
   *   empty string for client-side SSO, or null if the app needs no auth.
   * @returns {Promise<string>} full launch URL
   */
  async function launchApp(appUrl, ssoPath) {
    if (ssoPath === null || ssoPath === undefined) {
      // App needs no authentication — open directly
      return appUrl;
    }
    const { data } = await axios.post(
      `${BASE}/api/sso/token`,
      {},
      { withCredentials: true }
    );
    if (ssoPath === '') {
      // Client-side SSO: React app detects hub_token in URL params
      return `${appUrl}?hub_token=${data.token}`;
    }
    // Server-side SSO: dedicated endpoint sets session/token then redirects
    return `${appUrl}${ssoPath}?hub_token=${data.token}`;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, launchApp }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
