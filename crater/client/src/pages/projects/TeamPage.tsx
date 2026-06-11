import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Save, Trash2, UserCheck, Users, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi, usersApi, type ProjectMember, type PlatformUser } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/hooks/useAuth'
import type { Project } from '@/types/project'

const ALL_ROLES = [
  'ADMIN',
  'SYSTEM_OWNER',
  'ISSM',
  'ISSO',
  'ISSE',
  'SCA',
  'AO',
  'DAO',
] as const

type ProjectRole = (typeof ALL_ROLES)[number]

const ROLE_CLASS: Record<string, string> = {
  ADMIN: 'text-red-400 border-red-400/30 bg-red-400/10',
  SYSTEM_OWNER: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  ISSM: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  ISSO: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  ISSE: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  SCA: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  AO: 'text-green-400 border-green-400/30 bg-green-400/10',
  DAO: 'text-teal-400 border-teal-400/30 bg-teal-400/10',
  VIEWER: 'text-slate-400 border-slate-400/30 bg-slate-400/10',
}

interface ProjectDetail extends Project {
  ownerId?: string
}

export default function TeamPage({ project }: { project: ProjectDetail }) {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<ProjectRole>('ISSO')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<ProjectRole>('ISSO')
  const [userSearch, setUserSearch] = useState('')

  const isOwnerOrAdmin = currentUser?.role === 'ADMIN' || project.ownerId === currentUser?.id

  const { data: members = [], isLoading: membersLoading } = useQuery<ProjectMember[]>({
    queryKey: [...queryKeys.projects.detail(project.id), 'members'],
    queryFn: () => projectsApi.listMembers(project.id),
  })

  const { data: allUsers = [] } = useQuery<PlatformUser[]>({
    queryKey: ['users'],
    queryFn: usersApi.listAll,
    enabled: isOwnerOrAdmin,
    staleTime: 60_000,
  })

  const memberUserIds = new Set(members.map((m) => m.userId))
  const availableUsers = allUsers.filter(
    (u) => !memberUserIds.has(u.id) && (
      !userSearch.trim() ||
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
    ),
  )

  const addMutation = useMutation({
    mutationFn: () => projectsApi.addMember(project.id, { userId: addUserId, role: addRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(project.id), 'members'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      setAddUserId('')
      setUserSearch('')
      toast.success('Team member added')
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? 'Unable to add team member')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      projectsApi.updateMember(project.id, userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(project.id), 'members'] })
      setEditingUserId(null)
      toast.success('Role updated')
    },
    onError: () => toast.error('Unable to update role'),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(project.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(project.id), 'members'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      toast.success('Member removed')
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? 'Unable to remove member')
    },
  })

  function startEdit(member: ProjectMember) {
    setEditingUserId(member.userId)
    setEditRole(member.role as ProjectRole)
  }

  function submitAdd() {
    if (!addUserId) {
      toast.error('Select a user to add')
      return
    }
    addMutation.mutate()
  }

  return (
    <div className="space-y-5">
      <section className="rmf-card active p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hud-label text-slate-600">PROJECT TEAM</p>
            <h2 className="mt-1 font-mono text-xl text-slate-100">Team Management</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage who has access to this system and their assigned RMF role. Only the project owner and administrators can add or remove members.
            </p>
          </div>
          <div className="rounded border border-cyan-neon/10 bg-space-elevated/60 px-4 py-2 text-center">
            <p className="hud-label text-slate-600">MEMBERS</p>
            <p className="mt-1 font-mono text-xl font-bold text-cyan-neon">{members.length}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {isOwnerOrAdmin && (
          <div className="rmf-card p-5">
            <div className="flex items-center gap-2">
              <Plus size={17} className="text-cyan-neon" />
              <span className="hud-label">ADD TEAM MEMBER</span>
            </div>

            <div className="mt-4 space-y-3">
              <input
                className="input-hud w-full"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setAddUserId('') }}
              />

              <div className="max-h-48 overflow-y-auto rounded border border-cyan-neon/10 divide-y divide-cyan-neon/5">
                {availableUsers.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500 text-center">
                    {userSearch ? 'No matching users' : 'All platform users are already members'}
                  </p>
                ) : (
                  availableUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setAddUserId(u.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-cyan-neon/5 ${
                        addUserId === u.id ? 'bg-cyan-neon/10' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-slate-200 truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                      <span className={`flex-shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${ROLE_CLASS[u.role] ?? ROLE_CLASS.VIEWER}`}>
                        {u.role}
                      </span>
                    </button>
                  ))
                )}
              </div>

              <select
                className="select-hud w-full"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as ProjectRole)}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={submitAdd}
                disabled={!addUserId || addMutation.isPending}
                className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-50"
              >
                {addMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
                ADD TO TEAM
              </button>
            </div>
          </div>
        )}

        <div className="rmf-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={17} className="text-cyan-neon" />
            <span className="hud-label">CURRENT MEMBERS</span>
          </div>

          {membersLoading ? (
            <p className="p-6 text-center font-mono text-sm text-cyan-neon">LOADING TEAM...</p>
          ) : members.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No team members found.</p>
          ) : (
            <div className="divide-y divide-cyan-neon/10">
              {members.map((member) => {
                const isOwner = member.userId === project.ownerId
                const isEditing = editingUserId === member.userId

                return (
                  <div key={member.userId} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-sm text-slate-100">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        {isOwner && (
                          <span className="rounded border border-cyan-neon/30 bg-cyan-neon/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-neon">
                            OWNER
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{member.user.email}</p>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <select
                          className="select-hud text-xs"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as ProjectRole)}
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => updateMutation.mutate({ userId: member.userId, role: editRole })}
                          disabled={updateMutation.isPending}
                          className="btn-primary px-2 py-1.5"
                          title="Save"
                        >
                          {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="btn-secondary px-2 py-1.5"
                          title="Cancel"
                        >
                          <XCircle size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${ROLE_CLASS[member.role] ?? 'text-slate-400 border-slate-400/30 bg-slate-400/10'}`}>
                          {member.role}
                        </span>
                        {isOwnerOrAdmin && (
                          <>
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => startEdit(member)}
                                className="btn-secondary px-2 py-1.5"
                                title="Edit role"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => removeMutation.mutate(member.userId)}
                                disabled={removeMutation.isPending && removeMutation.variables === member.userId}
                                className="btn-secondary px-2 py-1.5 text-red-alert disabled:opacity-50"
                                title="Remove member"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
