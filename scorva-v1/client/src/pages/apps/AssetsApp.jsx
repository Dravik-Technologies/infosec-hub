import { Routes, Route, Navigate } from 'react-router-dom';
import { Monitor, Key, Package } from 'lucide-react';
import AppHeader        from '../../components/layout/AppHeader';
import WorkstationsPage from '../Workstations';
import YubiKeysPage     from '../YubiKeys';
import LicensesPage     from '../Licenses';

const TABS = [
  { label: 'Devices',      to: '/assets',           icon: Monitor,  end: true },
  { label: 'YubiKeys',     to: '/assets/yubikeys',  icon: Key },
  { label: 'Licenses',     to: '/assets/licenses',  icon: Package },
];

export default function AssetsApp() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg">
      <AppHeader appName="Asset Inventory" appIcon={Monitor} tabs={TABS} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route index           element={<WorkstationsPage />} />
          <Route path="yubikeys" element={<YubiKeysPage />} />
          <Route path="licenses" element={<LicensesPage />} />
          <Route path="*"        element={<Navigate to="/assets" replace />} />
        </Routes>
      </main>
    </div>
  );
}
