import { sendOTPEmailBrevo } from '../external/sendOTPBrevo.js'

/** The real transactional sender; the provider call itself stays in external/sendOTPBrevo.js. */
export const brevoEmailDriver = {
  name: 'brevo',
  sendOtp: (email, code, purpose) => sendOTPEmailBrevo(email, code, purpose),
}
