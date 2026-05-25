import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Mirrors server authz.js: platform admin roles + IT/InfoSec security roles + legacy Vulcan
const PLATFORM_ADMIN_ROLES = new Set(['Corporate Admin', 'Site Admin', 'Admin']);
const OPERATOR_SECURITY_ROLES = new Set(['Information Technology', 'Information Security']);
const LEGACY_VULCAN_ROLES = new Set(['Vulcan']);

function computeIsVulcan(user) {
  if (!user) return false;
  return PLATFORM_ADMIN_ROLES.has(user.role)
    || OPERATOR_SECURITY_ROLES.has(user.securityRole)
    || LEGACY_VULCAN_ROLES.has(user.role);
}

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

  const isVulcan = computeIsVulcan(user);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isVulcan }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
