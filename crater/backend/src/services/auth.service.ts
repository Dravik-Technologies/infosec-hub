import bcrypt from 'bcryptjs'
import { prisma } from '../prisma/client'
import { signToken } from '../utils/jwt'
import { AppError } from '../utils/errors'
import type { RegisterDto, LoginDto } from '../utils/schemas'

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const

export class AuthService {
  async register(dto: RegisterDto) {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    })
    if (existing) throw new AppError('An account with this email already exists', 409)

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const userCount = await prisma.user.count()

    const user = await prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        ...(userCount === 0 ? { role: 'ADMIN' } : {}),
      },
      select: SAFE_USER_SELECT,
    })

    return { user, token: signToken(user.id, user.role) }
  }

  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    })

    // Constant-time comparison even on missing user
    const hash = user?.passwordHash ?? '$2b$12$invalidhashpadding000000000000000000000000000000000000000'
    const valid = await bcrypt.compare(dto.password, hash)

    if (!user || !user.isActive || !valid) {
      throw new AppError('Invalid email or password', 401)
    }

    const { passwordHash: _, ...safeUser } = user
    return { user: safeUser, token: signToken(user.id, user.role) }
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    })
    if (!user) throw new AppError('User not found', 404)
    return user
  }
}
