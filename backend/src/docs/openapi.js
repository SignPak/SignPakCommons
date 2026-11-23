import { AUDIT_ACTIONS } from '../config/constants.js'

const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
// B5/B7: the paged answer of the list routes.
const pageOf = (items) => ({ type: 'object', properties: { items: { type: 'array', items }, nextCursor: { type: 'string', nullable: true }, total: { type: 'integer' } } })
// B5: the filters shared by the admin submissions list and the export.
const submissionFilterParameters = ['categoryId', 'videoId', 'userId'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))
  .concat(['from', 'to'].map((name) => ({ name, in: 'query', schema: { type: 'string', format: 'date' } })))
const envelope = (schema = {}) => ({
  type: 'object',
  required: ['data'],
  properties: { data: schema },
})
const jsonResponse = (description, schema) => ({
  description,
  content: { 'application/json': { schema: envelope(schema) } },
})
const errorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              fields: { type: 'object', additionalProperties: { type: 'string' } },
            },
          },
        },
      },
    },
  },
}
const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[a-f\\d]{24}$' },
}
const healthSchema = (statuses) => ({
  type: 'object',
  required: ['status', 'database', 'storage', 'uptime'],
  properties: {
    status: { type: 'string', enum: statuses },
    database: { type: 'string', enum: ['connected', 'disconnected'] },
    storage: { type: 'boolean' },
    uptime: { type: 'integer', description: 'Seconds since the process started.' },
  },
})
const userSecurity = [{ cookieAuth: [] }]
const adminSecurity = userSecurity
const authErrors = { 400: errorResponse, 422: errorResponse, 429: errorResponse }
const adminErrors = { 401: errorResponse, 403: errorResponse, 422: errorResponse }
const videoContent = {
  'video/mp4': {},
  'video/webm': {},
  'video/quicktime': {},
}

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'SignPak Commons API',
    version: '1.0.0',
    description: 'API for the SignPak Commons Pakistan Sign Language dataset contribution platform. Every response carries an X-Request-Id header; a caller may send its own, which is kept only if it is 1-64 letters, digits or hyphens (otherwise a new UUID is used).',
  },
  servers: [{ url: '/api/v1', description: 'Current API server' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Categories' },
    { name: 'Videos' },
    { name: 'Demo Video' },
    { name: 'Submissions' },
    { name: 'Contact' },
    { name: 'Admin' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'signpak_token',
        description: 'HTTP-only JWT cookie set by login or email verification.',
      },
    },
    schemas: {
      Category: {
        type: 'object',
        required: ['id', 'label', 'copy', 'tone'],
        properties: {
          id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
          label: { type: 'string' },
          copy: { type: 'string' },
          tone: { type: 'string', enum: ['yellow', 'blue', 'red', 'green'] },
        },
      },
      CategoryCreateInput: {
        type: 'object',
        required: ['label'],
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 60 },
          copy: { type: 'string', maxLength: 240, default: '' },
          tone: { type: 'string', enum: ['yellow', 'blue', 'red', 'green'], default: 'yellow' },
        },
      },
      CategoryUpdateInput: {
        type: 'object',
        minProperties: 1,
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 60 },
          copy: { type: 'string', maxLength: 240 },
          tone: { type: 'string', enum: ['yellow', 'blue', 'red', 'green'] },
        },
      },
      Video: {
        type: 'object',
        required: ['id', 'title', 'status', 'categoryId', 'order', 'durationSec', 'videoUrl', 'poster', 'size'],
        properties: {
          id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'published'] },
          categoryId: { type: 'string', nullable: true },
          order: { type: 'integer' },
          durationSec: { type: 'number' },
          width: { type: 'integer', description: 'Displayed width in pixels; 0 when unknown.' },
          height: { type: 'integer', description: 'Displayed height in pixels; 0 when unknown.' },
          videoUrl: { type: 'string' },
          videoSource: { type: 'string', enum: ['stored', 'external'] },
          poster: { type: 'string', nullable: true },
          size: { type: 'integer' },
        },
      },
      VideoUpdateInput: {
        type: 'object',
        minProperties: 1,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 120 },
          status: { type: 'string', enum: ['draft', 'published'] },
          categoryId: { type: 'string', nullable: true, pattern: '^[a-f\\d]{24}$' },
          order: { type: 'integer', minimum: 0 },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
          firstName: { type: 'string' },
          surname: { type: 'string' },
          email: { type: 'string', format: 'email' },
          emailVerified: { type: 'boolean' },
          role: { type: 'string', enum: ['user', 'admin'] },
          status: { type: 'string', enum: ['active', 'suspended'] },
          statusReason: { type: 'string' },
          consent: {
            type: 'object',
            description: 'When the contributor accepted the consent notice (null until they do).',
            properties: { acceptedAt: { type: 'string', format: 'date-time', nullable: true }, version: { type: 'string', nullable: true } },
          },
          connections: {
            type: 'object',
            properties: {
              github: { type: 'string', nullable: true },
              linkedin: { type: 'string', nullable: true },
            },
          },
        },
      },
      SignupInput: {
        type: 'object',
        required: ['firstName', 'surname', 'email', 'password'],
        properties: {
          firstName: { type: 'string', minLength: 1, maxLength: 60 },
          surname: { type: 'string', minLength: 1, maxLength: 60 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 8, maxLength: 72 },
          confirmPassword: { type: 'string', description: 'Optional; if supplied, must match password.' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 1, maxLength: 200 },
        },
      },
      EmailInput: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
      VerifyEmailInput: {
        type: 'object',
        required: ['email', 'code', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', pattern: '^\\d{6}$' },
          password: { type: 'string', minLength: 1, maxLength: 200, description: 'The password chosen at sign-up (B3): only the person who set it can finish.' },
        },
      },
      ResetPasswordInput: {
        type: 'object',
        required: ['email', 'code', 'password', 'confirmPassword'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', pattern: '^\\d{6}$' },
          password: { type: 'string', format: 'password', minLength: 8, maxLength: 72 },
          confirmPassword: { type: 'string', format: 'password', minLength: 1 },
        },
      },
      UpdateProfileInput: {
        type: 'object',
        required: ['connections'],
        properties: {
          connections: {
            type: 'object',
            properties: {
              github: { type: 'string', nullable: true, description: 'GitHub username or profile URL; null disconnects.' },
              linkedin: { type: 'string', nullable: true, description: 'LinkedIn profile slug or URL; null disconnects.' },
            },
          },
        },
      },
      VideoUploadInput: {
        type: 'object',
        required: ['title'],
        description: 'Provide exactly one of video or videoUrl. External video URLs must point to a direct HTTPS video file and require a poster image.',
        properties: {
          video: { type: 'string', format: 'binary', description: 'MP4, WebM, or MOV video.' },
          videoUrl: { type: 'string', format: 'uri', description: 'Direct HTTPS MP4/WebM URL; watch-page URLs are not supported.' },
          poster: { type: 'string', format: 'binary', description: 'JPEG, PNG, or WebP image (up to 2 MiB); required when videoUrl is used.' },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          categoryId: { type: 'string', nullable: true, pattern: '^[a-f\\d]{24}$' },
          status: { type: 'string', enum: ['draft', 'published'], default: 'published' },
          durationSec: { type: 'number', minimum: 0, maximum: 86400, default: 0 },
          width: { type: 'integer', minimum: 0, maximum: 16384, default: 0 },
          height: { type: 'integer', minimum: 0, maximum: 16384, default: 0 },
        },
      },
      DemoVideo: {
        type: 'object',
        required: ['id', 'title', 'durationSec', 'videoUrl', 'size'],
        properties: {
          id: { type: 'string', enum: ['current'] },
          title: { type: 'string', maxLength: 120 },
          durationSec: { type: 'number' },
          width: { type: 'integer' },
          height: { type: 'integer' },
          videoUrl: { type: 'string' },
          size: { type: 'integer' },
        },
      },
      DemoVideoUploadInput: {
        type: 'object',
        required: ['video', 'title'],
        properties: {
          video: { type: 'string', format: 'binary', description: 'MP4, WebM, or MOV video.' },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          durationSec: { type: 'number', minimum: 0, maximum: 86400, default: 0 },
          width: { type: 'integer', minimum: 0, maximum: 16384, default: 0 },
          height: { type: 'integer', minimum: 0, maximum: 16384, default: 0 },
        },
      },
      Submission: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
          userId: { type: 'string', pattern: '^[a-f\\d]{24}$' },
          videoId: { type: 'string', pattern: '^[a-f\\d]{24}$' },
          trimStart: { type: 'number' },
          trimEnd: { type: 'number' },
          mirrored: { type: 'boolean' },
          duration: { type: 'number' },
          submittedAt: { type: 'string', format: 'date-time' },
          cooldownStartedAt: { type: 'string', format: 'date-time', description: 'When the server accepted the upload for processing and claimed the per-video cooldown.' },
          size: { type: 'integer' },
          mimeType: { type: 'string', enum: ['video/mp4', 'video/webm', 'video/quicktime'] },
          archivePath: { type: 'string', nullable: true, description: 'Included for admins only.' },
        },
      },
      SubmissionInput: {
        type: 'object',
        required: ['recording', 'videoId', 'trimStart', 'trimEnd', 'duration'],
        properties: {
          recording: { type: 'string', format: 'binary', description: 'MP4, WebM, or MOV recording.' },
          videoId: { type: 'string', pattern: '^[a-f\\d]{24}$' },
          trimStart: { type: 'number', minimum: 0 },
          trimEnd: { type: 'number', minimum: 0, description: 'Must be greater than trimStart and no more than 0.5 seconds beyond duration.' },
          mirrored: { type: 'boolean', default: false },
          duration: { type: 'number', minimum: 0, maximum: 600, exclusiveMinimum: true },
        },
      },
      ContactInput: {
        type: 'object',
        required: ['name', 'email', 'message'],
        properties: {
          topic: { type: 'string', enum: ['general', 'partnership', 'recording-deletion'], default: 'general', description: 'Signed-out visitors may use only recording-deletion.' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          message: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
      ContactReceipt: {
        type: 'object',
        required: ['received', 'id', 'verificationRequired'],
        properties: {
          received: { type: 'boolean', enum: [true] },
          id: { type: 'string', pattern: '^[a-f\\d]{24}$', description: 'Use with /contact/{id}/verify and /contact/{id}/resend.' },
          verificationRequired: { type: 'boolean', description: 'True only for a signed-out recording-deletion request. A code is emailed if an account uses that email; the answer is the same either way.' },
        },
      },
      ContactMessage: {
        type: 'object',
        description: 'A saved contact message. The verification code fields are never returned.',
        properties: {
          id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
          userId: { type: 'string', nullable: true, pattern: '^[a-f\\d]{24}$' },
          topic: { type: 'string', enum: ['general', 'partnership', 'recording-deletion'] },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          message: { type: 'string' },
          verified: { type: 'boolean', description: 'Deletion requests: true when sent signed in or confirmed with the emailed code.' },
          status: { type: 'string', enum: ['open', 'done', 'rejected'] },
          handledAt: { type: 'string', format: 'date-time', nullable: true },
          handledBy: { type: 'string', nullable: true, pattern: '^[a-f\\d]{24}$' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ContactCodeInput: {
        type: 'object',
        required: ['code'],
        properties: { code: { type: 'string', pattern: '^\\d{6}$' } },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              fields: { type: 'object', additionalProperties: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API, database and storage health',
        description: 'Public. Booleans and counters only. Answers even when service initialization failed, so a deployment can see why the API is degraded. `storage` means the configured drivers initialized; for Google Drive that includes reading the root folder, so the OAuth token worked at startup. A token revoked later shows up on the next upload (logged as invalid_grant).',
        responses: {
          200: jsonResponse('Healthy: database connected and storage initialized', healthSchema(['ok'])),
          503: jsonResponse('Degraded: the database is disconnected or storage failed to initialize', healthSchema(['degraded'])),
        },
      },
    },
    '/public/stats': {
      get: {
        tags: ['Public'],
        summary: 'Get cached landing-page aggregate counts',
        responses: {
          200: jsonResponse('Public stats', {
            type: 'object',
            required: ['contributors', 'publishedVideos', 'categories'],
            properties: {
              contributors: { type: 'integer', minimum: 0 },
              publishedVideos: { type: 'integer', minimum: 0 },
              categories: { type: 'integer', minimum: 0 },
            },
          }),
        },
      },
    },
    '/docs.json': {
      get: { tags: ['Health'], summary: 'Get the OpenAPI document', responses: { 200: { description: 'OpenAPI JSON document' } } },
    },
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Create an unverified account and send a code',
        description: 'For an email whose sign-up was never finished, the same 201: names and password are updated, the 24-hour expiry restarts and the code is resent (at most once per AUTH_OTP_RESEND_SECONDS). A finished account gets 409, including one finished by a consent that lands while this request is running.',
        requestBody: { required: true, content: { 'application/json': { schema: ref('SignupInput') } } },
        responses: { 201: jsonResponse('Account pending email verification', ref('User')), ...authErrors },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and set the HTTP-only cookie',
        description: 'AUTH_LOCKOUT_ATTEMPTS wrong passwords lock the account for AUTH_LOCKOUT_MINUTES: 429 with code ACCOUNT_LOCKED, even for the right password, until the lock passes or the password is reset.',
        requestBody: { required: true, content: { 'application/json': { schema: ref('LoginInput') } } },
        responses: { 200: jsonResponse('Logged in', ref('User')), 401: errorResponse, 429: errorResponse },
      },
    },
    '/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify an email code',
        description: 'A valid code does not create the account or log anyone in. It returns a short-lived consentToken to use with POST /auth/consent.',
        requestBody: { required: true, content: { 'application/json': { schema: ref('VerifyEmailInput') } } },
        responses: { 200: jsonResponse('Code accepted', { type: 'object', properties: { consentToken: { type: 'string' } } }), ...authErrors },
      },
    },
    '/auth/consent': {
      post: {
        tags: ['Auth'],
        summary: 'Accept the consent notice, create the account and log in',
        description: 'Activates the account, stores the acceptance date, time and notice version, and sets the session cookie. The consent token is bound to the sign-up it was issued for: after a re-signup of the same email, an older token gets 400 "This sign-up step has expired" (the same applies to /auth/decline-consent). The account is finished in one conditional write, so a racing re-signup and this consent cannot both succeed.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['consentToken', 'accepted', 'version'], properties: { consentToken: { type: 'string' }, accepted: { type: 'boolean', enum: [true] }, version: { type: 'string' } } } } } },
        responses: { 200: jsonResponse('Account created and logged in', ref('User')), ...authErrors, 409: errorResponse },
      },
    },
    '/auth/decline-consent': {
      post: {
        tags: ['Auth'],
        summary: 'Decline the consent notice and discard the unfinished sign-up',
        description: 'Like /auth/consent, the token must be from the newest verification: after a re-signup an older token gets 400 and the sign-up is kept.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['consentToken'], properties: { consentToken: { type: 'string' } } } } } },
        responses: { 204: { description: 'Sign-up discarded' }, ...authErrors },
      },
    },
    '/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend an email verification code',
        requestBody: { required: true, content: { 'application/json': { schema: ref('EmailInput') } } },
        responses: { 200: jsonResponse('Generic response', { type: 'object', properties: { message: { type: 'string' } } }), 429: errorResponse },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset code',
        requestBody: { required: true, content: { 'application/json': { schema: ref('EmailInput') } } },
        responses: { 200: jsonResponse('Generic response', { type: 'object', properties: { message: { type: 'string' } } }), 429: errorResponse },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset a password using a one-time code',
        requestBody: { required: true, content: { 'application/json': { schema: ref('ResetPasswordInput') } } },
        responses: { 200: jsonResponse('Password reset', { type: 'object', properties: { message: { type: 'string' } } }), ...authErrors },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out everywhere',
        description: 'Clears the cookie. With a valid session it also ends every session of the account on every device (the session version is bumped), so an old copy of the token stops working.',
        security: [{ cookieAuth: [] }, {}],
        responses: { 204: { description: 'Logged out' } },
      },
    },
    '/auth/session': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current session',
        security: [{ cookieAuth: [] }, {}],
        responses: { 200: jsonResponse('Current user or null for a visitor', { allOf: [ref('User')], nullable: true }), 429: errorResponse },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get the current user',
        security: userSecurity,
        responses: { 200: jsonResponse('Current user', ref('User')), 401: errorResponse },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update profile connections',
        security: userSecurity,
        requestBody: { required: true, content: { 'application/json': { schema: ref('UpdateProfileInput') } } },
        responses: { 200: jsonResponse('Updated user', ref('User')), 401: errorResponse, 422: errorResponse },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete the current contributor account',
        description: 'Requires the current password. Removes the account and invalidates the session, but leaves submitted recordings and contribution data in the archive. Data-deletion requests can be sent through the recording/data deletion contact topic at any time, including after account deletion.',
        security: userSecurity,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['password'], properties: { password: { type: 'string', minLength: 1, maxLength: 128 } } } } } },
        responses: { 204: { description: 'Account deleted; existing submissions remain' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    '/users/me/password': {
      post: {
        tags: ['Users'],
        summary: 'Change the password while logged in',
        description: 'Checks the current password, then ends every other session and sets a new cookie for this one. A wrong current password counts toward the login lockout; while the account is locked this answers 429 ACCOUNT_LOCKED.',
        security: userSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'password', 'confirmPassword'],
                properties: {
                  currentPassword: { type: 'string', minLength: 1, maxLength: 200 },
                  password: { type: 'string', minLength: 8, maxLength: 72 },
                  confirmPassword: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 204: { description: 'Password changed; a new cookie is set' }, 401: errorResponse, 422: errorResponse, 429: errorResponse },
      },
    },
    '/users/me/consent': {
      post: {
        tags: ['Users'],
        summary: 'Accept the consent notice',
        description: 'Records the acceptance date and time and the notice version. Submissions are refused with CONSENT_REQUIRED until this is done.',
        security: userSecurity,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['accepted', 'version'], properties: { accepted: { type: 'boolean', enum: [true] }, version: { type: 'string' } } } } } },
        responses: { 200: jsonResponse('Updated user', ref('User')), 401: errorResponse, 409: errorResponse, 422: errorResponse },
      },
    },
    '/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List categories',
        responses: { 200: jsonResponse('Categories', { type: 'array', items: ref('Category') }) },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create a category',
        security: adminSecurity,
        requestBody: { required: true, content: { 'application/json': { schema: ref('CategoryCreateInput') } } },
        responses: { 201: jsonResponse('Created', ref('Category')), ...adminErrors, 409: errorResponse },
      },
    },
    '/categories/{id}': {
      parameters: [idParameter],
      patch: {
        tags: ['Categories'],
        summary: 'Update a category',
        security: adminSecurity,
        requestBody: { required: true, content: { 'application/json': { schema: ref('CategoryUpdateInput') } } },
        responses: { 200: jsonResponse('Updated', ref('Category')), ...adminErrors, 404: errorResponse, 409: errorResponse },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete a category and unassign its videos',
        security: adminSecurity,
        responses: { 204: { description: 'Deleted' }, ...adminErrors, 404: errorResponse },
      },
    },
    '/videos': {
      get: {
        tags: ['Videos'],
        summary: 'List visible videos',
        description: 'Anonymous callers receive published videos assigned to a category. Admins receive all videos.',
        responses: { 200: jsonResponse('Videos', { type: 'array', items: ref('Video') }), 429: errorResponse },
      },
      post: {
        tags: ['Videos'],
        summary: 'Add a base video from an upload or direct URL',
        security: adminSecurity,
        requestBody: { required: true, content: { 'multipart/form-data': { schema: ref('VideoUploadInput') } } },
        responses: { 201: jsonResponse('Created', ref('Video')), ...adminErrors, 413: errorResponse },
      },
    },
    '/videos/{id}': {
      parameters: [idParameter],
      get: {
        tags: ['Videos'],
        summary: 'Get one visible video',
        responses: { 200: jsonResponse('Video', ref('Video')), 404: errorResponse },
      },
      patch: {
        tags: ['Videos'],
        summary: 'Update video metadata',
        security: adminSecurity,
        requestBody: { required: true, content: { 'application/json': { schema: ref('VideoUpdateInput') } } },
        responses: { 200: jsonResponse('Updated video', ref('Video')), ...adminErrors, 404: errorResponse },
      },
      delete: {
        tags: ['Videos'],
        summary: 'Delete a video and its files',
        security: adminSecurity,
        responses: { 204: { description: 'Deleted; existing submissions remain' }, ...adminErrors, 404: errorResponse },
      },
    },
    '/videos/{id}/file': {
      parameters: [idParameter],
      get: {
        tags: ['Videos'],
        summary: 'Stream a visible video file',
        description: 'Supports HTTP byte-range requests.',
        responses: {
          200: { description: 'Video stream', content: videoContent },
          206: { description: 'Partial video stream for a byte-range request', content: videoContent },
          404: errorResponse,
        },
      },
    },
    '/videos/{id}/poster': {
      parameters: [idParameter],
      get: {
        tags: ['Videos'],
        summary: 'Stream a visible video poster',
        responses: {
          200: { description: 'Image stream', content: { 'image/jpeg': {}, 'image/png': {}, 'image/webp': {} } },
          404: errorResponse,
        },
      },
    },
    '/demo-video': {
      get: {
        tags: ['Demo Video'],
        summary: 'Get the public demo video metadata',
        responses: { 200: jsonResponse('Current demo video, or null when none is set', { allOf: [ref('DemoVideo')], nullable: true }) },
      },
      post: {
        tags: ['Demo Video'],
        summary: 'Upload or replace the public demo video',
        security: adminSecurity,
        requestBody: { required: true, content: { 'multipart/form-data': { schema: ref('DemoVideoUploadInput') } } },
        responses: { 201: jsonResponse('Uploaded', ref('DemoVideo')), ...adminErrors, 413: errorResponse },
      },
      delete: {
        tags: ['Demo Video'],
        summary: 'Delete the public demo video',
        security: adminSecurity,
        responses: { 204: { description: 'Deleted' }, ...adminErrors },
      },
    },
    '/demo-video/file': {
      get: {
        tags: ['Demo Video'],
        summary: 'Stream the public demo video',
        description: 'Supports HTTP byte-range requests.',
        responses: {
          200: { description: 'Video stream', content: videoContent },
          206: { description: 'Partial video stream for a byte-range request', content: videoContent },
          404: errorResponse,
        },
      },
    },
    '/submissions': {
      get: {
        tags: ['Submissions'],
        summary: 'List the current user submissions',
        description: 'Contributors receive their own submissions; admins receive all submissions and archive metadata, or only their own with mine=true. With limit (and cursor) the answer is one page, { items, nextCursor, total }; without it, the whole array (deprecated for admins: use /admin/submissions).',
        security: userSecurity,
        parameters: [
          { name: 'mine', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: jsonResponse('Submissions, or one page of them', { oneOf: [{ type: 'array', items: ref('Submission') }, pageOf(ref('Submission'))] }), 401: errorResponse, 422: errorResponse },
      },
      post: {
        tags: ['Submissions'],
        summary: 'Submit a recording',
        security: userSecurity,
        requestBody: { required: true, content: { 'multipart/form-data': { schema: ref('SubmissionInput') } } },
        responses: { 201: jsonResponse('Created', ref('Submission')), 401: errorResponse, 404: errorResponse, 409: errorResponse, 413: errorResponse, 422: errorResponse },
      },
    },
    '/contact': {
      post: {
        tags: ['Contact'],
        summary: 'Send a contact message or recording/data deletion request',
        description: 'General and partnership messages require a signed-in account and matching account email (403 otherwise; one per account per UTC day, 409 after that), and share a site-wide cap of CONTACT_DAILY_LIMIT per UTC day (429). The recording-deletion topic may be sent before or after account deletion, without signing in; it is exempt from the site-wide cap. Signed-out deletion requests are limited to CONTACT_SENDER_DAILY_LIMIT per IP and per device per UTC day (429) and are confirmed with a six-digit code emailed to the account, if one exists. Signed-in deletion requests are verified at once. None of these refusals restricts the device or IP. Recordings already used in a released model cannot be removed from that model.',
        security: [...userSecurity, {}],
        requestBody: { required: true, content: { 'application/json': { schema: ref('ContactInput') } } },
        responses: { 201: jsonResponse('Message sent and saved to the admin inbox', ref('ContactReceipt')), 403: errorResponse, 409: errorResponse, 422: errorResponse, 429: errorResponse },
      },
    },
    '/contact/{id}/verify': {
      parameters: [idParameter],
      post: {
        tags: ['Contact'],
        summary: 'Confirm a signed-out deletion request with the emailed code',
        description: 'A wrong, expired or used-up code and an unknown id all give the same 400. The code dies after AUTH_OTP_MAX_ATTEMPTS wrong tries. Calling it again on a verified request returns 200.',
        requestBody: { required: true, content: { 'application/json': { schema: ref('ContactCodeInput') } } },
        responses: {
          200: jsonResponse('Request verified', { type: 'object', required: ['verified'], properties: { verified: { type: 'boolean', enum: [true] } } }),
          400: errorResponse,
          422: errorResponse,
          429: errorResponse,
        },
      },
    },
    '/contact/{id}/resend': {
      parameters: [idParameter],
      post: {
        tags: ['Contact'],
        summary: 'Email a new code for a signed-out deletion request',
        description: 'Same answer whether or not an account uses the email; a code is sent only when one does, and only while that address has had fewer than CONTACT_CODE_EMAILS_PER_DAY code emails today (the answer is the same either way). At most once per AUTH_OTP_RESEND_SECONDS, and at most 5 codes per request, the first included (429 for either). 400 for a request that needs no code.',
        responses: {
          202: jsonResponse('Accepted', { type: 'object', required: ['message'], properties: { message: { type: 'string' } } }),
          400: errorResponse,
          422: errorResponse,
          429: errorResponse,
        },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List all users',
        description: 'With limit the answer is one page, { items, nextCursor, total }, oldest first, filtered by role and q (the start of a first name, surname or email, case-insensitive, matched literally). Without limit, every account (deprecated).',
        security: adminSecurity,
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['user', 'admin'] } },
          { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } },
        ],
        responses: { 200: jsonResponse('Users, or one page of them', { oneOf: [{ type: 'array', items: ref('User') }, pageOf(ref('User'))] }), ...adminErrors, 422: errorResponse },
      },
    },
    '/admin/users/{id}': {
      parameters: [idParameter],
      patch: {
        tags: ['Admin'],
        summary: 'Activate or suspend a user',
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['active', 'suspended'] },
                  reason: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        },
        responses: { 200: jsonResponse('Updated user', ref('User')), ...adminErrors, 404: errorResponse, 409: errorResponse },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a user account; recordings are kept unless withRecordings=true',
        description: 'Without withRecordings the submitted recordings stay stored. With withRecordings=true (C3) they are deleted first; if any file cannot be deleted the account is kept and the answer is 409. A DeletedAccount record (the keyed email hash) is written either way.',
        security: adminSecurity,
        parameters: [{ name: 'withRecordings', in: 'query', schema: { type: 'string', enum: ['true', 'false'], default: 'false' } }],
        responses: { 204: { description: 'Deleted' }, ...adminErrors, 404: errorResponse, 409: errorResponse },
      },
    },
    '/admin/users/{id}/submissions': {
      parameters: [idParameter],
      get: {
        tags: ['Admin'],
        summary: "One page of a contributor's submissions, newest first",
        description: 'Works for the id of a deleted account too, since account deletion keeps recordings.',
        security: adminSecurity,
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'cursor', in: 'query', description: 'nextCursor from the previous page.', schema: { type: 'string', pattern: '^[a-f\\d]{24}$' } },
        ],
        responses: {
          200: jsonResponse('A page of submissions', {
            type: 'object',
            required: ['items', 'total', 'nextCursor'],
            properties: {
              items: { type: 'array', items: ref('Submission') },
              total: { type: 'integer', minimum: 0 },
              nextCursor: { type: 'string', nullable: true },
            },
          }),
          ...adminErrors,
        },
      },
      delete: {
        tags: ['Admin'],
        summary: "Delete all of a contributor's recordings (a deletion request, C3)",
        description: 'Removes each file from storage, then its Submission document, then the cooldowns, and writes a DeletionLog (email hash only). A file that cannot be removed is listed in failed and keeps its document, so calling again finishes the job.',
        security: adminSecurity,
        parameters: [{ name: 'requestMessageId', in: 'query', description: 'The contact message this answers.', schema: { type: 'string', pattern: '^[a-f\\d]{24}$' } }],
        responses: {
          200: jsonResponse('Result', {
            type: 'object',
            required: ['deleted', 'failed'],
            properties: {
              deleted: { type: 'integer', minimum: 0 },
              failed: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } } } },
            },
          }),
          ...adminErrors,
          404: errorResponse,
        },
      },
    },
    '/admin/deletion-lookup': {
      get: {
        tags: ['Admin'],
        summary: 'Find whose recordings a deletion request is about',
        description: 'Give exactly one of messageId (uses the email of that contact message) or email. Matches the current account and, by keyed email hash, deleted accounts.',
        security: adminSecurity,
        parameters: [
          { name: 'messageId', in: 'query', schema: { type: 'string', pattern: '^[a-f\\d]{24}$' } },
          { name: 'email', in: 'query', schema: { type: 'string', format: 'email' } },
        ],
        responses: {
          200: jsonResponse('Matches', {
            type: 'object',
            required: ['matches'],
            properties: {
              matches: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['kind', 'userId', 'submissionCount'],
                  properties: {
                    kind: { type: 'string', enum: ['user', 'deleted'] },
                    userId: { type: 'string' },
                    submissionCount: { type: 'integer', minimum: 0 },
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    role: { type: 'string' },
                    status: { type: 'string' },
                    deletedAt: { type: 'string', format: 'date-time' },
                    deletedBy: { type: 'string', enum: ['self', 'admin'] },
                  },
                },
              },
            },
          }),
          ...adminErrors,
          404: errorResponse,
        },
      },
    },
    '/admin/restrictions': {
      get: {
        tags: ['Admin'],
        summary: 'List IP and device restrictions',
        security: adminSecurity,
        responses: { 200: jsonResponse('Restrictions', { type: 'array', items: { type: 'object' } }), ...adminErrors },
      },
      post: {
        tags: ['Admin'],
        summary: 'Restrict an IP address or device ID',
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'value'],
                properties: {
                  type: { type: 'string', enum: ['ip', 'device'] },
                  value: { type: 'string', minLength: 1, maxLength: 128 },
                  reason: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        },
        responses: { 201: jsonResponse('Restriction created', { type: 'object' }), ...adminErrors },
      },
    },
    '/admin/restrictions/{id}': {
      parameters: [idParameter],
      delete: {
        tags: ['Admin'],
        summary: 'Remove an IP or device restriction',
        security: adminSecurity,
        responses: { 204: { description: 'Removed' }, ...adminErrors, 404: errorResponse },
      },
    },
    '/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Get dashboard statistics',
        description: 'totals and totalsByCategory are all-time; activity (per UTC day), byCategory, summary, topVideos, topContributors and recent cover the range and the optional userId and categoryId filters.',
        security: adminSecurity,
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', minimum: 7, maximum: 90, default: 14 } },
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: jsonResponse('Statistics', { type: 'object' }), ...adminErrors },
      },
    },
    '/admin/submissions': {
      get: {
        tags: ['Admin'],
        summary: 'List submissions, filtered, a page at a time (B5)',
        security: adminSecurity,
        parameters: [...submissionFilterParameters,
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: jsonResponse('One page of submissions: the export columns plus contributorName', pageOf({ type: 'object' })), ...adminErrors, 422: errorResponse },
      },
    },
    '/admin/submissions/export': {
      get: {
        tags: ['Admin'],
        summary: 'Export submissions for the ML team (B5)',
        description: 'Streamed CSV (RFC 4180, UTF-8 with BOM) or a JSON array, as an attachment. Columns, in order: submissionId, userId, videoId, videoTitle, categoryId, categoryLabel, driveFileId, archivePath, mimeType, size, duration, trimStart, trimEnd, mirrored, submittedAt, storageDriver. No names or emails.',
        security: adminSecurity,
        parameters: [{ name: 'format', in: 'query', required: true, schema: { type: 'string', enum: ['csv', 'json'] } }, ...submissionFilterParameters],
        responses: {
          200: { description: 'The export file', content: { 'text/csv': { schema: { type: 'string' } }, 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
          ...adminErrors,
          422: errorResponse,
        },
      },
    },
    '/admin/audit': {
      get: {
        tags: ['Admin'],
        summary: 'List the activity log (S7)',
        description: 'Every admin action, newest first. actor is an admin id, or "system" for the startup admin sync. Each entry: { id, actor: { id, name }, action, targetType, targetId, meta, at }.',
        security: adminSecurity,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          { name: 'actor', in: 'query', schema: { type: 'string', description: 'An admin user id, or "system".' } },
          { name: 'action', in: 'query', schema: { type: 'string', enum: AUDIT_ACTIONS } },
        ],
        responses: {
          200: jsonResponse('One page of the activity log', {
            type: 'object',
            properties: {
              entries: { type: 'array', items: { type: 'object' } },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
            },
          }),
          ...adminErrors,
          422: errorResponse,
        },
      },
    },
    '/admin/messages': {
      get: {
        tags: ['Admin'],
        summary: 'List contact messages',
        security: adminSecurity,
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
          { name: 'topic', in: 'query', schema: { type: 'string', enum: ['general', 'partnership', 'recording-deletion'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'done', 'rejected'] } },
          { name: 'verified', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: { 200: jsonResponse('Messages', { type: 'array', items: ref('ContactMessage') }), ...adminErrors },
      },
    },
    '/admin/messages/{id}': {
      parameters: [idParameter],
      patch: {
        tags: ['Admin'],
        summary: 'Mark a message done or rejected, or reopen it',
        description: 'done and rejected record handledAt and handledBy; open clears them.',
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['open', 'done', 'rejected'] } } } } },
        },
        responses: { 200: jsonResponse('Updated message', ref('ContactMessage')), ...adminErrors, 404: errorResponse },
      },
    },
  },
}
