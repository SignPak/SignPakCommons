# Preparing the dataset for the ML team (B5)

Contributors trim and mirror their recordings in the browser, but the file in Google Drive is
the raw recording: trim and mirror are kept only as numbers in MongoDB. This page turns the
admin export into clips with the trim and mirror applied.

It runs on a **team machine**, never on the API server: it downloads every recording and
re-encodes it with ffmpeg, which is slow and heavy.

## 1. Export the submissions

In the site, **Admin → Submissions**: filter by category, video, contributor or dates if you
want part of the data, then **Download JSON** (the script reads JSON; the CSV has the same
columns for spreadsheets).

The same file comes from the API:
`GET /api/v1/admin/submissions/export?format=json[&categoryId=…&videoId=…&userId=…&from=YYYY-MM-DD&to=YYYY-MM-DD]`.

Columns, in order:

| Column | Meaning |
| --- | --- |
| `submissionId` | The submission's id, and the clip's file name. |
| `userId` | The contributor's account id (no name or email is ever exported). |
| `videoId`, `videoTitle` | The reference video. |
| `categoryId`, `categoryLabel` | The video's **current** category (empty if it has none now). |
| `driveFileId` | The recording's storage key: the Drive file id, or a path for local storage. |
| `archivePath` | The Drive folder path, when recorded. |
| `mimeType`, `size` | The stored file's type and size in bytes. |
| `duration` | The length the browser reported, in seconds. |
| `trimStart`, `trimEnd` | The part to keep, in seconds from the start. |
| `mirrored` | `true` if the contributor recorded mirrored; the clip is flipped back. |
| `submittedAt` | When it was submitted (ISO 8601, UTC). |
| `storageDriver` | `gdrive-archive` (Drive) or `local` (the API's own disk, for development). |

## 2. Set up the machine

- **Node 22**, then in this repository's `backend/` folder:

  ```sh
  npm install
  ```

  That is all ffmpeg needs: `npm install` brings the `ffmpeg-static` devDependency, which
  downloads an ffmpeg build (with libx264) for Windows, macOS or Linux into `node_modules`.
  Nothing is installed system-wide. (The server installs with `npm ci --omit=dev`, so it never
  gets it.) Don't install with `--ignore-scripts`: that skips the download.

  The script looks for ffmpeg in this order and prints which one it uses:
  1. `FFMPEG_PATH`, if set: only an override, for a particular ffmpeg build;
  2. the `ffmpeg-static` binary;
  3. `ffmpeg` on `PATH`.
- **Google credentials** for the archive Drive. Only these are needed, in the environment or in
  a `.env` in the folder you run from, not the server's whole configuration:
  - `GOOGLE_ARCHIVE_OAUTH_CLIENT_ID`, `GOOGLE_ARCHIVE_OAUTH_CLIENT_SECRET`,
    `GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN`. When these are absent, it falls back to
    `GOOGLE_OAUTH_*`, as the server does.
  - or `GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SERVICE_ACCOUNT_JSON`.

  Keep this `.env` out of the repository; it grants access to every recording.

## 3. Run it

```sh
cd backend
node scripts/prepare-dataset.js --input ~/Downloads/signpak-submissions-2026-11-22.json --out ~/signpak-dataset
```

Options:

| Option | Default | |
| --- | --- | --- |
| `--input` | (required) | The JSON export. |
| `--out` | (required) | The dataset folder. Clips go to `<out>/<category>/<video>/<submissionId>.mp4`. |
| `--concurrency` | `2` | How many recordings to process at once. |
| `--overwrite` | off | Make clips again even if they exist. By default existing clips are skipped, so a stopped run can simply be started again. |
| `--local-root` | — | For `storageDriver: local` rows: the API's `UPLOAD_DIR`. |

It first prints which ffmpeg it uses (`Using ffmpeg from ffmpeg-static: …`). At the end it
prints how many clips were made, skipped and failed, with the reason for each failure, and exits
with 1 if any failed. If no ffmpeg can be started, every row fails with "ffmpeg was not found.
Run `npm install` in backend …".


## What each clip is

For each row the script runs:

```
ffmpeg -ss <trimStart> -i <recording> -t <trimEnd − trimStart> [-vf hflip] -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart <out>.mp4
```

- **Trim:** it seeks to `trimStart` and keeps `trimEnd − trimStart` seconds. The length is
  computed, so a WebM without duration information is cut correctly.
- **Mirror:** a mirrored recording is flipped horizontally (`hflip`), so every clip shows the
  signer as the camera saw them.
- **No audio** (`-an`): sign data needs none, and the dataset holds no voices.
- **H.264 MP4, yuv420p:** plays everywhere and loads in common ML tooling.
- Folder names come from the category and video names with characters that aren't allowed in
  file names replaced, and are never `.` or `..`.

`buildFfmpegArgs`, `outputPathFor`, `findFfmpeg` and the run loop are covered by
`tests/unit/prepareDataset.test.js` without ffmpeg or Drive. `tests/integration/prepare-dataset.test.js`
runs the script for real: ffmpeg makes a 5 s test recording, and the test checks the clips'
folders, lengths and mirroring. It is skipped only when no ffmpeg can be found, and never on CI.
