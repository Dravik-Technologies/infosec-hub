import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    axios.get(`${BASE}/api/me`, { withCredentials: true })
      .then(r => {
        const { selectedSite: ss, ...userData } = r.data;
        setUser(userData);
        setSelectedSite(ss || null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const { data } = await axios.post(`${BASE}/auth/login`, { username, password }, { withCredentials: true });
    setUser(data.user);
    setSelectedSite(null);
    return data.user;
  }

  async function logout() {
    await axios.post(`${BASE}/auth/logout`, {}, { withCredentials: true });
    setUser(null);
    setSelectedSite(null);
  }

  /** Corporate Admin only — pass null to go back to "All Sites" */
  async function selectSite(siteId) {
    const { data } = await axios.post(`${BASE}/auth/select-site`, { siteId: siteId || null }, { withCredentials: true });
    setSelectedSite(data.selectedSite);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, selectedSite, selectSite }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
