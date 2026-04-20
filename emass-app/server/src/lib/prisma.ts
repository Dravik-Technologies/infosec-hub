// The Prisma schema lives in packages/db — the generated client is there too.
// We reference it via a relative path so the server doesn't need workspace support.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PrismaClient } from '../../../../packages/db/node_modules/@prisma/client'

const globalForPrisma = global as unknown as { prisma: InstanceType<typeof PrismaClient> }

export const prisma: InstanceType<typeof PrismaClient> =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
