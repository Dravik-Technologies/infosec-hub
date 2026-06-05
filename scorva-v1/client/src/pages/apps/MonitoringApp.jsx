import { Routes, Route, Navigate } from 'react-router-dom';
import { Activity, CheckSquare, LayoutGrid, Zap, ClipboardList } from 'lucide-react';
import AppLayout          from '../../components/layout/AppLayout';
import ConMonPage         from '../ConMon';
import TasksPage          from '../Tasks';
import TrackersPage       from '../Trackers';
import SecurityEventsPage from '../SecurityEvents';
import ChecklistLibrary   from '../ChecklistLibrary';

const TABS = [
  { label: 'ConMon',           to: '/monitoring',                  icon: Activity,      end: true },
  { label: 'My Taskers',       to: '/monitoring/tasks',            icon: CheckSquare },
  { label: 'Trackers',         to: '/monitoring/trackers',         icon: LayoutGrid },
  { label: 'Security Events',  to: '/monitoring/events',           icon: Zap },
  { label: 'Self-Inspection',  to: '/monitoring/self-inspection',  icon: ClipboardList },
];

export default function MonitoringApp() {
  return (
    <AppLayout appName="Monitoring & Operations" appIcon={Activity} tabs={TABS}>
      <Routes>
          <Route index                   element={<ConMonPage />} />
          <Route path="tasks"            element={<TasksPage />} />
          <Route path="trackers"         element={<TrackersPage />} />
          <Route path="events"           element={<SecurityEventsPage />} />
          <Route path="self-inspection"  element={<ChecklistLibrary />} />
          <Route path="*"                element={<Navigate to="/monitoring" replace />} />
        </Routes>
    </AppLayout>
  );
}
