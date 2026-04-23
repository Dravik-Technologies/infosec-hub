import { Routes, Route, Navigate } from 'react-router-dom';
import { Users, Building2, FileText, ClipboardList, Bell, Globe } from 'lucide-react';
import AppHeader          from '../../components/layout/AppHeader';
import { useAuth }        from '../../context/AuthContext';
import UsersPage          from '../Users';
import SitesPage          from '../Sites';
import AgreementsPage     from '../Agreements';
import AuditPage          from '../Audit';
import NotificationsPage  from '../Notifications';
import ProgramView        from '../ProgramView';

const BASE_TABS = [
  { label: 'Users',         to: '/admin',               icon: Users,         end: true },
  { label: 'Sites',         to: '/admin/sites',         icon: Building2 },
  { label: 'Documents',     to: '/admin/agreements',    icon: FileText },
  { label: 'Audit Log',     to: '/admin/audit',         icon: ClipboardList },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell },
];

const PROGRAM_TAB = { label: 'Program View', to: '/admin/program-view', icon: Globe };

export default function AdminApp() {
  const { user } = useAuth();
  const tabs = user?.role === 'Corporate Admin' ? [...BASE_TABS, PROGRAM_TAB] : BASE_TABS;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg">
      <AppHeader appName="Administration" appIcon={Users} tabs={tabs} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route index                  element={<UsersPage />} />
          <Route path="sites"           element={<SitesPage />} />
          <Route path="agreements"      element={<AgreementsPage />} />
          <Route path="audit"           element={<AuditPage />} />
          <Route path="notifications"   element={<NotificationsPage />} />
          <Route path="program-view"    element={<ProgramView />} />
          <Route path="*"               element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
