import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
} from 'lucide-react'
import { projectsApi } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { Project } from '@/types/project'
import ProjectSubnav from './ProjectSubnav'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function impactDot(level: Project['impactLevel']) {
  if (level === 'HIGH') return 'bg-red-alert'
  if (level === 'MODERATE') return 'bg-yellow-400'
  return 'bg-green-matrix'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    PLANNING: 'PLAN',
    IN_PROGRESS: 'ACTV',
    PENDING_ATO: 'PEND',
    AUTHORIZED: 'AUTH',
    DENIED: 'DENY',
    EXPIRED: 'EXPR',
    DRAFT: 'DRFT',
    ARCHIVED: 'ARCH',
  }
  return map[status] ?? status.slice(0, 4)
}

function statusColor(status: string) {
  if (status === 'AUTHORIZED') return 'text-green-matrix'
  if (status === 'IN_PROGRESS' || status === 'PENDING_ATO') return 'text-cyan-neon'
  if (status === 'DENIED' || status === 'EXPIRED') return 'text-red-alert'
  return 'text-slate-600'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, clearAuth } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Detect active project from URL — matches /projects/:id and /projects/:id/**
  const projectIdMatch = pathname.match(/^\/projects\/([^/]+)/)
  const activeProjectId = projectIdMatch?.[1] ?? null

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: queryKeys.projects.all,
    queryFn: projectsApi.list,
  })

  function logout() {
    clearAuth()
    navigate('/login')
  }

  const sidebarWidth = collapsed ? 52 : 192

  return (
    <div className="flex h-screen overflow-hidden bg-space text-slate-200">

      {/* ── Global Sidebar ──────────────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 transition-[width] duration-200 z-20"
        style={{
          width: sidebarWidth,
          background: 'rgb(var(--surface-sidebar) / 0.98)',
          borderRight: '1px solid var(--aegis-border)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 px-3 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--aegis-border)' }}
        >
          <div
            className="step-hex active flex-shrink-0"
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="font-mono font-bold text-xs">C</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-mono font-bold text-cyan-neon text-xs tracking-widest">CRATER</p>
              <p className="hud-label text-slate-600" style={{ fontSize: 9 }}>
                RMF COMMAND CENTER
              </p>
            </div>
          )}
        </div>

        {/* Primary nav links */}
        <div className="px-2 pt-2.5 flex-shrink-0 space-y-0.5">
          <NavLink
            to="/dashboard"
            end
            title={collapsed ? 'Dashboard' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2 py-2 rounded transition-colors border ${
                isActive
                  ? 'bg-cyan-neon/10 text-cyan-neon border-cyan-neon/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-transparent'
              }`
            }
          >
            <LayoutDashboard size={14} className="flex-shrink-0" />
            {!collapsed && <span className="hud-label text-current">DASHBOARD</span>}
          </NavLink>

          {/* Systems header row */}
          {!collapsed ? (
            <div className="flex items-center justify-between px-2 pt-2 pb-0.5">
              <span className="hud-label text-slate-600" style={{ fontSize: 9 }}>
                SYSTEMS
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate('/projects')}
                  title="All systems"
                  className="text-slate-600 hover:text-cyan-neon transition-colors"
                >
                  <FolderOpen size={11} />
                </button>
                <button
                  onClick={() => navigate('/projects')}
                  title="New system"
                  className="text-slate-600 hover:text-cyan-neon transition-colors"
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>
          ) : (
            <NavLink
              to="/projects"
              end
              title="Systems"
              className={({ isActive }) =>
                `flex items-center justify-center px-2 py-2 rounded transition-colors border ${
                  isActive
                    ? 'bg-cyan-neon/10 text-cyan-neon border-cyan-neon/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-transparent'
                }`
              }
            >
              <FolderOpen size={14} />
            </NavLink>
          )}
        </div>

        {/* Projects list — scrollable, takes all remaining space */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto px-2 pb-1 min-h-0">
            {projects.length === 0 ? (
              <p className="hud-label text-slate-700 px-2 py-2">No systems yet</p>
            ) : (
              projects.map((project) => (
                <NavLink
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors border ${
                      isActive
                        ? 'bg-cyan-neon/10 text-cyan-neon border-cyan-neon/20'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-transparent'
                    }`
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${impactDot(project.impactLevel)}`}
                  />
                  <span className="font-mono text-xs truncate flex-1 min-w-0">
                    {project.name}
                  </span>
                  <span
                    className={`font-mono flex-shrink-0 ${statusColor(project.status)}`}
                    style={{ fontSize: 9 }}
                  >
                    {statusLabel(project.status)}
                  </span>
                </NavLink>
              ))
            )}
          </div>
        )}

        {/* Bottom: Settings + user + logout + collapse */}
        <div
          className="flex-shrink-0 px-2 pt-2 pb-3 space-y-0.5"
          style={{ borderTop: '1px solid var(--aegis-border)' }}
        >
          <NavLink
            to="/settings"
            title={collapsed ? 'Settings' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2 py-2 rounded transition-colors border ${
                isActive
                  ? 'bg-cyan-neon/10 text-cyan-neon border-cyan-neon/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-transparent'
              }`
            }
          >
            <Settings size={14} className="flex-shrink-0" />
            {!collapsed && <span className="hud-label text-current">SETTINGS</span>}
          </NavLink>

          {!collapsed && user && (
            <div className="px-2 py-1">
              <p className="font-mono text-xs text-slate-400 truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="hud-label text-slate-600" style={{ fontSize: 9 }}>
                {user.role}
              </p>
            </div>
          )}

          <div className="flex gap-1.5 pt-0.5">
            <button
              onClick={logout}
              title="Logout"
              className="btn-secondary flex items-center justify-center gap-1.5 py-1.5 text-xs flex-1"
            >
              <LogOut size={12} />
              {!collapsed && 'LOGOUT'}
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="btn-secondary px-2 py-1.5"
            >
              {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Project Subnav (only while inside a project) ────────────────── */}
      {activeProjectId && <ProjectSubnav projectId={activeProjectId} />}

      {/* ── Main Area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top header bar */}
        <header
          className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
          style={{
            background: 'rgb(var(--surface-header) / 0.85)',
            borderBottom: '1px solid var(--aegis-border)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span className="hud-label text-slate-600">
            {activeProjectId ? 'SYSTEM WORKSPACE' : 'RMF COMMAND CENTER'}
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              title={isDark ? 'Light mode' : 'Dark mode'}
              className="btn-secondary inline-flex items-center gap-1.5 px-2 py-1 text-xs"
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
              <span className="hidden lg:inline">{isDark ? 'LIGHT' : 'DARK'}</span>
            </button>

            <button className="notification-pulse text-cyan-neon/60 hover:text-cyan-neon transition-colors">
              <Bell size={15} />
            </button>

            <span className="hud-label text-slate-600">|</span>
            <span className="font-mono text-xs text-slate-500 truncate max-w-[200px]">
              {user?.email}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  )
}
