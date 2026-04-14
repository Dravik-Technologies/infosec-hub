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
   * @param {string} appUrl - base URL of the target app
   * @returns {Promise<string>} full launch URL with hub_token param
   */
  async function launchApp(appUrl) {
    const { data } = await axios.post(
      `${BASE}/api/sso/token`,
      {},
      { withCredentials: true }
    );
    return `${appUrl}?hub_token=${data.token}`;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, launchApp }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
