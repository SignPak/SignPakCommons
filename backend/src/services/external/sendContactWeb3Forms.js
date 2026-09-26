import { env } from '../../config/env.js'
import { AppError } from '../../utils/AppError.js'

export async function sendContactWeb3Forms({ name, email, message }) {
  if (!env.WEB3FORMS_ACCESS_KEY) throw new Error('WEB3FORMS_ACCESS_KEY is not configured.')

  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: env.WEB3FORMS_ACCESS_KEY,
      name,
      email,
      message,
      subject: `SignPak Commons contact from ${name}`,
      from_name: 'SignPak Commons Contact Form',
      replyto: email,
    }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new AppError(502, 'CONTACT_DELIVERY_FAILED', 'We could not deliver your message right now. Please try again later.')
  }
}
