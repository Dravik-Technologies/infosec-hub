import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import systemRoutes from './routes/systems'
import sctmRoutes from './routes/sctm'
import poamRoutes from './routes/poam'
import vulnRoutes from './routes/vulnerabilities'
import diagramRoutes from './routes/diagrams'

const app = express()

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/systems', systemRoutes)
app.use('/api/systems', sctmRoutes)
app.use('/api/systems', poamRoutes)
app.use('/api/systems', vulnRoutes)
app.use('/api/systems', diagramRoutes)

export default app
