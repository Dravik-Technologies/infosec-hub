import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import authRoutes from './routes/auth'
import projectRoutes from './routes/projects'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3000

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(morgan('dev'))
app.use(
  '/api',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false })
)

app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', system: 'CRATER', timestamp: new Date().toISOString() })
)

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)

app.use(errorHandler)

app.listen(PORT, () => console.log(`[CRATER] Backend online — port ${PORT}`))
