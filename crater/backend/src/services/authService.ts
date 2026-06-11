import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { AppError } from '../lib/errors'
import type { RegisterDto, LoginDto } from '../lib/schemas'

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const

export class AuthService {
  private signToken(userId: string): string {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new AppError('JWT_SECRET not configured', 500)
    return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' })
  }

  async register(dto: RegisterDto) {
    const exists = await prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })
    if (exists) throw new AppError('Email already registered', 409)

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      select: USER_SELECT,
    })

    return { user, token: this.signToken(user.id) }
  }

  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    })

    if (!user || !user.isActive) throw new AppError('Invalid credentials', 401)

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new AppError('Invalid credentials', 401)

    const { passwordHash: _, ...safeUser } = user
    return { user: safeUser, token: this.signToken(user.id) }
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    })
    if (!user) throw new AppError('User not found', 404)
    return user
  }
}
