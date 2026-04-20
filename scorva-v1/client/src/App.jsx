import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Shield } from 'lucide-react';

import Landing          from './pages/Landing';
import Login            from './pages/Login';
import Portal           from './pages/Portal';
import AuthorizationApp from './pages/apps/AuthorizationApp';
import MonitoringApp    from './pages/apps/MonitoringApp';
import AssetsApp        from './pages/apps/AssetsApp';
import AdminApp         from './pages/apps/AdminApp';

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-scorva-bg gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-scorva-accent/10 border border-scorva-accent/20">
        <Shield size={22} className="text-scorva-accent" />
      </div>
      <div className="flex items-center gap-2 text-scorva-muted">
        <div className="w-4 h-4 border-2 border-scorva-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-mono tracking-widest">LOADING SCORVA...</span>
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

        {/* ── Public ── */}
        <Route path="/"      element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* ── Protected: Command Center ── */}
        <Route path="/portal" element={
          <ProtectedRoute><Portal /></ProtectedRoute>
        } />

        {/* ── Protected: Mission Apps ── */}
        <Route path="/authorization/*" element={
          <ProtectedRoute><AuthorizationApp /></ProtectedRoute>
        } />
        <Route path="/monitoring/*" element={
          <ProtectedRoute><MonitoringApp /></ProtectedRoute>
        } />
        <Route path="/assets/*" element={
          <ProtectedRoute><AssetsApp /></ProtectedRoute>
        } />
        <Route path="/admin/*" element={
          <ProtectedRoute><AdminApp /></ProtectedRoute>
        } />

        {/* ── Legacy redirects (old single-page routes) ── */}
        <Route path="/dashboard"    element={<Navigate to="/portal"                    replace />} />
        <Route path="/ato"          element={<Navigate to="/authorization"             replace />} />
        <Route path="/controls"     element={<Navigate to="/authorization/controls"   replace />} />
        <Route path="/poam"         element={<Navigate to="/authorization/poam"       replace />} />
        <Route path="/conmon"       element={<Navigate to="/monitoring"               replace />} />
        <Route path="/tasks"        element={<Navigate to="/monitoring/tasks"         replace />} />
        <Route path="/trackers"     element={<Navigate to="/monitoring/trackers"      replace />} />
        <Route path="/workstations" element={<Navigate to="/assets"                   replace />} />
        <Route path="/yubikeys"     element={<Navigate to="/assets/yubikeys"          replace />} />
        <Route path="/licenses"     element={<Navigate to="/assets/licenses"          replace />} />
        <Route path="/users"        element={<Navigate to="/admin"                    replace />} />
        <Route path="/sites"        element={<Navigate to="/admin/sites"              replace />} />
        <Route path="/agreements"   element={<Navigate to="/admin/agreements"         replace />} />
        <Route path="/audit"        element={<Navigate to="/admin/audit"              replace />} />
        <Route path="/notifications" element={<Navigate to="/admin/notifications"     replace />} />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </ThemeProvider>
  );
}
