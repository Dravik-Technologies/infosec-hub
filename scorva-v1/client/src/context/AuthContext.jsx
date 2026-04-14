import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
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
    const { data } = await axios.post(`${BASE}/auth/login`, { username, password }, { withCredentials: true });
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await axios.post(`${BASE}/auth/logout`, {}, { withCredentials: true });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
