export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  projects: {
    all: ['projects'] as const,
    detail: (id: string | undefined) => ['projects', id] as const,
  },
  admin: {
    users: ['admin', 'users'] as const,
    stats: ['admin', 'stats'] as const,
  },
  users: {
    all: ['users'] as const,
  },
}
