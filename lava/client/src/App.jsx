import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import NavBar        from './components/NavBar';
import Landing       from './pages/Landing';
import Login         from './pages/Login';
import SaarForm      from './pages/SaarForm';
import VulcanCommand from './pages/VulcanCommand';
import SystemRequest from './pages/SystemRequest';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>AUTHENTICATING...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function RequireVulcan({ children }) {
  const { user, loading, isVulcan } = useAuth();
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>AUTHENTICATING...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isVulcan) return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--orange)', fontSize: '1.2rem' }}>ACCESS DENIED</p>
      <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>Vulcan clearance required.</p>
    </div>
  );
  return children;
}

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/"        element={<Landing />} />
          <Route path="/login"   element={<Login />} />
          <Route path="/apply"   element={<SaarForm />} />
          <Route path="/vulcan"  element={<RequireVulcan><VulcanCommand /></RequireVulcan>} />
          <Route path="/systems" element={<RequireAuth><SystemRequest /></RequireAuth>} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', borderTop: '1px solid var(--border)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
        LAVA NETWORK SYSTEM &nbsp;|&nbsp; CLASSIFICATION: UNCLASSIFIED &nbsp;|&nbsp; FOR OFFICIAL USE ONLY
      </footer>
    </div>
  );
}
