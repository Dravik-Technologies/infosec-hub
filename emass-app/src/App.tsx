import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import ProtectedRoute from '@/components/ProtectedRoute'
import LandingPage from '@/pages/LandingPage'
import WizardPage from '@/pages/WizardPage'
import DashboardPage from '@/pages/DashboardPage'
import SCTMPage from '@/pages/SCTMPage'
import ControlDetailPage from '@/pages/ControlDetailPage'
import POAMPage from '@/pages/POAMPage'
import VulnerabilitiesPage from '@/pages/VulnerabilitiesPage'
import ReportsPage from '@/pages/ReportsPage'
import DiagramsPage from '@/pages/DiagramsPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<LandingPage />} />
            <Route path="systems/new" element={<WizardPage />} />
            <Route path="systems/:systemId">
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="sctm" element={<SCTMPage />} />
              <Route path="sctm/:controlId" element={<ControlDetailPage />} />
              <Route path="poam" element={<POAMPage />} />
              <Route path="vulnerabilities" element={<VulnerabilitiesPage />} />
              <Route path="diagrams" element={<DiagramsPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
