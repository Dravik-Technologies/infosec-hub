import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app'

const PORT = process.env.PORT ?? 3001
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/crater'

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  })
