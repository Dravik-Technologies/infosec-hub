import { Routes, Route, Navigate } from 'react-router-dom';
import { Monitor, Key, Package } from 'lucide-react';
import AppLayout        from '../../components/layout/AppLayout';
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
    <AppLayout appName="Asset Inventory" appIcon={Monitor} tabs={TABS}>
      <Routes>
        <Route index           element={<WorkstationsPage />} />
        <Route path="yubikeys" element={<YubiKeysPage />} />
        <Route path="licenses" element={<LicensesPage />} />
        <Route path="*"        element={<Navigate to="/assets" replace />} />
      </Routes>
    </AppLayout>
  );
}
