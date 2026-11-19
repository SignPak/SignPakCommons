import { env } from '../../config/env.js'
import { brevoEmailDriver } from './brevoDriver.js'
import { captureEmailDriver } from './captureDriver.js'

// One seam for outgoing authentication mail: production uses Brevo, tests capture in memory.
const drivers = {
  brevo: brevoEmailDriver,
  capture: captureEmailDriver,
}

const driver = drivers[env.EMAIL_DRIVER]
if (!driver) throw new Error(`Unknown email driver "${env.EMAIL_DRIVER}"`)

export const emailService = {
  driverName: driver.name,
  sendOtp: (email, code, purpose) => driver.sendOtp(email, code, purpose),
}

export { clearCapturedEmails, latestCapturedEmail, listCapturedEmails } from './captureDriver.js'
