import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

mongoose.set('strictQuery', true)

export async function connectDb(uri = env.MONGODB_URI) {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'))
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected')
}

export async function disconnectDb() {
  await mongoose.disconnect()
}

export const isDbReady = () => mongoose.connection.readyState === 1
