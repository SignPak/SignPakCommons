const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
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
          videoUrl: { type: 'string' },
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
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', pattern: '^\\d{6}$' },
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
        required: ['video', 'title'],
        properties: {
          video: { type: 'string', format: 'binary', description: 'MP4, WebM, or MOV video.' },
          poster: { type: 'string', format: 'binary', description: 'Optional JPEG, PNG, or WebP image (up to 2 MiB).' },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          categoryId: { type: 'string', nullable: true, pattern: '^[a-f\\d]{24}$' },
          status: { type: 'string', enum: ['draft', 'published'], default: 'published' },
          durationSec: { type: 'number', minimum: 0, maximum: 86400, default: 0 },
        },
      },
      DemoVideo: {
        type: 'object',
        required: ['id', 'title', 'durationSec', 'videoUrl', 'size'],
        properties: {
          id: { type: 'string', enum: ['current'] },
          title: { type: 'string', maxLength: 120 },
          durationSec: { type: 'number' },
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
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          message: { type: 'string', minLength: 1, maxLength: 2000 },
        },
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
        summary: 'Check API and database health',
        responses: {
          200: jsonResponse('Healthy', { type: 'object', properties: { status: { type: 'string', enum: ['ok'] }, database: { type: 'string', enum: ['connected'] }, uptime: { type: 'integer' } } }),
          503: { description: 'Database unavailable' },
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
        requestBody: { required: true, content: { 'application/json': { schema: ref('SignupInput') } } },
        responses: { 201: jsonResponse('Account pending email verification', ref('User')), ...authErrors },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and set the HTTP-only cookie',
        requestBody: { required: true, content: { 'application/json': { schema: ref('LoginInput') } } },
        responses: { 200: jsonResponse('Logged in', ref('User')), 401: errorResponse, 429: errorResponse },
      },
    },
    '/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify an email code and establish a session',
        requestBody: { required: true, content: { 'application/json': { schema: ref('VerifyEmailInput') } } },
        responses: { 200: jsonResponse('Verified and logged in', ref('User')), ...authErrors },
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
      post: { tags: ['Auth'], summary: 'Clear the session cookie', responses: { 204: { description: 'Logged out' } } },
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
        summary: 'Upload a base video',
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
        description: 'Contributors receive their own submissions; admins receive all submissions and archive metadata.',
        security: userSecurity,
        responses: { 200: jsonResponse('Submissions', { type: 'array', items: ref('Submission') }), 401: errorResponse },
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
        summary: 'Send a contact message from the authenticated account email',
        description: 'Requires a signed-in account and an email matching that account.',
        security: userSecurity,
        requestBody: { required: true, content: { 'application/json': { schema: ref('ContactInput') } } },
        responses: { 201: jsonResponse('Message sent and saved to the admin inbox', { type: 'object' }), 403: errorResponse, 409: errorResponse, 422: errorResponse, 429: errorResponse },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List all users',
        security: adminSecurity,
        responses: { 200: jsonResponse('Users', { type: 'array', items: ref('User') }), ...adminErrors },
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
        summary: 'Delete a user and their submitted recordings',
        security: adminSecurity,
        responses: { 204: { description: 'Deleted' }, ...adminErrors, 404: errorResponse, 409: errorResponse },
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
        security: adminSecurity,
        parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', minimum: 7, maximum: 90, default: 14 } }],
        responses: { 200: jsonResponse('Statistics', { type: 'object' }), ...adminErrors },
      },
    },
    '/admin/messages': {
      get: {
        tags: ['Admin'],
        summary: 'List contact messages',
        security: adminSecurity,
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } }],
        responses: { 200: jsonResponse('Messages', { type: 'array', items: { type: 'object' } }), ...adminErrors },
      },
    },
  },
}
