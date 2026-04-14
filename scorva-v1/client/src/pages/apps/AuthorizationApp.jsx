import { Routes, Route, Navigate } from 'react-router-dom';
import { ShieldCheck, BookOpen, AlertTriangle } from 'lucide-react';
import AppHeader   from '../../components/layout/AppHeader';
import ATOPage     from '../ATO';
import ControlsPage from '../Controls';
import POAMPage    from '../POAM';

const TABS = [
  { label: 'ATO',      to: '/authorization',          icon: ShieldCheck,   end: true },
  { label: 'Controls', to: '/authorization/controls', icon: BookOpen },
  { label: 'POAM',     to: '/authorization/poam',     icon: AlertTriangle },
];

export default function AuthorizationApp() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg">
      <AppHeader appName="Authorization & Compliance" appIcon={ShieldCheck} tabs={TABS} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route index           element={<ATOPage />} />
          <Route path="controls" element={<ControlsPage />} />
          <Route path="poam"     element={<POAMPage />} />
          <Route path="*"        element={<Navigate to="/authorization" replace />} />
        </Routes>
      </main>
    </div>
  );
}
