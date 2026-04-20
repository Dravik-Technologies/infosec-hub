import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/auth/me', { withCredentials: true })
      .then(r => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const { data } = await axios.post('/auth/login', { username, password }, { withCredentials: true });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await axios.post('/auth/logout', {}, { withCredentials: true });
    setUser(null);
  };

  const isVulcan = user && ['Corporate Admin', 'Site Admin', 'Admin', 'Vulcan'].includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isVulcan }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
