import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'

const router = Router()

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body
    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email, and password are required' })
      return
    }
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] })
    if (existing) {
      res.status(409).json({ error: 'Email or username already in use' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ username, email, passwordHash })
    const token = jwt.sign(
      { userId: (user._id as any).toString() },
      process.env.JWT_SECRET ?? 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any }
    )
    res.status(201).json({ token, user })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' })
      return
    }
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }
    const token = jwt.sign(
      { userId: (user._id as any).toString() },
      process.env.JWT_SECRET ?? 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any }
    )
    res.json({ token, user })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Login failed' })
  }
})

export default router
