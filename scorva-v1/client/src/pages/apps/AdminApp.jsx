import { Routes, Route, Navigate } from 'react-router-dom';
import { Users, Building2, FileText, ClipboardList, Bell } from 'lucide-react';
import AppHeader          from '../../components/layout/AppHeader';
import UsersPage          from '../Users';
import SitesPage          from '../Sites';
import AgreementsPage     from '../Agreements';
import AuditPage          from '../Audit';
import NotificationsPage  from '../Notifications';

const TABS = [
  { label: 'Users',         to: '/admin',               icon: Users,         end: true },
  { label: 'Sites',         to: '/admin/sites',         icon: Building2 },
  { label: 'Documents',     to: '/admin/agreements',    icon: FileText },
  { label: 'Audit Log',     to: '/admin/audit',         icon: ClipboardList },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell },
];

export default function AdminApp() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg">
      <AppHeader appName="Administration" appIcon={Users} tabs={TABS} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route index                element={<UsersPage />} />
          <Route path="sites"         element={<SitesPage />} />
          <Route path="agreements"    element={<AgreementsPage />} />
          <Route path="audit"         element={<AuditPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="*"             element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
