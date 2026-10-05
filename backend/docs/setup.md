# Backend Setup

This guide explains how to install, configure, run, test, and deploy the SignPak Commons backend.

## 1. Prerequisites

Install:

- Node.js 22 or newer
- npm
- MongoDB 7+ locally, or a MongoDB Atlas cluster
- Git

The backend does not require Google Drive for local development. Local storage is the default.

## 2. Install the backend

From the repository root:

```bash
cd backend
npm install
```

Windows PowerShell uses the same commands:

```powershell
Set-Location backend
npm install
```

## 3. Create the environment file

Copy the committed template. Never commit the resulting `.env` file.

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The application loads `.env` automatically through `dotenv`. `src/config/env.js` validates every value at startup and stops the process with a readable error when a required value is missing or invalid.

## 4. Configure MongoDB

### Local MongoDB

Start MongoDB and use:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/signpakcommons
```

### MongoDB Atlas

1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user with access to the application database.
3. Add the backend server IP to Atlas Network Access. For local development, use your current IP rather than opening access to everyone.
4. Select **Connect > Drivers** and copy the Node.js connection string.
5. Replace the username, password, cluster host, and database name in `.env`:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/signpakcommons?retryWrites=true&w=majority
```

URL-encode special characters in the database username or password.

## 5. Environment variables

### Runtime and networking

| Variable | Where to get it | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Set manually: `development`, `test`, or `production` | Selects runtime behavior and production cookie defaults. |
| `PORT` | Set manually; default `5000` | Port used by the Express server. |
| `LOG_LEVEL` | Set manually: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` | Controls structured log verbosity. |
| `TRUST_PROXY` | Set `true` behind a trusted reverse proxy | Enables Express proxy awareness for client IPs used by rate limits and access restrictions. |
| `CLIENT_ORIGIN` | Frontend URL, for example `http://localhost:5173` | CORS allowlist and state-changing request origin check. Separate multiple origins with commas. |

### Authentication and cookies

| Variable | Where to get it | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Generate locally with the command below, or use a secret manager | Signs authentication tokens. Use a unique value of at least 32 characters. |
| `JWT_EXPIRES_DAYS` | Set manually; default `7` | Token lifetime in days. |
| `COOKIE_SECURE` | Usually leave unset; production defaults to `true` | Sends cookies only over HTTPS when true. Use false only for local HTTP development. |
| `COOKIE_SAMESITE` | Usually `lax`; use `none` only for cross-site HTTPS deployment | Controls cross-site cookie behavior. `none` requires `COOKIE_SECURE=true`. |
| `BCRYPT_ROUNDS` | Set manually from `4` to `15`; default `12` | Password hashing cost. Increase only when deployment CPU allows it. |
| `AUTH_OTP_TTL_MINUTES` | Set manually; default `5`, range `1`–`30` | Lifetime of email verification and password-reset codes. |
| `AUTH_OTP_RESEND_SECONDS` | Set manually; default `60`, range `0`–`3600` | Minimum interval between verification-code resend requests. |
| `AUTH_OTP_MAX_ATTEMPTS` | Set manually; default `5`, range `1`–`10` | Maximum code verification attempts. |

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Admin bootstrap

| Variable | Where to get it | Purpose |
| --- | --- | --- |
| `ADMIN_EMAIL` | Choose the initial administrator email | Creates or promotes the admin account at startup. |
| `ADMIN_PASSWORD` | Choose a strong password, at least 8 characters and at most 72 | Sets the initial administrator password. |
| `ADMIN_FIRST_NAME` | Set manually; default `Admin` | Initial admin profile first name. |
| `ADMIN_SURNAME` | Set manually; default `Signpak` | Initial admin profile surname. |

The admin is ensured on every startup. Changing `ADMIN_PASSWORD` later does not reset an existing admin password.

### Storage

| Variable | Where to get it | Purpose |
| --- | --- | --- |
| `STORAGE_DRIVER` | `local` or `gdrive` | Storage for readable base videos and posters. Use `local` for development. |
| `ARCHIVE_STORAGE_DRIVER` | `local` or `gdrive` | Append-only storage for contributor recordings. Use `gdrive` for production archives. |
| `UPLOAD_DIR` | Local filesystem path; default `uploads` | Local storage root; temporary uploads are kept in its `tmp` subdirectory. |
| `MAX_VIDEO_UPLOAD_MB` | Set manually; default `90` | Maximum reference-video or demo-video upload size, in MiB. |
| `MAX_RECORDING_UPLOAD_MB` | Set manually; default `80` | Maximum contributor-recording upload size, in MiB. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account JSON from Google Cloud | Shared Google Drive credentials, available as fallback for either driver. |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client configuration | Shared OAuth client ID; set with the corresponding secret and refresh token. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client configuration | Shared OAuth client secret. |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | OAuth consent flow | Shared OAuth refresh token. |
| `GOOGLE_DRIVE_FOLDER_ID` | ID of the shared Google Drive root folder | Shared parent folder; archive storage can fall back to this folder. |
| `GOOGLE_ARCHIVE_OAUTH_CLIENT_ID` | Optional second Google OAuth client | Archive-specific OAuth client ID. |
| `GOOGLE_ARCHIVE_OAUTH_CLIENT_SECRET` | Optional second Google OAuth client | Archive-specific OAuth client secret. |
| `GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN` | OAuth consent flow for archive account | Archive-specific refresh token. |
| `GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON` | Optional second service-account JSON | Archive-specific service-account credentials. |
| `GOOGLE_ARCHIVE_DRIVE_FOLDER_ID` | Optional archive folder ID | Archive-specific parent folder; falls back to `GOOGLE_DRIVE_FOLDER_ID`. |

For each OAuth account, provide **all three** values (client ID, client secret,
refresh token). The archive driver prefers complete archive-specific OAuth
credentials; otherwise it can use archive-specific service-account JSON, then the
shared credentials.

### Application controls

| Variable | Where to get it | Purpose |
| --- | --- | --- |
| `RATE_LIMIT_ENABLED` | `true` or `false`; default `true` | Enables API and upload rate limits. Keep enabled outside local debugging. |
| `SUBMISSION_COOLDOWN_MS` | Set manually; default `30000` | Minimum delay between submissions for the same user and reference video. |
| `WEB3FORMS_ACCESS_KEY` | Create an access key at Web3Forms | Required in production for contact-message delivery. |
| `CONTACT_DAILY_LIMIT` | Set manually; default `25` | Maximum successfully delivered messages per UTC day. |
| `CONTACT_USER_DAILY_LIMIT` | Set manually; default `1` | Maximum contact messages per account per UTC day. |
| `CONTACT_ABUSE_BLOCK_MINUTES` | Set manually; default `10`, range `1`–`1440` | Temporary device/IP restriction for anonymous, mismatched-email, or over-limit contact attempts. |

In production, `BREVO_API_KEY`, a valid `BREVO_SENDER_EMAIL`, and
`WEB3FORMS_ACCESS_KEY` are required. The OTP, contact, and upload values above
have validated ranges; see `.env.example` for the development template.

## 6. Google Drive append-only archives

Google Drive is optional for base videos and submission archives. When
`ARCHIVE_STORAGE_DRIVER=gdrive`, contributor recordings are created under this
structure:

```text
{GOOGLE_DRIVE_FOLDER_ID}/
  commons/
    {userId}_{sequence}/
      {category_slug}/
        {video_slug}/
          {video_slug}.webm
```

A repeated submission receives the next sequence number instead of replacing an existing file. The API writes the file and stores its pointer and metadata in MongoDB. It does not expose a read, update, or delete route for archived recordings.

### Configure Google credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/), create or select
   a project, and enable **Google Drive API**.
2. Choose either a service account or OAuth credentials for each configured
   driver. Service-account JSON can be stored in a secret manager as one
   environment value. OAuth requires a client ID, client secret, and refresh
   token generated through the Google OAuth consent flow.
3. Create a folder in Google Drive and copy its ID from the folder URL:

```text
https://drive.google.com/drive/folders/FOLDER_ID
```

4. For service-account credentials, share the folder with the service account
   email (usually `name@project.iam.gserviceaccount.com`) and grant permission to
   create files and folders.
5. Set the selected storage driver to `gdrive`, the corresponding folder ID, and
   its credentials. For shared service-account credentials:

```env
ARCHIVE_STORAGE_DRIVER=gdrive
GOOGLE_ARCHIVE_DRIVE_FOLDER_ID=FOLDER_ID
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

When using the archive-specific service-account JSON, set
`GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON` instead of the shared
`GOOGLE_SERVICE_ACCOUNT_JSON`. For a separate OAuth account, use the
`GOOGLE_ARCHIVE_OAUTH_*` variables. Keep all credentials in a host secret manager
or local `.env`; never put them in `public/`, source control, or frontend
environment variables.

`STORAGE_DRIVER=gdrive` stores reference and demo videos, which must remain
readable by their intended users. `ARCHIVE_STORAGE_DRIVER=gdrive` controls
contributor recording archives independently. Archive-specific OAuth credentials
and folder IDs allow archives to use a separate Google account.

## 7. Start the backend

Development mode restarts when source files change:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

For a standalone Node process, `server.js` binds the HTTP listener and starts
service initialization. Requests await the same shared initialization promise
before routing. On Vercel, `server.js` exports an Express-compatible handler and
the first request performs initialization. Initialization does the following:

1. Validate environment variables while loading the app.
2. Connect to MongoDB if it is not already connected.
3. Initialize selected storage drivers.
4. Create or promote the configured admin account.

Check the service:

- API root: `http://localhost:5000/`
- Health: `http://localhost:5000/api/v1/health`
- Swagger UI: `http://localhost:5000/docs`
- OpenAPI JSON: `http://localhost:5000/docs.json`

## 8. Run tests

The backend test suite uses Node's built-in test runner and starts `mongodb-memory-server` when `MONGODB_URI_TEST` is not provided:

```bash
npm test
```

To use a disposable MongoDB database instead, set `MONGODB_URI_TEST` before running tests. The test suite drops that database, so never point it at production data.

The GitHub Actions workflow at `.github/workflows/backend-tests.yml` runs `npm ci` and `npm test` on pushes to `main` or `master` and on pull requests.

## 9. Frontend connection

The frontend uses the API base configured by `VITE_API_ORIGIN`. For local development, the Vite proxy can forward `/api` to the backend. Make sure:

```env
CLIENT_ORIGIN=http://localhost:5173
```

The browser must send credentials for the HTTP-only authentication cookie. In production, set `CLIENT_ORIGIN` to the exact deployed frontend origin and configure HTTPS cookie settings.

## 10. Production checklist

- Use MongoDB Atlas or a managed MongoDB deployment.
- Set `NODE_ENV=production`.
- Generate a unique `JWT_SECRET` and store it in the host secret manager.
- Set a strong admin password and never expose it to the frontend.
- Set the exact production frontend URL in `CLIENT_ORIGIN`.
- Use HTTPS with `COOKIE_SECURE=true`.
- Keep `COOKIE_SAMESITE=lax` when frontend and API share a site; use `none` only when required by cross-site deployment.
- Use `ARCHIVE_STORAGE_DRIVER=gdrive` with dedicated archive credentials and a restricted Drive folder for append-only recordings.
- Keep `RATE_LIMIT_ENABLED=true`.
- Confirm the upload limits match available storage and request limits.
- Never commit `.env`, Google service-account JSON, JWT secrets, or database credentials.
