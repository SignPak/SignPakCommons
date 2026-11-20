# Deploying the SignPak Commons API

The API runs on the team's own Linux server — a **Hostinger VPS** or the **university GPU
server** (decision D1, still open; this guide works for both) — behind **Nginx** with HTTPS
from **Let's Encrypt**, kept alive by **PM2**. The website stays on **Vercel**.

| | Address | Runs on |
| --- | --- | --- |
| Website | `https://commons.<DOMAIN>` | Vercel |
| API | `https://api.<DOMAIN>` | this server: Nginx → Node on `127.0.0.1:5000` |

Both are on the same site (`<DOMAIN>`), which is what lets the login cookie work in Safari, iOS,
Brave and private windows with `SameSite=Lax` (decision D2, checklist C4).

Replace `<DOMAIN>` everywhere below with the real domain (for example `signpak.org`), and
`<SERVER_IP>` with the server's public IPv4 address.

**Files in this folder**

| File | What it is |
| --- | --- |
| `nginx/api.conf` | The Nginx site for `api.<DOMAIN>` |
| `ecosystem.config.cjs` | The PM2 process definition (one process, fork mode) |
| `deploy.sh` | Pull, install, reload and health-check, in one command |
| `scripts/check-nginx.sh` | CI only: runs `nginx -t` on `nginx/api.conf` in Docker |

---

## 0. Before you start

You need:

- the domain, with access to its DNS settings at the registrar;
- the server, reachable over SSH, with a **public IP address** and ports **80 and 443 reachable
  from the internet** (see section 12 for the university server);
- Ubuntu 22.04 or 24.04 (other Debian-based systems work with the same commands);
- the MongoDB Atlas connection string, the Brevo and Web3Forms keys, the Google OAuth client
  and refresh token, and a strong admin password.

## 1. DNS

At the domain registrar:

1. Add an **`A` record**: name `api`, value `<SERVER_IP>`. (If the server also has a public IPv6
   address, add an `AAAA` record too.)
2. In Vercel: **Project → Settings → Domains → Add** `commons.<DOMAIN>`. Vercel shows a
   **CNAME** record (usually `cname.vercel-dns.com`); add it at the registrar exactly as shown.

Check before continuing (DNS can take a few minutes to an hour):

```sh
dig +short api.<DOMAIN>        # must print <SERVER_IP>
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

Node listens on port 5000, but only Nginx should talk to it. Keep 5000 closed.

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
nano .env                  # replace <DOMAIN>, fill in every empty value
```

`backend/.env.production.example` already has the production settings: `NODE_ENV=production`,
`TRUST_PROXY=true`, `CLIENT_ORIGIN=https://commons.<DOMAIN>`, `COOKIE_SECURE=true`,
`COOKIE_SAMESITE=lax`, Google Drive storage, and 10-minute email codes. Every variable is
explained in `backend/docs/setup.md`.

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
    server_name api.<DOMAIN>;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
}
EOF
sudo ln -sf /etc/nginx/sites-available/certbot-bootstrap.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/certbot -d api.<DOMAIN> \
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
sudo sed -i 's/<DOMAIN>/your-domain.org/g' /etc/nginx/sites-available/signpakcommons-api.conf
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
curl -s http://127.0.0.1:5000/api/v1/health      # on the server
curl -s https://api.<DOMAIN>/api/v1/health       # from anywhere
```

Both must show `"status":"ok"`, `"database":"connected"` and `"storage":true`. A 503 with
`"status":"degraded"` says which part is down; `pm2 logs signpakcommons-api` says why.

`pm2 logs` must show real visitor addresses, not `127.0.0.1`. If they are all `127.0.0.1`,
`TRUST_PROXY` is not `true`; the API also logs a warning about it at startup.

## 11. The website on Vercel

**Project → Settings → Environment Variables (Production):**

| Variable | Value | Why |
| --- | --- | --- |
| `VITE_API_ORIGIN` | `https://api.<DOMAIN>` | where the site sends API requests |
| `SITE_URL` | `https://commons.<DOMAIN>` | sitemap, robots.txt and canonical links |

Redeploy the site after setting them (environment variables are read at build time).

## 12. Server-specific notes

**Hostinger VPS.** Has a public IP. Also open 80 and 443 in Hostinger's own firewall panel if
it has one enabled, in addition to `ufw`.

**University GPU server.** It needs a **public IP with ports 80 and 443 reachable from the
internet**, or university IT has to forward those two ports to it. Ask IT for exactly that:
"inbound TCP 80 and 443 to this machine, for a public HTTPS API".

If neither is possible, use **Cloudflare Tunnel** instead of opening ports:

1. Move the domain's DNS to Cloudflare (free plan).
2. Install `cloudflared` on the server, run `cloudflared tunnel login`, create a tunnel, and
   route `api.<DOMAIN>` to `http://127.0.0.1:5000`. Nginx and certbot are then not needed for
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

Once the domain and server exist, send:

1. the domain (so `<DOMAIN>` can be replaced in the repo);
2. the server's public IP, and which server it is (Hostinger or university);
3. whether Cloudflare Tunnel was needed.

Then the Phase 1 checks that need the real server can be run and ticked: health over HTTPS with
a valid certificate; sign-up/login/logout in Chrome, Firefox, Safari (macOS and iOS) and a
private window; a ~90 MB recording upload; real visitor IPs in the logs.
