import { z } from 'zod'

export const objectId = (label = 'id') => z.string().regex(/^[a-f\d]{24}$/i, `That ${label} is not valid.`)
export const idParams = z.object({ id: objectId() })

export const emailField = z.string({ error: 'Enter your email address.' }).trim().toLowerCase().pipe(z.email('Enter a valid email address, like you@example.com.'))

// Multipart forms send everything as strings, so booleans arrive as "true"/"false".
export const booleanField = z.preprocess((value) => (value === 'true' ? true : value === 'false' ? false : value), z.boolean())
