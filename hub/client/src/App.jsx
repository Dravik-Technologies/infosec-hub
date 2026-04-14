import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Shield } from 'lucide-react';

import Landing from './pages/Landing';
import Login   from './pages/Login';
import Portal  from './pages/Portal';

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-scorva-bg gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-scorva-accent/10 border border-scorva-accent/20">
        <Shield size={22} className="text-scorva-accent" />
      </div>
      <div className="flex items-center gap-2 text-scorva-muted">
        <div className="w-4 h-4 border-2 border-scorva-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-mono tracking-widest">LOADING HUB...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <ThemeProvider>
        <LoadingScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route path="/portal" element={
          <ProtectedRoute><Portal /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
