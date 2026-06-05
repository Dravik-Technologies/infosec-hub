import { Routes, Route, Navigate } from 'react-router-dom';
import { ShieldCheck, BookOpen, AlertTriangle } from 'lucide-react';
import AppLayout   from '../../components/layout/AppLayout';
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
    <AppLayout appName="Authorization & Compliance" appIcon={ShieldCheck} tabs={TABS}>
      <Routes>
        <Route index           element={<ATOPage />} />
        <Route path="controls" element={<ControlsPage />} />
        <Route path="poam"     element={<POAMPage />} />
        <Route path="*"        element={<Navigate to="/authorization" replace />} />
      </Routes>
    </AppLayout>
  );
}
