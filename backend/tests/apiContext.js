import { after, before } from 'node:test'
import { Client } from './helpers.js'

process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://placeholder/unused'
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456'
process.env.ADMIN_EMAIL = 'admin@signpak.test'
process.env.ADMIN_PASSWORD = 'Admin@12345'
process.env.BCRYPT_ROUNDS = '4'
process.env.RATE_LIMIT_ENABLED = 'false'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'

const deliveredCodes = new Map()
const contactDeliveries = []

const dependencies = Promise.all([
  import('../src/app.js'),
  import('../src/config/db.js'),
  import('../src/services/authService.js'),
  import('../src/services/contactService.js'),
  import('../src/services/storage/index.js'),
  import('../src/models/ContactDailyQuota.js'),
  import('../src/models/Submission.js'),
  import('../src/models/SubmissionCooldown.js'),
  import('../src/repositories/submissionRepo.js'),
  import('mongoose'),
])

export function useApiContext() {
  let context
  before(async () => {
    const [
      { default: app },
      { connectDb, disconnectDb },
      { authService },
      { contactService },
      { storageService },
      { ContactDailyQuota },
      { Submission },
      { SubmissionCooldown },
      { submissionRepo },
      { default: mongoose },
    ] = await dependencies

    authService.sendOTPEmail = async (email, code, purpose) => {
      deliveredCodes.set(`${email.toLowerCase()}:${purpose}`, code)
    }
    contactService.deliver = async (payload) => {
      if (payload.message === 'Provider failure') throw new Error('provider unavailable')
      contactDeliveries.push(payload)
    }

    let memory
    let uri = process.env.MONGODB_URI_TEST
    if (!uri) {
      const { MongoMemoryServer } = await import('mongodb-memory-server')
      memory = await MongoMemoryServer.create()
      uri = memory.getUri('signpak_test')
    }
    await connectDb(uri)
    await mongoose.connection.dropDatabase()
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()))
    await storageService.init()
    await authService.ensureAdminFromEnv()

    const server = app.listen(0)
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    const base = `http://127.0.0.1:${server.address().port}/api/v1`
    const admin = new Client(base)
    const login = await admin.post('/auth/login', {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
    if (login.status !== 200) throw new Error(`Test admin login failed: ${login.status}`)

    const createVerifiedUser = async ({ firstName, surname, email, password = 'password1' }) => {
      const user = new Client(base)
      const signup = await user.post('/auth/signup', { firstName, surname, email, password })
      if (signup.status !== 201) throw new Error(`Test user signup failed: ${signup.status}`)
      const normalizedEmail = email.toLowerCase()
      const verified = await user.post('/auth/verify-email', {
        email: normalizedEmail,
        code: deliveredCodes.get(`${normalizedEmail}:email-verification`),
      })
      if (verified.status !== 200) throw new Error(`Test user verification failed: ${verified.status}`)
      return user
    }

    const contributor = await createVerifiedUser({
      firstName: 'Sara',
      surname: 'Ahmed',
      email: 'Sara@Example.com',
    })
    const other = await createVerifiedUser({
      firstName: 'Omar',
      surname: 'Khan',
      email: 'omar@example.com',
    })

    context = {
      app,
      base,
      admin,
      contributor,
      other,
      createVerifiedUser,
      deliveredCodes,
      contactDeliveries,
      ContactDailyQuota,
      Submission,
      SubmissionCooldown,
      submissionRepo,
      storageService,
      authService,
      mongoose,
      close: async () => {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve())
        })
        await mongoose.connection.dropDatabase()
        await disconnectDb()
        await memory?.stop()
      },
    }
  })

  after(async () => {
    if (context) await context.close()
  })

  return () => {
    if (!context) throw new Error('API test context is not initialized.')
    return context
  }
}
