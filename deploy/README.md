# Deploying the SignPak Commons API

The API runs on the team's **Hostinger KVM-8** (Ubuntu) as a **Coolify** application built
from this repository (`backend/Dockerfile`). Coolify's **Traefik** proxy is the only way in from
the internet and gets the HTTPS certificate from **Let's Encrypt**. The website stays on
**Vercel** and the database on **MongoDB Atlas** (decision D1, as changed in Phase 11).

| | Address | Runs on |
| --- | --- | --- |
| Website | `https://commons.signpak.tech` | Vercel |
| API | `https://api.commons.signpak.tech` | the KVM-8: Traefik → the API container on port 5000 |

Both are hosts of one site, `signpak.tech`, which is what lets the login cookie work in Safari,
iOS, Brave and private windows with `SameSite=Lax` (decision D2, checklist C4). The API is
deliberately **not** `api.signpak.tech`: that name is kept for the future SignPAK app backend.

Replace `<SERVER_IP>` below with the server's public IPv4 address.

The second half of this guide, **[Alternative: a bare server with Nginx + PM2](#alternative-a-bare-server-with-nginx--pm2)**,
keeps the earlier setup for a server without Coolify (for example the university GPU server).

**Files**

| File | What it is |
| --- | --- |
| `backend/Dockerfile`, `backend/.dockerignore` | The API image Coolify builds (Node 22, production dependencies only, runs as `node`, health check) |
| `scripts/check-docker-image.sh` | CI (and local): checks a built image: non-root, contents, bcrypt, health, graceful stop |
| `nginx/api.conf` | Bare server only: the Nginx site for `api.commons.signpak.tech` |
| `ecosystem.config.cjs` | Bare server only: the PM2 process definition (one process, fork mode) |
| `deploy.sh` | Bare server only: pull, install, reload and health-check, in one command |
| `scripts/check-nginx.sh` | CI only: runs `nginx -t` on `nginx/api.conf` in Docker |

---

## 0. Before you start

You need:

- access to the DNS settings of `signpak.tech` at the registrar;
- Coolify installed on the KVM-8 and connected to the `SignPak/SignPakCommons` GitHub
  repository (a GitHub App source), with ports **80 and 443 reachable from the internet**;
- admin access to the GitHub repository (for two Actions secrets);
- the MongoDB Atlas connection string, the Brevo and Web3Forms keys, the Google OAuth client
  and refresh token, and a strong admin password.

## 1. DNS and email authentication

All of these are records in the DNS settings of `signpak.tech` at the registrar. Registrars
want the **host** part only, without `.signpak.tech`.

| What | Type | Host | Value |
| --- | --- | --- | --- |
| The API | `A` | `api.commons` | `<SERVER_IP>` |
| The API over IPv6 (only if the server has a public IPv6) | `AAAA` | `api.commons` | the server's IPv6 |
| The website | `CNAME` | `commons` | what Vercel shows (usually `cname.vercel-dns.com`) |
| Email sender | as Brevo shows | as Brevo shows | as Brevo shows |

1. **The API:** add the `A` record above.
2. **The website:** in Vercel, **Project → Settings → Domains → Add** `commons.signpak.tech`.
   Vercel shows a `CNAME` record; add it with host `commons`, exactly as shown.
3. **Brevo domain authentication.** Verification and password-reset codes are sent as
   `no-reply@signpak.tech` (`BREVO_SENDER_EMAIL`). Brevo only delivers reliably for an
   authenticated domain: in Brevo, **Senders, Domains & Dedicated IPs → Domains → Add a domain →**
   `signpak.tech`. Brevo then lists a few DNS records (a Brevo code `TXT` record, DKIM, and
   DMARC/SPF). Add each one at the registrar exactly as shown, then click **Authenticate** in
   Brevo. Until Brevo shows the domain as authenticated, codes may be rejected or land in spam.

Check before continuing (DNS can take a few minutes to an hour):

```sh
dig +short api.commons.signpak.tech      # must print <SERVER_IP>
dig +short commons.signpak.tech          # must point at Vercel
```

## 2. The API on Coolify (the main path)

### 2.1 Traefik: allow slow uploads (once per server)

Since Traefik v2.11.2 every entry point has a **60-second `readTimeout`**: a request whose body
takes longer than that to arrive is cut off, so most 100 MB recordings would fail. The API
allows 15 minutes (`REQUEST_TIMEOUT_MS=900000`); give Traefik the same.

Coolify → **Servers** → the server → **Proxy** → **Configuration**. In the Traefik service's
`command:` list, add these two lines next to the existing `--entrypoints.http.address=:80` and
`--entrypoints.https.address=:443`:

```yaml
      - '--entrypoints.http.transport.respondingTimeouts.readTimeout=900s'
      - '--entrypoints.https.transport.respondingTimeouts.readTimeout=900s'
```

Then **Save** and **Restart Proxy**. This applies to **every** application on this server, not
just the API. Change it here, in Coolify; Coolify rewrites the proxy's files on disk from this
configuration.

Traefik sets no request-body limit, so an upload over the API's 100 MB limit reaches the API,
which answers `413` with its own message.

### 2.2 Create the application

**Projects** → the project → **+ New** → **Private Repository (with GitHub App)** → the
`SignPak/SignPakCommons` repository:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Build Pack | **Dockerfile** |
| Base Directory | `/backend` (the build context) |
| Dockerfile Location | `/Dockerfile` (relative to the Base Directory) |

### 2.3 General and network settings

| Setting | Value | Why |
| --- | --- | --- |
| Domains | `https://api.commons.signpak.tech` | Traefik routes this name to the container and gets its Let's Encrypt certificate |
| Ports Exposes | `5000` | the port the API listens on inside the container |
| **Ports Mappings** | **empty** | publishes nothing on the host, so Traefik is the only way in (see `HOST` below). A host port would also turn off rolling updates |
| Replicas / instances | **one** | the rate limits are counted in the process's memory; a second copy would double every visitor's allowance |
| Advanced → Resource Limits → maximum memory | `1g` (1 GB) | uploads stream to disk, so normal use stays far below this |
| Container naming | the default | a fixed or custom container name turns off rolling updates |

### 2.4 Health check and shutdown

- **Healthcheck:** leave Coolify's own Healthcheck **off**. The image has a `HEALTHCHECK` on
  `GET /api/v1/health/live` (run with `node`, because the slim image has no `curl` or `wget`,
  which Coolify's HTTP check would need), and Coolify uses the image's check when its own is
  off. A new container counts as healthy once it is connected to MongoDB; until then the old one
  keeps serving. In a deployment's log look for **New container is healthy** and **Rolling
  update completed**. The `--start-interval` option in that check needs Docker Engine 25 or
  newer: check with `docker version` on the server.
- **Two health endpoints, on purpose:**

  | Endpoint | 200 when | Used by |
  | --- | --- | --- |
  | `/api/v1/health/live` | MongoDB is connected (storage is reported but never fails it) | the container's health check: Traefik routes only to a healthy container |
  | `/api/v1/health` | MongoDB is connected **and** storage started | people after a deploy (2.8), and `deploy.sh` on a bare server |

  Traefik stops routing to an unhealthy container, so if the container check also required
  storage, an expired Google Drive token would take the whole API offline: login and browsing
  too, answering "no available server". With `/health/live`, a storage problem means uploads
  fail but the site stays up, and `/api/v1/health` shows it.
- **Advanced → Operations → Stop Grace Period:** leave it **empty** (Coolify then waits 30 s),
  or set at least `15`. On SIGTERM the API stops taking new requests and lets running ones
  finish for up to 10 s before it closes MongoDB and exits (`src/utils/gracefulShutdown.js`).
  An upload still running after those 10 s is cut off by a redeploy and has to be sent again.
  If you ever run the image by hand, use `docker run --stop-timeout 30` (plain `docker stop`
  waits only 10 s).

### 2.5 Environment variables

**Environment Variables** → **Developer view**, paste every variable from
`backend/.env.production.example`, fill in the empty ones, and change two values:

```env
HOST=0.0.0.0
TRUST_PROXY=true
```

- **`HOST=0.0.0.0`**: inside the container, `127.0.0.1` is the container's own loopback, and
  Traefik could not reach the API (the server logs a warning at startup if `HOST` is loopback in
  a container). Listening on all interfaces is safe **only because Ports Mappings is empty**:
  nothing is published on the server's public address, so Traefik is the only way in from the
  internet. Other containers on Coolify's Docker network can still reach port 5000, so don't run
  untrusted applications on this server.
- **`TRUST_PROXY=true`**: exactly one proxy, Traefik, stands in front of the API, and the API
  trusts exactly one hop of `X-Forwarded-For`. Don't put Cloudflare's proxy (the orange cloud) in
  front of `api.commons.signpak.tech`: that would be a second hop, and the logs, rate limits and IP
  restrictions would see Cloudflare's addresses.
- Mark the secrets (`MONGODB_URI`, `JWT_SECRET`, `EMAIL_HASH_SECRET`, `ADMIN_PASSWORD`,
  `BREVO_API_KEY`, `WEB3FORMS_ACCESS_KEY`, the Google OAuth values) as secret in Coolify. The
  image never contains a `.env` file (`backend/.dockerignore`).
- `UPLOAD_DIR=uploads` is the only place the container writes: temporary files on their way to
  Google Drive. Production stores everything in Drive, so no persistent volume is needed.
- Every variable is explained in `backend/docs/setup.md`.

### 2.6 Deploys come from CI, not from Coolify

1. **Advanced → Deployment → Auto deploy:** choose **Manual deployments only**. A push to
   `main` must not deploy before CI has passed.
2. **Settings → Advanced → API Access:** turn it on (needed for the deploy webhook).
3. **Keys & Tokens → API Tokens:** create a token with only the **`deploy`** permission (clear
   `read`, which is ticked by default). Copy it.
4. The application → **Webhooks** → copy **Deploy Webhook (auth required)**. It looks like
   `https://<coolify>/api/v1/deploy?uuid=<application-uuid>&force=false`.
5. GitHub → the repository → **Settings → Secrets and variables → Actions** → add
   `COOLIFY_WEBHOOK` (the URL) and `COOLIFY_TOKEN` (the token).

On every push to `main`, the **Deploy (Coolify)** job in `.github/workflows/ci.yml` waits for
every other job to pass, then calls the webhook:

```sh
curl --fail -X POST -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_WEBHOOK"
```

Coolify only deploys on `POST`; a `GET` answers `405`. The call only queues the deploy: its
progress and result are in Coolify under the application's **Deployments**. Until both secrets
exist, the job passes with a "Deploy skipped" notice. To deploy by hand, use **Deploy** in
Coolify.

### 2.7 MongoDB Atlas: allow the server

Atlas → **Network Access → Add IP Address** → `<SERVER_IP>`. Keep the existing database; the
connection string goes in `MONGODB_URI`.

### 2.8 First deploy and checks

Press **Deploy** once (or push to `main` after the secrets are set). Then:

```sh
curl -s https://api.commons.signpak.tech/api/v1/health
```

It must show `"status":"ok"`, `"database":"connected"` and `"storage":true`, over HTTPS with a
valid certificate. A 503 with `"status":"degraded"` says which part is down; the logs say why.

**Check `"storage":true` after every deploy.** The container's own check
(`/api/v1/health/live`) passes without storage, so a deploy can succeed while storage is down.
If `/api/v1/health` shows `"storage":false`, the Google Drive token is the usual cause (section
4): uploads fail, but the site stays up (login, browsing, the admin pages). The API retries
storage every 30 s while the health checks run, so a passing Google outage clears by itself; an
expired or revoked token needs a new token and a restart.

**Logs:** the application → **Logs**. The API writes one JSON line per event to stdout (pino).
Each request line's `clientIp` must show real visitor addresses, not a Docker address such as
`10.0.x.x` or `172.x.x.x`. If every request shows the same private address, `TRUST_PROXY` is not
`true`; the API also logs a warning about it at startup. The startup line `API server listening`
shows `"host":"0.0.0.0"` and `"requestTimeoutMs":900000`.

Docker keeps container logs on the server's disk. Coolify's installer normally sets log rotation
in `/etc/docker/daemon.json` (`"log-opts": {"max-size": ...}`); check it is there.

## 3. The website on Vercel

**Project → Settings → Environment Variables (Production):**

| Variable | Value | Why |
| --- | --- | --- |
| `VITE_API_ORIGIN` | `https://api.commons.signpak.tech` | where the site sends API requests |
| `SITE_URL` | `https://commons.signpak.tech` | sitemap, robots.txt and canonical links |

Redeploy the site after setting them (environment variables are read at build time).

**Once the API is live at `https://api.commons.signpak.tech`, retire the old address.** In
Vercel, **Project → Settings → Domains**, edit `commonssignpak.vercel.app` and set it to
**redirect to `commons.signpak.tech`** (permanent, 308). Do it only after the health check in
section 2.8 passes: until then the old address is the only working copy of the site, and after
it, anyone still using an old link lands on the address whose login cookie works everywhere.

## 4. Google Drive sign-in (decision D3)

The API stores videos and recordings in Google Drive through an OAuth refresh token. In Google
Cloud Console → **APIs & Services → OAuth consent screen**, the app must be **In production**.
In "Testing" mode refresh tokens expire after **7 days** and every upload starts failing. After
switching to production, create a new refresh token and put it in `GOOGLE_OAUTH_REFRESH_TOKEN`.

If the token stops working, the API's logs (Coolify → the application → **Logs**; on a bare
server `pm2 logs signpakcommons-api`) show this line, naming the driver and
the variable to replace, and `/api/v1/health` reports `"storage":false` (the container stays
healthy and the rest of the site keeps working; only uploads and playback from Drive fail):

```text
Google Drive refresh token expired or revoked; make sure the OAuth app is In production and create a new token
```

## 5. What to send back to the developers

Once the API is deployed, send:

1. the server's public IP;
2. confirmation that the Traefik `readTimeout` lines are in and the proxy was restarted;
3. confirmation that `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN` are set, and the link to the first
   **Deploy (Coolify)** run on `main`;
4. confirmation that `signpak.tech` shows as authenticated in Brevo.

Then the checks that need the real server can be run and ticked: health over HTTPS with a valid
certificate; sign-up/login/logout in Chrome, Firefox, Safari (macOS and iOS) and a private
window; a ~90 MB recording upload (on a slow connection too); real visitor IPs in the logs.

---

# Alternative: a bare server with Nginx + PM2

The setup before Phase 11, kept for a server without Coolify (for example the university GPU
server): Node 22 runs from the checked-out repository under **PM2** (one process, fork mode),
behind **Nginx** with a certificate from **certbot**, listening on `127.0.0.1:5000` only. Do
sections 0 and 1 above (without the Coolify parts), then the sections below instead of section 2.
Sections 3 and 4 apply as they are; read "`pm2 logs signpakcommons-api`" for "the API's logs".

`REQUEST_TIMEOUT_MS` (15 minutes) applies here too. Nginx streams the upload to Node as it
arrives (`proxy_request_buffering off`), so only Node's limit decides how long a slow upload may
take.

## B1. A non-root user

Log in as root once, create a deploy user, and use it for everything after this step.

```sh
adduser signpak
usermod -aG sudo signpak
# copy your SSH key so you can log in as signpak:
rsync --archive --chown=signpak:signpak ~/.ssh /home/signpak
```

Log out, then `ssh signpak@<SERVER_IP>`.

## B2. Firewall: only SSH, HTTP and HTTPS

```sh
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status            # 22, 80, 443 only. Port 5000 must NOT be listed.
```

Node listens on port 5000 on **127.0.0.1 only** (`HOST`, the production default), so even with
the port open nobody outside the machine could reach it. Keep it closed anyway: the two layers
together are what stop anyone bypassing Nginx and forging `X-Forwarded-For`.

## B3. Install Node 22, Nginx, PM2 and certbot

```sh
# Node 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node --version             # v22.x

sudo apt-get install -y nginx certbot
sudo npm install -g pm2
```

## B4. Get the code and create `backend/.env`

```sh
sudo mkdir -p /srv/signpakcommons /var/log/signpakcommons
sudo chown signpak:signpak /srv/signpakcommons /var/log/signpakcommons
git clone https://github.com/SignPak/SignPakCommons.git /srv/signpakcommons
cd /srv/signpakcommons/backend
npm ci --omit=dev

cp .env.production.example .env
chmod 600 .env             # only the signpak user can read the secrets
nano .env                  # fill in every empty value
```

`backend/.env.production.example` already has the production settings: `NODE_ENV=production`,
`HOST=127.0.0.1`, `TRUST_PROXY=true`, `CLIENT_ORIGIN=https://commons.signpak.tech`,
`COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `BREVO_SENDER_EMAIL=no-reply@signpak.tech`, Google
Drive storage, and 10-minute email codes. Every variable is explained in
`backend/docs/setup.md`.

## B5. MongoDB Atlas: allow this server

Atlas → **Network Access → Add IP Address** → `<SERVER_IP>`. Keep the existing database; the
connection string goes in `MONGODB_URI`.

## B6. HTTPS certificate

Nginx needs the certificate before it can load the HTTPS part of `api.conf`, so get it first,
with a temporary HTTP-only site serving the challenge:

```sh
sudo mkdir -p /var/www/certbot
sudo tee /etc/nginx/sites-available/certbot-bootstrap.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name api.commons.signpak.tech;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
}
EOF
sudo ln -sf /etc/nginx/sites-available/certbot-bootstrap.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/certbot -d api.commons.signpak.tech \
  --email <TEAM_EMAIL> --agree-tos --no-eff-email
```

Certbot installs a timer that renews the certificate automatically. Make renewals reload Nginx:

```sh
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
```

## B7. Install the real Nginx site

```sh
sudo rm /etc/nginx/sites-enabled/certbot-bootstrap.conf
sudo cp /srv/signpakcommons/deploy/nginx/api.conf /etc/nginx/sites-available/signpakcommons-api.conf
sudo ln -s /etc/nginx/sites-available/signpakcommons-api.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

What the site does (all of it is commented in the file): redirects HTTP to HTTPS; accepts
uploads up to 110 MB (the API's own limit is 100 MB) and streams them to Node unbuffered; allows
5 minutes for slow uploads; passes the visitor's IP and the original scheme to Node; never
caches API responses.

## B8. Start the API under PM2, and keep it running across reboots

```sh
cd /srv/signpakcommons
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup                # prints one sudo command: run it
pm2 install pm2-logrotate  # rotate /var/log/signpakcommons/*.log
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
```

PM2 runs **one** process in fork mode on purpose: the API's rate limits are counted in memory,
so a second process would double every visitor's allowance.

## B9. Check it

```sh
curl -s http://127.0.0.1:5000/api/v1/health               # on the server
curl -s https://api.commons.signpak.tech/api/v1/health     # from anywhere
```

Both must show `"status":"ok"`, `"database":"connected"` and `"storage":true`. A 503 with
`"status":"degraded"` says which part is down; `pm2 logs signpakcommons-api` says why.

`pm2 logs` must show real visitor addresses in each request line's `clientIp` field, not
`127.0.0.1`. If they are all `127.0.0.1`, `TRUST_PROXY` is not `true`; the API also logs a
warning about it at startup.

## B10. Server-specific notes

**Hostinger VPS.** Has a public IP. Also open 80 and 443 in Hostinger's own firewall panel if
it has one enabled, in addition to `ufw`.

**University GPU server.** It needs a **public IP with ports 80 and 443 reachable from the
internet**, or university IT has to forward those two ports to it. Ask IT for exactly that:
"inbound TCP 80 and 443 to this machine, for a public HTTPS API".

If neither is possible, use **Cloudflare Tunnel** instead of opening ports:

1. Move the DNS of `signpak.tech` to Cloudflare (free plan), recreating the website and Brevo
   records from section 1 there.
2. Install `cloudflared` on the server, run `cloudflared tunnel login`, create a tunnel, and
   route `api.commons.signpak.tech` to `http://127.0.0.1:5000`. Nginx and certbot are then not needed for
   the API; Cloudflare terminates HTTPS.
3. Cloudflare's free plan caps request bodies at **100 MB**, so set
   `MAX_RECORDING_UPLOAD_MB=95` in `backend/.env` (FIX-PLAN section 0).
4. Keep `TRUST_PROXY=true`: cloudflared is the one proxy hop in front of Node.

## B11. Every later deploy

```sh
cd /srv/signpakcommons && ./deploy/deploy.sh
```

It pulls `main`, installs the backend's production dependencies, reloads PM2 (the old process
finishes its in-flight requests first), and waits up to 30 seconds for the health check to say
`ok`. If it doesn't, the script exits with an error and tells you where to look.

---
