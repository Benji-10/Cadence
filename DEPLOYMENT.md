# Cadence — Deployment Guide

## Netlify + Neon + VAPID Web Push

### 1. Neon Database
1. Create a Neon project at [neon.tech](https://neon.tech)
2. Copy the **Pooled connection string** (the host contains `-pooler`)
3. Format: `postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&pgbouncer=true&connect_timeout=15`

### 2. Generate VAPID Keys
```bash
npx web-push generate-vapid-keys
```
Copy the public and private key.

### 3. Push to GitHub
1. Download this project
2. `git init && git add -A && git commit -m "Cadence calendar"`
3. Push to a GitHub repo

### 4. Netlify
1. Go to [netlify.com](https://netlify.com) → "Add new site" → "Import from Git"
2. Select your GitHub repo
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `prisma db push --accept-data-loss && next build`
   - Publish directory: `.next`
4. **Environment variables** (Site settings → Environment variables):
   - `DATABASE_URL` = your Neon pooled connection string
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = your VAPID public key
   - `VAPID_PRIVATE_KEY` = your VAPID private key
5. Deploy!

### 5. Netlify Identity (optional auth)
1. Netlify dashboard → Integrations → Identity → Enable

### 6. PWA Installation
- Visit the deployed site on your iPhone
- Safari → Share → "Add to Home Screen"
- Open Settings → "Enable notifications"
- The app auto-subscribes to VAPID web push on first load

### 7. Scheduled Functions
The `netlify/functions/check-alerts.ts` function runs every 15 minutes (configured in `netlify.toml`). It:
- Queries the Neon database for events with alerts due in the next 15 minutes
- Sends web push notifications to all stored push subscriptions via VAPID
- Cleans up expired subscriptions (410/404 responses)

This is what makes notifications fire even when the PWA is completely closed.

### How Notifications Work

Four layers:
1. **Page polling** (every 20s, tab open) — immediate alerts while using the app
2. **SW periodicSync** (every ~15 min, PWA installed) — checks for due alerts via the service worker
3. **VAPID Web Push** (server → browser, PWA closed) — the Netlify Scheduled Function sends push messages to all subscribed browsers. Works on iOS Safari PWA 16.4+ even when the app is closed.
4. **SW message scheduling** (tab backgrounded) — the page sends SCHEDULE_ALERT messages to the SW for upcoming alerts

### Architecture
- **Database**: Neon PostgreSQL (serverless, pooled via PgBouncer)
- **ORM**: Prisma (provider = `postgresql`)
- **Framework**: Next.js 16 with App Router
- **Hosting**: Netlify (Next.js plugin + Scheduled Functions)
- **PWA**: Service worker + VAPID web push
- **Cron**: `netlify/functions/check-alerts.ts` runs every 15 min
