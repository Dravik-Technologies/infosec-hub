import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app'

const PORT = process.env.PORT ?? 3002
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/crater'

// Start listening immediately — the SSO endpoint does not need MongoDB.
// Data routes will fail gracefully when the DB is unavailable.
app.listen(PORT, () => {
  console.log(`[CRATER] API server running on port ${PORT}`)

  mongoose.set('bufferCommands', false)
  mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
    .then(() => console.log('[CRATER] MongoDB connected:', MONGODB_URI))
    .catch((err) => console.warn('[CRATER] MongoDB unavailable — SSO still works, data routes will fail:', err.message))
})
