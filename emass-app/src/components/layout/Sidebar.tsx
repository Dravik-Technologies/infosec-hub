import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Shield, FileText, AlertTriangle,
  Bug, BarChart3, Plus, Layers, LogOut, Image,
} from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/cn'
import { getATOStatusColor } from '@/lib/utils'

const navItem = (to: string, icon: React.ReactNode, label: string) => (
  <NavLink
    key={to}
    to={to}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-navy-700/60'
      )
    }
  >
    <span className="w-4 h-4 shrink-0">{icon}</span>
    <span>{label}</span>
  </NavLink>
)

export default function Sidebar() {
  const activeSystemId = useSystemStore((s) => s.activeSystemId)
  const systems = useSystemStore((s) => s.systems)
  const activeSystem = systems.find((s) => s.id === activeSystemId)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className="w-60 shrink-0 flex flex-col border-r"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wider text-teal-400">CRATER</div>
            <div className="text-[10px] text-slate-500 leading-none">RMF Compliance Engine</div>
          </div>
        </div>
      </div>

      {/* Global nav */}
      <div className="px-3 pt-4 pb-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive && !activeSystemId
                ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-navy-700/60'
            )
          }
          end
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>All Systems</span>
        </NavLink>
      </div>

      {/* System context nav */}
      {activeSystem && (
        <>
          <div className="mx-3 my-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }} />

          {/* Active system header */}
          <div className="px-4 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Active System
            </div>
            <div
              className="p-2.5 rounded-lg border cursor-pointer hover:border-teal-500/30 transition-colors"
              style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
              onClick={() => navigate(`/systems/${activeSystem.id}/dashboard`)}
            >
              <div className="text-xs font-semibold text-slate-200 truncate">{activeSystem.name}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-mono text-slate-500">{activeSystem.abbreviation}</span>
                <span className="text-slate-600">·</span>
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded border',
                    getATOStatusColor(activeSystem.atoStatus)
                  )}
                >
                  {activeSystem.atoStatus}
                </span>
              </div>
            </div>
          </div>

          <nav className="px-3 pb-2 flex flex-col gap-0.5">
            {navItem(`/systems/${activeSystem.id}/dashboard`, <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}
            {navItem(`/systems/${activeSystem.id}/sctm`, <Shield className="w-4 h-4" />, 'SCTM')}
            {navItem(`/systems/${activeSystem.id}/poam`, <FileText className="w-4 h-4" />, 'POAM')}
            {navItem(`/systems/${activeSystem.id}/vulnerabilities`, <Bug className="w-4 h-4" />, 'Vulnerabilities')}
            {navItem(`/systems/${activeSystem.id}/diagrams`, <Image className="w-4 h-4" />, 'Diagrams')}
            {navItem(`/systems/${activeSystem.id}/reports`, <BarChart3 className="w-4 h-4" />, 'Reports')}
          </nav>
        </>
      )}

      {/* Footer */}
      <div className="mt-auto p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        {user && (
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-300 truncate">{user.username}</div>
              <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0 ml-2"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button
          onClick={() => navigate('/systems/new')}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium bg-teal-500/15 text-teal-400 border border-teal-500/25 hover:bg-teal-500/25 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New System
        </button>
      </div>
    </aside>
  )
}
