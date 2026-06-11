import { useState, type ElementType } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminUser, type PlatformStats } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/hooks/useAuth'
import {
  Settings,
  Users,
  Cpu,
  Shield,
  Plug,
  Info,
  Loader2,
  AlertTriangle,
  Activity,
  FolderOpen,
  Lock,
  CheckCircle,
  XCircle,
  Server,
} from 'lucide-react'
import AuditLogPage from '@/pages/projects/AuditLogPage'

// ─── Tab config ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general', label: 'GENERAL CONFIG', icon: Settings },
  { id: 'users', label: 'USER MANAGEMENT', icon: Users },
  { id: 'defaults', label: 'SYSTEM DEFAULTS', icon: Shield },
  { id: 'ai', label: 'AI CONFIGURATION', icon: Cpu },
  { id: 'audit', label: 'AUDIT LOG', icon: Activity },
  { id: 'integrations', label: 'INTEGRATIONS', icon: Plug },
  { id: 'about', label: 'ABOUT', icon: Info },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Role styles ─────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'text-red-400 bg-red-400/10 border-red-400/30',
  SYSTEM_OWNER: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  ISSO: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  ISSM: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  ISSE: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  SCA: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  AO: 'text-green-400 bg-green-400/10 border-green-400/30',
  DAO: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
  VIEWER: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
}

const ALL_ROLES = ['ADMIN', 'SYSTEM_OWNER', 'ISSO', 'ISSM', 'ISSE', 'SCA', 'AO', 'DAO', 'VIEWER']

// ─── Small helpers ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number | string
  icon: ElementType
  accent?: string
}) {
  return (
    <div className="rmf-card p-4 flex items-center gap-3">
      <div className={`p-2 rounded ${accent ?? 'bg-cyan-neon/10'}`}>
        <Icon size={14} className={accent ? 'text-orange-400' : 'text-cyan-neon'} />
      </div>
      <div>
        <p className="hud-label text-slate-500" style={{ fontSize: 9 }}>
          {label}
        </p>
        <p className="font-mono text-lg text-slate-100 leading-tight">{value}</p>
      </div>
    </div>
  )
}

function ConfigRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-700/40 last:border-0">
      <span className="hud-label text-slate-400" style={{ fontSize: 10 }}>
        {label}
      </span>
      <span className="font-mono text-sm text-slate-200">{String(value)}</span>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-mono text-sm text-slate-100">{title}</h2>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

// ─── Tab: General Configuration ─────────────────────────────────────────────

function GeneralTab({ stats, loading }: { stats?: PlatformStats; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm">Loading platform data…</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="rmf-card p-5">
        <SectionHeader title="PLATFORM STATUS" subtitle="Runtime environment and service health" />
        <div className="space-y-0">
          <ConfigRow label="ENVIRONMENT" value={stats?.config.nodeEnv ?? '—'} />
          <ConfigRow label="PORT" value={stats?.config.port ?? '—'} />
          <ConfigRow label="AI PROVIDER" value={stats?.config.aiProvider ?? '—'} />
          <ConfigRow label="OLLAMA ENDPOINT" value={stats?.config.ollamaUrl ?? '—'} />
        </div>
      </div>

      <div className="rmf-card p-5">
        <SectionHeader title="PLATFORM METRICS" subtitle="Aggregate resource counts" />
        <div className="space-y-0">
          <ConfigRow label="TOTAL USERS" value={stats?.users.total ?? '—'} />
          <ConfigRow label="ACTIVE USERS" value={stats?.users.active ?? '—'} />
          <ConfigRow label="PROJECTS" value={stats?.projects ?? '—'} />
          <ConfigRow label="CONTROLS (CATALOG)" value={stats?.controls ?? '—'} />
          <ConfigRow label="OPEN POA&amp;Ms" value={stats?.openPoams ?? '—'} />
        </div>
      </div>

      <div className="rmf-card p-5 col-span-2">
        <SectionHeader title="ROLE DISTRIBUTION" subtitle="Active users per role" />
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => {
            const count = stats?.users.byRole[role] ?? 0
            if (count === 0) return null
            return (
              <div
                key={role}
                className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono ${ROLE_COLORS[role] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/30'}`}
              >
                <span>{role}</span>
                <span className="opacity-70">{count}</span>
              </div>
            )
          })}
          {!stats?.users.byRole || Object.keys(stats.users.byRole).length === 0 ? (
            <span className="text-sm text-slate-500">No role data available.</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: User Management ────────────────────────────────────────────────────

function UsersTab({
  users,
  loading,
  currentUserId,
  onUpdateRole,
  onToggleActive,
  updatingId,
}: {
  users?: AdminUser[]
  loading: boolean
  currentUserId?: string
  onUpdateRole: (id: string, role: string) => void
  onToggleActive: (id: string, isActive: boolean) => void
  updatingId: string | null
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm">Loading users…</span>
      </div>
    )
  }

  return (
    <div className="rmf-card overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <p className="hud-label text-slate-400" style={{ fontSize: 10 }}>
            USER MANAGEMENT
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {users?.length ?? 0} user{users?.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400/80" />
          <span className="hud-label text-slate-500" style={{ fontSize: 9 }}>
            LIVE
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-2.5 hud-label text-slate-500" style={{ fontSize: 9 }}>
                USER
              </th>
              <th className="text-left px-4 py-2.5 hud-label text-slate-500" style={{ fontSize: 9 }}>
                ROLE
              </th>
              <th className="text-center px-4 py-2.5 hud-label text-slate-500" style={{ fontSize: 9 }}>
                STATUS
              </th>
              <th className="text-center px-4 py-2.5 hud-label text-slate-500" style={{ fontSize: 9 }}>
                PROJECTS
              </th>
              <th className="text-left px-4 py-2.5 hud-label text-slate-500" style={{ fontSize: 9 }}>
                REGISTERED
              </th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const isSelf = u.id === currentUserId
              const isUpdating = updatingId === u.id
              return (
                <tr
                  key={u.id}
                  className={`border-b border-slate-700/30 last:border-0 transition-colors ${
                    isSelf ? 'bg-cyan-neon/5' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isUpdating && <Loader2 size={11} className="animate-spin text-cyan-neon flex-shrink-0" />}
                      <div>
                        <p className="text-slate-200 font-mono text-xs">
                          {u.firstName} {u.lastName}
                          {isSelf && (
                            <span className="ml-2 text-[9px] text-cyan-neon border border-cyan-neon/30 px-1 py-0.5 rounded">
                              YOU
                            </span>
                          )}
                        </p>
                        <p className="text-slate-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded border text-xs font-mono ${ROLE_COLORS[u.role] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/30'}`}
                      >
                        {u.role}
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={isSelf || isUpdating}
                        onChange={(e) => onUpdateRole(u.id, e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-neon/50 disabled:opacity-50"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <button
                      disabled={isSelf || isUpdating}
                      onClick={() => onToggleActive(u.id, !u.isActive)}
                      title={u.isActive ? 'Deactivate user' : 'Activate user'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        u.isActive
                          ? 'text-green-400 border-green-400/30 bg-green-400/10 hover:bg-green-400/20'
                          : 'text-slate-500 border-slate-600 bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      {u.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm text-slate-300">{u._count.ownedProjects}</span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: System Defaults ────────────────────────────────────────────────────

function DefaultsTab() {
  return (
    <div className="space-y-4">
      <div className="rmf-card p-4 flex items-start gap-3 border-yellow-400/20 bg-yellow-400/5">
        <AlertTriangle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          System defaults are not yet persisted to the database. These settings are planned for a future release.
          Current runtime values are shown in <strong className="text-slate-300">AI Configuration</strong> and{' '}
          <strong className="text-slate-300">General Config</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rmf-card p-5">
          <SectionHeader title="CATEGORIZATION DEFAULTS" subtitle="Pre-selected values for new projects" />
          <div className="space-y-3">
            <div>
              <label className="hud-label text-slate-500 block mb-1" style={{ fontSize: 10 }}>
                DEFAULT IMPACT LEVEL
              </label>
              <select
                disabled
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-400 font-mono opacity-60 cursor-not-allowed"
              >
                <option>MODERATE</option>
              </select>
            </div>
            <div>
              <label className="hud-label text-slate-500 block mb-1" style={{ fontSize: 10 }}>
                JSIG OVERLAY DEFAULT
              </label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-4 rounded-full bg-slate-700 relative opacity-60 cursor-not-allowed">
                  <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-slate-500" />
                </div>
                <span className="text-xs text-slate-500">Disabled by default</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rmf-card p-5">
          <SectionHeader title="FRAMEWORK SETTINGS" subtitle="RMF compliance framework options" />
          <div className="space-y-3">
            <div>
              <label className="hud-label text-slate-500 block mb-1" style={{ fontSize: 10 }}>
                CONTROL CATALOG
              </label>
              <select
                disabled
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-400 font-mono opacity-60 cursor-not-allowed"
              >
                <option>NIST SP 800-53 Rev. 5</option>
              </select>
            </div>
            <div>
              <label className="hud-label text-slate-500 block mb-1" style={{ fontSize: 10 }}>
                ASSESSMENT FRAMEWORK
              </label>
              <select
                disabled
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-400 font-mono opacity-60 cursor-not-allowed"
              >
                <option>NIST SP 800-37 Rev. 2</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: AI Configuration ───────────────────────────────────────────────────

function AiTab({ config, loading }: { config?: PlatformStats['config']; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm">Loading AI configuration…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rmf-card p-4 flex items-start gap-3 border-cyan-neon/20 bg-cyan-neon/5">
        <Server size={14} className="text-cyan-neon mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          AI model settings are configured via environment variables and require a service restart to change.
          Edit <code className="text-slate-300 bg-slate-800 px-1 rounded">.env</code> to update these values.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rmf-card p-5">
          <SectionHeader title="MODEL SETTINGS" subtitle="Active inference configuration" />
          <div className="space-y-0">
            <ConfigRow label="PROVIDER" value={config?.aiProvider ?? '—'} />
            <ConfigRow label="PRIMARY MODEL" value={config?.aiModel ?? '—'} />
            <ConfigRow label="FAST MODEL" value={config?.aiFastModel ?? '—'} />
            <ConfigRow label="OLLAMA URL" value={config?.ollamaUrl ?? '—'} />
          </div>
        </div>

        <div className="rmf-card p-5">
          <SectionHeader title="INFERENCE PARAMETERS" subtitle="Token limits and sampling settings" />
          <div className="space-y-0">
            <ConfigRow label="MAX TOKENS" value={config?.aiMaxTokens ?? '—'} />
            <ConfigRow label="CONTEXT WINDOW" value={config?.aiContextWindow ?? '—'} />
            <ConfigRow label="MAX RAG CHUNKS" value={config?.aiMaxRagChunks ?? '—'} />
            <ConfigRow
              label="TEMPERATURE"
              value={config?.aiTemperature !== undefined ? config.aiTemperature.toFixed(2) : '—'}
            />
          </div>
        </div>
      </div>

      <div className="rmf-card p-5">
        <SectionHeader title="ENVIRONMENT VARIABLE REFERENCE" />
        <div className="grid grid-cols-2 gap-x-8">
          {[
            ['LOCAL_AI_PROVIDER', 'Provider: ollama or llamacpp'],
            ['LOCAL_AI_MODEL', 'Primary generation model'],
            ['LOCAL_AI_FAST_MODEL', 'Fast model for streaming (falls back to LOCAL_AI_MODEL)'],
            ['LOCAL_AI_MAX_TOKENS', 'Max output tokens per request'],
            ['LOCAL_AI_CONTEXT_WINDOW', 'Context window size'],
            ['LOCAL_AI_MAX_RAG_CHUNKS', 'Max retrieval chunks injected into prompt'],
            ['OLLAMA_BASE_URL', 'Ollama API base URL'],
          ].map(([key, desc]) => (
            <div key={key} className="flex flex-col py-2 border-b border-slate-700/30 last:border-0">
              <code className="text-cyan-neon/80 text-xs font-mono">{key}</code>
              <span className="text-slate-500 text-xs mt-0.5">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Integrations ───────────────────────────────────────────────────────

const PLANNED_INTEGRATIONS = [
  { name: 'SIEM / Splunk', desc: 'Forward audit events and findings to a SIEM platform.' },
  { name: 'Jira / Linear', desc: 'Auto-create tickets from open POA&M items.' },
  { name: 'XACTA / eMASS', desc: 'Bi-directional RMF package sync with eMASS.' },
  { name: 'Active Directory / LDAP', desc: 'User provisioning and group-based role sync.' },
  { name: 'S3 / Cloud Storage', desc: 'Store artifacts and SSP packages in cloud object storage.' },
  { name: 'Webhook Notifications', desc: 'Push status change events to external systems.' },
]

function IntegrationsTab() {
  return (
    <div className="space-y-4">
      <div className="rmf-card p-4 flex items-start gap-3 border-slate-600/30">
        <Plug size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          External integrations are planned for a future release. The items below represent the integrations roadmap.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {PLANNED_INTEGRATIONS.map(({ name, desc }) => (
          <div
            key={name}
            className="rmf-card p-4 flex items-start gap-3 opacity-60"
          >
            <div className="p-1.5 rounded bg-slate-700/50 flex-shrink-0">
              <Plug size={12} className="text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-slate-300">{name}</span>
                <span className="hud-label text-slate-500 border border-slate-600 px-1.5 py-0.5 rounded" style={{ fontSize: 8 }}>
                  PLANNED
                </span>
              </div>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab: About ──────────────────────────────────────────────────────────────

function AboutTab({ version, loading }: { version?: PlatformStats['version']; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm">Loading version info…</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="rmf-card p-5">
        <SectionHeader title="APPLICATION" subtitle="Platform version and build info" />
        <div className="space-y-0">
          <ConfigRow label="CRATER VERSION" value={version?.app ?? '—'} />
          <ConfigRow label="ENVIRONMENT" value="Production" />
        </div>
      </div>

      <div className="rmf-card p-5">
        <SectionHeader title="COMPLIANCE FRAMEWORKS" subtitle="Standards and publications in use" />
        <div className="space-y-0">
          <ConfigRow label="RMF FRAMEWORK" value={version?.rmfFramework ?? '—'} />
          <ConfigRow label="CONTROL CATALOG" value={version?.nistControls ?? '—'} />
          <ConfigRow label="JSIG" value={version?.jsig ?? '—'} />
          <ConfigRow label="FIPS" value={version?.fips ?? '—'} />
          <ConfigRow label="CNSSI" value={version?.cnssi ?? '—'} />
        </div>
      </div>

      <div className="rmf-card p-5 col-span-2">
        <SectionHeader title="CRATER" />
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-lg bg-cyan-neon/10 border border-cyan-neon/20 flex items-center justify-center flex-shrink-0">
            <Shield size={28} className="text-cyan-neon" />
          </div>
          <div>
            <p className="font-mono text-slate-100 text-sm mb-1">Crater — RMF Compliance Platform</p>
            <p className="text-xs text-slate-500 leading-5 max-w-xl">
              Crater is an AI-augmented Risk Management Framework tool for building, managing, and maintaining
              authorization packages for classified and unclassified systems. Built to align with NIST SP 800-37 Rev. 2,
              NIST SP 800-53 Rev. 5, JSIG Rev. 2, FIPS 199/200, and CNSSI 1253.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Access denied fallback ───────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Lock size={32} className="text-slate-600" />
      <div className="text-center">
        <p className="hud-label text-slate-500 mb-1">ACCESS DENIED</p>
        <p className="text-sm text-slate-600">Administrator role required to view this page.</p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('general')
  const { user: currentUser } = useAuth()
  const qc = useQueryClient()

  const isAdmin = currentUser?.role === 'ADMIN'

  const statsQuery = useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: adminApi.getStats,
    enabled: isAdmin,
  })

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users,
    queryFn: adminApi.listUsers,
    enabled: isAdmin && tab === 'users',
  })

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const updateUserMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; role?: string; isActive?: boolean }) =>
      adminApi.updateUser(id, data),
    onMutate: ({ id }) => setUpdatingUserId(id),
    onSettled: () => setUpdatingUserId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.users }),
  })

  if (!isAdmin) return <AccessDenied />

  const stats = statsQuery.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="hud-label text-slate-500">ADMINISTRATION</p>
        <h1 className="font-mono text-xl text-slate-100">ADMIN PORTAL</h1>
      </div>

      {/* Top stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="TOTAL USERS" value={stats.users.total} icon={Users} />
          <StatCard label="ACTIVE USERS" value={stats.users.active} icon={Activity} />
          <StatCard label="PROJECTS" value={stats.projects} icon={FolderOpen} />
          <StatCard
            label="OPEN POA&Ms"
            value={stats.openPoams}
            icon={AlertTriangle}
            accent={stats.openPoams > 0 ? 'bg-orange-400/10' : undefined}
          />
        </div>
      )}

      {/* Tab nav */}
      <div className="flex border-b border-slate-700/50 gap-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 hud-label whitespace-nowrap border-b-2 transition-colors ${
              tab === id
                ? 'border-cyan-neon text-cyan-neon'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
            style={{ fontSize: 10 }}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'general' && <GeneralTab stats={stats} loading={statsQuery.isLoading} />}

      {tab === 'users' && (
        <UsersTab
          users={usersQuery.data}
          loading={usersQuery.isLoading}
          currentUserId={currentUser?.id}
          updatingId={updatingUserId}
          onUpdateRole={(id, role) => updateUserMutation.mutate({ id, role })}
          onToggleActive={(id, isActive) => updateUserMutation.mutate({ id, isActive })}
        />
      )}

      {tab === 'defaults' && <DefaultsTab />}

      {tab === 'ai' && <AiTab config={stats?.config} loading={statsQuery.isLoading} />}

      {tab === 'audit' && <AuditLogPage adminMode />}

      {tab === 'integrations' && <IntegrationsTab />}

      {tab === 'about' && <AboutTab version={stats?.version} loading={statsQuery.isLoading} />}
    </div>
  )
}
