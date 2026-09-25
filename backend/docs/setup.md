# Backend Setup

This guide explains how to install, configure, run, test, and deploy the SignPak Commons backend.

## 1. Prerequisites

Install:

- Node.js 20 or newer
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
| `TRUST_PROXY` | Set `true` behind Render, Railway, nginx, or another reverse proxy | Makes rate limiting use the original client IP. |
| `CLIENT_ORIGIN` | Frontend URL, for example `http://localhost:5173` | CORS allowlist and state-changing request origin check. Separate multiple origins with commas. |

### Authentication and cookies

| Variable | Where to get it | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Generate locally with the command below, or use a secret manager | Signs authentication tokens. Use a unique value of at least 32 characters. |
| `JWT_EXPIRES_DAYS` | Set manually; default `7` | Token lifetime in days. |
| `COOKIE_SECURE` | Usually leave unset; production defaults to `true` | Sends cookies only over HTTPS when true. Use false only for local HTTP development. |
| `COOKIE_SAMESITE` | Usually `lax`; use `none` only for cross-site HTTPS deployment | Controls cross-site cookie behavior. `none` requires `COOKIE_SECURE=true`. |
| `BCRYPT_ROUNDS` | Set manually from `4` to `15`; default `12` | Password hashing cost. Increase only when deployment CPU allows it. |

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
| `UPLOAD_DIR` | Local filesystem path; default `uploads` | Temporary uploads and local storage root. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Download from Google Cloud, described below | Service-account credentials used when either storage driver is `gdrive`. |
| `GOOGLE_DRIVE_FOLDER_ID` | The ID of the shared Google Drive root folder | Parent folder for application-created Drive folders. |
| `MAX_VIDEO_UPLOAD_MB` | Set manually; default `300` | Maximum base-video upload size. |
| `MAX_RECORDING_UPLOAD_MB` | Set manually; default `100` | Maximum contributor-recording upload size. |

### Application controls

| Variable | Where to get it | Purpose |
| --- | --- | --- |
| `RATE_LIMIT_ENABLED` | `true` or `false`; default `true` | Enables API and upload rate limits. Keep enabled outside local debugging. |
| `SUBMISSION_COOLDOWN_MS` | Set manually; default `30000` | Minimum delay between submissions for the same user and reference video. |

## 6. Google Drive append-only archives

Google Drive is optional for base videos and submission archives. When `ARCHIVE_STORAGE_DRIVER=gdrive`, contributor recordings are created under this structure:

```text
{GOOGLE_DRIVE_FOLDER_ID}/
  commons/
    {userId}_{sequence}/
      {category_slug}/
        {video_slug}/
          {video_slug}.webm
```

A repeated submission receives the next sequence number instead of replacing an existing file. The API writes the file and stores its pointer and metadata in MongoDB. It does not expose a read, update, or delete route for archived recordings.

### Create Google credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Open **APIs & Services > Library** and enable **Google Drive API**.
4. Open **IAM & Admin > Service Accounts**.
5. Create a service account for the backend.
6. Create a JSON key under **Keys > Add key > Create new key > JSON**.
7. Store the downloaded JSON in a secret manager. Do not commit the JSON file.
8. Create a folder in Google Drive and copy its ID from the folder URL:

```text
https://drive.google.com/drive/folders/FOLDER_ID
```

9. Share that folder with the service account email, usually shaped like `name@project.iam.gserviceaccount.com`.
10. Give the service account permission to create files and folders.
11. Put the complete JSON document into the deployment environment as one value:

```env
ARCHIVE_STORAGE_DRIVER=gdrive
GOOGLE_DRIVE_FOLDER_ID=FOLDER_ID
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

For hosting platforms that provide a secret editor, paste the JSON there. For local development, keep it in `.env` only. Do not put the JSON in `public/`, source control, or a frontend environment variable.

`STORAGE_DRIVER=gdrive` can also be used for base videos, but base videos need to remain readable by the public demo or authenticated library. Use `ARCHIVE_STORAGE_DRIVER=gdrive` when the intended behavior is write-only contributor archives.

## 7. Start the backend

Development mode restarts when source files change:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

The startup sequence is:

1. Validate environment variables.
2. Connect to MongoDB.
3. Initialize the selected storage drivers.
4. Create or promote the configured admin account.
5. Start listening on `PORT`.

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
- Use `ARCHIVE_STORAGE_DRIVER=gdrive` with a restricted service account for append-only recordings.
- Keep `RATE_LIMIT_ENABLED=true`.
- Confirm the upload limits match available storage and request limits.
- Never commit `.env`, Google service-account JSON, JWT secrets, or database credentials.
