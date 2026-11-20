# Deploying the SignPak Commons API

The API runs on the team's own Linux server — a **Hostinger VPS** or the **university GPU
server** (decision D1, still open; this guide works for both) — behind **Nginx** with HTTPS
from **Let's Encrypt**, kept alive by **PM2**. The website stays on **Vercel**.

| | Address | Runs on |
| --- | --- | --- |
| Website | `https://commons.signpak.tech` | Vercel |
| API | `https://api.commons.signpak.tech` | this server: Nginx → Node on `127.0.0.1:5000` |

Both are hosts of one site, `signpak.tech`, which is what lets the login cookie work in Safari,
iOS, Brave and private windows with `SameSite=Lax` (decision D2, checklist C4). The API is
deliberately **not** `api.signpak.tech`: that name is kept for the future SignPAK app backend.

Replace `<SERVER_IP>` below with the server's public IPv4 address (the server, D1, is still
being chosen).

**Files in this folder**

| File | What it is |
| --- | --- |
| `nginx/api.conf` | The Nginx site for `api.commons.signpak.tech` |
| `ecosystem.config.cjs` | The PM2 process definition (one process, fork mode) |
| `deploy.sh` | Pull, install, reload and health-check, in one command |
| `scripts/check-nginx.sh` | CI only: runs `nginx -t` on `nginx/api.conf` in Docker |

---

## 0. Before you start

You need:

- access to the DNS settings of `signpak.tech` at the registrar;
- the server, reachable over SSH, with a **public IP address** and ports **80 and 443 reachable
  from the internet** (see section 12 for the university server);
- Ubuntu 22.04 or 24.04 (other Debian-based systems work with the same commands);
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

## 2. A non-root user

Log in as root once, create a deploy user, and use it for everything after this step.

```sh
adduser signpak
usermod -aG sudo signpak
# copy your SSH key so you can log in as signpak:
rsync --archive --chown=signpak:signpak ~/.ssh /home/signpak
```

Log out, then `ssh signpak@<SERVER_IP>`.

## 3. Firewall: only SSH, HTTP and HTTPS

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

## 4. Install Node 22, Nginx, PM2 and certbot

```sh
# Node 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node --version             # v22.x

sudo apt-get install -y nginx certbot
sudo npm install -g pm2
```

## 5. Get the code and create `backend/.env`

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

## 6. MongoDB Atlas: allow this server

Atlas → **Network Access → Add IP Address** → `<SERVER_IP>`. Keep the existing database; the
connection string goes in `MONGODB_URI`.

## 7. HTTPS certificate

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

## 8. Install the real Nginx site

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

## 9. Start the API under PM2, and keep it running across reboots

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

## 10. Check it

```sh
curl -s http://127.0.0.1:5000/api/v1/health               # on the server
curl -s https://api.commons.signpak.tech/api/v1/health     # from anywhere
```

Both must show `"status":"ok"`, `"database":"connected"` and `"storage":true`. A 503 with
`"status":"degraded"` says which part is down; `pm2 logs signpakcommons-api` says why.

`pm2 logs` must show real visitor addresses in each request line's `clientIp` field, not
`127.0.0.1`. If they are all `127.0.0.1`, `TRUST_PROXY` is not `true`; the API also logs a
warning about it at startup.

## 11. The website on Vercel

**Project → Settings → Environment Variables (Production):**

| Variable | Value | Why |
| --- | --- | --- |
| `VITE_API_ORIGIN` | `https://api.commons.signpak.tech` | where the site sends API requests |
| `SITE_URL` | `https://commons.signpak.tech` | sitemap, robots.txt and canonical links |

Redeploy the site after setting them (environment variables are read at build time).

**Once the API is live at `https://api.commons.signpak.tech`, retire the old address.** In
Vercel, **Project → Settings → Domains**, edit `commonssignpak.vercel.app` and set it to
**redirect to `commons.signpak.tech`** (permanent, 308). Do it only after the health check in
section 10 passes: until then the old address is the only working copy of the site, and after
it, anyone still using an old link lands on the address whose login cookie works everywhere.

## 12. Server-specific notes

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

## 13. Google Drive sign-in (decision D3)

The API stores videos and recordings in Google Drive through an OAuth refresh token. In Google
Cloud Console → **APIs & Services → OAuth consent screen**, the app must be **In production**.
In "Testing" mode refresh tokens expire after **7 days** and every upload starts failing. After
switching to production, create a new refresh token and put it in `GOOGLE_OAUTH_REFRESH_TOKEN`.

## 14. Every later deploy

```sh
cd /srv/signpakcommons && ./deploy/deploy.sh
```

It pulls `main`, installs the backend's production dependencies, reloads PM2 (the old process
finishes its in-flight requests first), and waits up to 30 seconds for the health check to say
`ok`. If it doesn't, the script exits with an error and tells you where to look.

---

## What to send back to the developers

Once the server exists, send:

1. the server's public IP, and which server it is (Hostinger or university);
2. whether Cloudflare Tunnel was needed;
3. confirmation that `signpak.tech` shows as authenticated in Brevo.

Then the Phase 1 checks that need the real server can be run and ticked: health over HTTPS with
a valid certificate; sign-up/login/logout in Chrome, Firefox, Safari (macOS and iOS) and a
private window; a ~90 MB recording upload; real visitor IPs in the logs.
