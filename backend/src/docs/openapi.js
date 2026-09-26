const envelope = (schema = {}) => ({
  type: 'object',
  properties: { data: schema },
})

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
}

const errorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              fields: { type: 'object', additionalProperties: { type: 'string' } },
            },
          },
        },
      },
    },
  },
}

const userSecurity = [{ cookieAuth: [] }]
const adminSecurity = userSecurity

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'SignPak Commons API',
    version: '1.0.0',
    description: 'API for the SignPak Commons Pakistan Sign Language dataset contribution platform.',
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
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'signpak_token', description: 'HTTP-only JWT cookie set by login or email verification.' },
    },
    schemas: {
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string' }, label: { type: 'string' }, copy: { type: 'string' }, tone: { type: 'string', enum: ['yellow', 'blue', 'red', 'green'] },
        },
      },
      Video: {
        type: 'object',
        properties: {
          id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string', enum: ['draft', 'published'] },
          categoryId: { type: 'string', nullable: true }, order: { type: 'integer' }, durationSec: { type: 'number' },
          videoUrl: { type: 'string' }, poster: { type: 'string', nullable: true }, size: { type: 'integer' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' }, firstName: { type: 'string' }, surname: { type: 'string' }, email: { type: 'string', format: 'email' },
          emailVerified: { type: 'boolean' },
          role: { type: 'string', enum: ['user', 'admin'] }, status: { type: 'string', enum: ['active', 'suspended'] }, statusReason: { type: 'string' },
          connections: { type: 'object', additionalProperties: { type: 'string', nullable: true } },
        },
      },
      SignupInput: {
        type: 'object', required: ['firstName', 'surname', 'email', 'password'],
        properties: {
          firstName: { type: 'string', maxLength: 60 }, surname: { type: 'string', maxLength: 60 },
          email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', minLength: 8 }, confirmPassword: { type: 'string' },
        },
      },
      AuthInput: {
        type: 'object', required: ['email', 'password'],
        properties: {
          firstName: { type: 'string', maxLength: 60 }, surname: { type: 'string', maxLength: 60 },
          email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', minLength: 8 }, confirmPassword: { type: 'string' },
        },
      },
      Submission: {
        type: 'object',
        properties: { id: { type: 'string' }, videoId: { type: 'string' }, submittedAt: { type: 'string', format: 'date-time' }, duration: { type: 'number' }, mirrored: { type: 'boolean' } },
      },
      Error: { type: 'object', properties: { error: { type: 'object' } } },
    },
  },
  paths: {
    '/health': {
      get: { tags: ['Health'], summary: 'Check API and database health', responses: { 200: { description: 'Healthy', content: { 'application/json': { schema: envelope({ type: 'object' }) } } }, 503: { description: 'Database unavailable' } } },
    },
    '/docs.json': { get: { tags: ['Health'], summary: 'Get the OpenAPI document', responses: { 200: { description: 'OpenAPI JSON document' } } } },
    '/auth/signup': {
      post: { tags: ['Auth'], summary: 'Create an unverified account and send a code', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupInput' } } } }, responses: { 201: { description: 'Account pending email verification' }, 400: errorResponse } },
    },
    '/auth/login': {
      post: { tags: ['Auth'], summary: 'Log in and set the HTTP-only cookie', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthInput' } } } }, responses: { 200: { description: 'Logged in' }, 401: errorResponse } },
    },
    '/auth/verify-email': { post: { tags: ['Auth'], summary: 'Verify an email code and establish a session', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'code'], properties: { email: { type: 'string', format: 'email' }, code: { type: 'string', pattern: '^\\d{6}$' } } } } } }, responses: { 200: { description: 'Verified and logged in' }, 400: errorResponse } } },
    '/auth/resend-verification': { post: { tags: ['Auth'], summary: 'Resend an email verification code', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } }, responses: { 200: { description: 'Generic response' } } } },
    '/auth/forgot-password': { post: { tags: ['Auth'], summary: 'Request a password reset code', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } }, responses: { 200: { description: 'Generic response' } } } },
    '/auth/reset-password': { post: { tags: ['Auth'], summary: 'Reset a password using a one-time code', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'code', 'password', 'confirmPassword'], properties: { email: { type: 'string', format: 'email' }, code: { type: 'string', pattern: '^\\d{6}$' }, password: { type: 'string', format: 'password', minLength: 8 }, confirmPassword: { type: 'string', format: 'password' } } } } } }, responses: { 200: { description: 'Password reset' }, 400: errorResponse } } },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Clear the session cookie', responses: { 204: { description: 'Logged out' } } } },
    '/auth/session': { get: { tags: ['Auth'], summary: 'Get the current session', responses: { 200: { description: 'Session state' } } } },
    '/users/me': {
      get: { tags: ['Users'], summary: 'Get the current user', security: userSecurity, responses: { 200: { description: 'Current user' }, 401: errorResponse } },
      patch: { tags: ['Users'], summary: 'Update profile connections', security: userSecurity, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { connections: { type: 'object' } } } } } }, responses: { 200: { description: 'Updated user' }, 400: errorResponse } },
    },
    '/categories': {
      get: { tags: ['Categories'], summary: 'List categories', responses: { 200: { description: 'Categories', content: { 'application/json': { schema: envelope({ type: 'array', items: { $ref: '#/components/schemas/Category' } }) } } } } },
      post: { tags: ['Categories'], summary: 'Create a category', security: adminSecurity, requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } }, responses: { 201: { description: 'Created' }, 403: errorResponse } },
    },
    '/categories/{id}': {
      parameters: [idParameter],
      patch: { tags: ['Categories'], summary: 'Update a category', security: adminSecurity, requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } }, responses: { 200: { description: 'Updated' }, 404: errorResponse } },
      delete: { tags: ['Categories'], summary: 'Delete a category', security: adminSecurity, responses: { 204: { description: 'Deleted' }, 404: errorResponse } },
    },
    '/videos': {
      get: { tags: ['Videos'], summary: 'List visible videos', description: 'Anonymous callers receive published videos assigned to a category. Admins receive all videos.', responses: { 200: { description: 'Videos', content: { 'application/json': { schema: envelope({ type: 'array', items: { $ref: '#/components/schemas/Video' } }) } } } } },
      post: { tags: ['Videos'], summary: 'Upload a base video', security: adminSecurity, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['video', 'title'], properties: { video: { type: 'string', format: 'binary' }, poster: { type: 'string', format: 'binary' }, title: { type: 'string' }, categoryId: { type: 'string' }, status: { type: 'string', enum: ['draft', 'published'] }, durationSec: { type: 'number' } } } } } }, responses: { 201: { description: 'Created' }, 400: errorResponse } },
    },
    '/videos/{id}': {
      parameters: [idParameter],
      get: { tags: ['Videos'], summary: 'Get one visible video', responses: { 200: { description: 'Video' }, 404: errorResponse } },
      patch: { tags: ['Videos'], summary: 'Update video metadata', security: adminSecurity, requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Video' } } } }, responses: { 200: { description: 'Updated' }, 404: errorResponse } },
      delete: { tags: ['Videos'], summary: 'Delete a video and its files', security: adminSecurity, responses: { 204: { description: 'Deleted' }, 404: errorResponse } },
    },
    '/videos/{id}/file': { parameters: [idParameter], get: { tags: ['Videos'], summary: 'Stream a visible video file', responses: { 200: { description: 'Video stream', content: { 'video/mp4': {} } }, 404: errorResponse } } },
    '/videos/{id}/poster': { parameters: [idParameter], get: { tags: ['Videos'], summary: 'Stream a visible video poster', responses: { 200: { description: 'Image stream' }, 404: errorResponse } } },
    '/demo-video': {
      get: { tags: ['Demo Video'], summary: 'Get the public demo video metadata', responses: { 200: { description: 'Current demo video, or null when none is set' } } },
      post: { tags: ['Demo Video'], summary: 'Upload or replace the public demo video', security: adminSecurity, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['video', 'title'], properties: { video: { type: 'string', format: 'binary' }, title: { type: 'string', maxLength: 120 }, durationSec: { type: 'number' } } } } } }, responses: { 201: { description: 'Uploaded' }, 422: errorResponse } },
      delete: { tags: ['Demo Video'], summary: 'Delete the public demo video', security: adminSecurity, responses: { 204: { description: 'Deleted' }, 403: errorResponse } },
    },
    '/demo-video/file': { get: { tags: ['Demo Video'], summary: 'Stream the public demo video', responses: { 200: { description: 'Video stream', content: { 'video/mp4': {} } }, 404: errorResponse } } },
    '/submissions': {
      get: { tags: ['Submissions'], summary: 'List the current user submissions', security: userSecurity, responses: { 200: { description: 'Submissions' }, 401: errorResponse } },
      post: { tags: ['Submissions'], summary: 'Submit a recording', security: userSecurity, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['recording', 'videoId'], properties: { recording: { type: 'string', format: 'binary' }, videoId: { type: 'string' }, trimStart: { type: 'number' }, trimEnd: { type: 'number' }, mirrored: { type: 'boolean' }, duration: { type: 'number' } } } } } }, responses: { 201: { description: 'Created' }, 400: errorResponse } },
    },
    '/contact': { post: { tags: ['Contact'], summary: 'Send a contact message from the authenticated account email', security: userSecurity, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'message'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, message: { type: 'string' } } } } } }, responses: { 201: { description: 'Message sent to Web3Forms and saved to the admin inbox' }, 403: errorResponse, 409: errorResponse, 429: errorResponse } } },
    '/admin/users': { get: { tags: ['Admin'], summary: 'List all users', security: adminSecurity, responses: { 200: { description: 'Users' }, 403: errorResponse } } },
    '/admin/users/{id}': {
      parameters: [idParameter],
      patch: { tags: ['Admin'], summary: 'Activate or suspend a user', security: adminSecurity, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['active', 'suspended'] }, reason: { type: 'string', maxLength: 500 } } } } } }, responses: { 200: { description: 'Updated user' }, 403: errorResponse, 404: errorResponse } },
      delete: { tags: ['Admin'], summary: 'Delete a user and their submitted recordings', security: adminSecurity, responses: { 204: { description: 'Deleted' }, 403: errorResponse, 404: errorResponse } },
    },
    '/admin/restrictions': {
      get: { tags: ['Admin'], summary: 'List IP and device restrictions', security: adminSecurity, responses: { 200: { description: 'Restrictions' } } },
      post: { tags: ['Admin'], summary: 'Restrict an IP address or device ID', security: adminSecurity, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['type', 'value'], properties: { type: { type: 'string', enum: ['ip', 'device'] }, value: { type: 'string' }, reason: { type: 'string', maxLength: 500 } } } } } }, responses: { 201: { description: 'Restriction created' }, 422: errorResponse } },
    },
    '/admin/restrictions/{id}': { parameters: [idParameter], delete: { tags: ['Admin'], summary: 'Remove an IP or device restriction', security: adminSecurity, responses: { 204: { description: 'Removed' }, 404: errorResponse } } },
    '/admin/stats': { get: { tags: ['Admin'], summary: 'Get dashboard statistics', security: adminSecurity, parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', minimum: 7, maximum: 90, default: 14 } }], responses: { 200: { description: 'Statistics' }, 403: errorResponse } } },
    '/admin/messages': { get: { tags: ['Admin'], summary: 'List contact messages', security: adminSecurity, parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } }], responses: { 200: { description: 'Messages' }, 403: errorResponse } } },
  },
}
