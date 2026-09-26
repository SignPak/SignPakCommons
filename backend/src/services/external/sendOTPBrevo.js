import { BrevoClient } from '@getbrevo/brevo';
import { env } from '../../config/env.js'

export async function sendOTPEmailBrevo(userEmail, otp, purpose) {
  if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is not configured.')
  if (!env.BREVO_SENDER_EMAIL) throw new Error('BREVO_SENDER_EMAIL is not configured.')
  const brevo = new BrevoClient({ apiKey: env.BREVO_API_KEY })
  const isReset = purpose === 'password-reset'
  const subject = isReset ? 'Reset your SignPak Commons password' : 'Verify your SignPak Commons email'
  const action = isReset ? 'reset your password' : 'verify your email address'
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: userEmail }],
      subject,
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 440px; margin: auto; padding: 24px;">
          <h2>${isReset ? 'Password reset code' : 'Verify your email'}</h2>
          <p>Enter this code to ${action}. It expires in ${env.AUTH_OTP_TTL_MINUTES} minutes.</p>
          <p style="font-size: 30px; font-weight: bold; letter-spacing: 6px;">${otp}</p>
          <p>If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    throw new Error('Could not send OTP email.', { cause: error })
  }
}
