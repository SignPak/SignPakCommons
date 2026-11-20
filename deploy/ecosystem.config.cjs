// PM2 process definition for the SignPak Commons API (FIX-PLAN Phase 1, D1).
//
//   pm2 start deploy/ecosystem.config.cjs     # first time
//   pm2 reload deploy/ecosystem.config.cjs    # every deploy (deploy/deploy.sh does this)
//   pm2 save && pm2 startup                   # survive reboots
//
// The server reads its configuration from backend/.env (from backend/.env.production.example).
const path = require('node:path')

module.exports = {
  apps: [
    {
      name: 'signpakcommons-api',
      cwd: path.join(__dirname, '..', 'backend'),
      script: 'server.js',

      // Exactly one process. The API rate limits (express-rate-limit, src/middlewares/
      // rateLimiter.js) count in this process's memory; a second instance (cluster mode) would
      // give every visitor a separate allowance per instance. Scale out only after moving those
      // counters to a shared store.
      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      // Restart a process that is leaking rather than let it take the server down. Uploads are
      // streamed to disk, so normal use stays well under this.
      max_memory_restart: '512M',
      // Back off if it crash-loops (e.g. a bad .env), instead of restarting hundreds of times.
      exp_backoff_restart_delay: 200,

      // server.js drains connections for up to 10 s on SIGTERM (src/utils/gracefulShutdown.js);
      // give it longer than that before PM2 sends SIGKILL.
      kill_timeout: 15000,

      // Logs are rotated by pm2-logrotate (deploy/README.md).
      out_file: '/var/log/signpakcommons/api.out.log',
      error_file: '/var/log/signpakcommons/api.err.log',
      merge_logs: true,
      time: true,

      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
