import { Routes, Route, Navigate } from 'react-router-dom';
import { Activity, CheckSquare, LayoutGrid } from 'lucide-react';
import AppHeader    from '../../components/layout/AppHeader';
import ConMonPage   from '../ConMon';
import TasksPage    from '../Tasks';
import TrackersPage from '../Trackers';

const TABS = [
  { label: 'ConMon',   to: '/monitoring',          icon: Activity,     end: true },
  { label: 'My Taskers', to: '/monitoring/tasks', icon: CheckSquare },
  { label: 'Trackers', to: '/monitoring/trackers', icon: LayoutGrid },
];

export default function MonitoringApp() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg">
      <AppHeader appName="Monitoring & Operations" appIcon={Activity} tabs={TABS} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route index           element={<ConMonPage />} />
          <Route path="tasks"    element={<TasksPage />} />
          <Route path="trackers" element={<TrackersPage />} />
          <Route path="*"        element={<Navigate to="/monitoring" replace />} />
        </Routes>
      </main>
    </div>
  );
}
