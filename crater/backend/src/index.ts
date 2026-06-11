import 'dotenv/config'
import path from 'path'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { rateLimit } from 'express-rate-limit'
import router from './routes'
import { errorHandler } from './middleware/errorHandler'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads'

const app = express()
const PORT = Number(process.env.PORT ?? 3000)
const allowedOrigins = new Set([
  process.env.CLIENT_URL ?? 'http://localhost:5174',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
])

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`CORS origin not allowed: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}))

// ─── Parsing ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
}

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'crater-backend',
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  })
})

// ─── Static uploads ──────────────────────────────────────────────────────────
// Serves uploaded files at /uploads/*. The path stored in Diagram.fileUrl
// matches this mount point, e.g. /uploads/projects/{id}/diagrams/{file}.
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)))

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', router)

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler)

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[crater] Server running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`)
})

export default app
