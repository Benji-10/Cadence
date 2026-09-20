# Cadence — Deployment Guide

## Netlify + Neon + Identity

### 1. Neon Database
1. Create a Neon project at [neon.tech](https://neon.tech)
2. Copy the **Pooled connection string** (the host contains `-pooler`)
3. Format: `postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&pgbouncer=true&connect_timeout=15`

### 2. Push to GitHub
1. Download this project
2. `git init && git add -A && git commit -m "Cadence calendar"`
3. Push to a GitHub repo (public or private)

### 3. Netlify
1. Go to [netlify.com](https://netlify.com) → "Add new site" → "Import from Git"
2. Select your GitHub repo
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `next build`
   - Publish directory: `.next`
4. **Environment variables** (Site settings → Environment variables):
   - `DATABASE_URL` = your Neon pooled connection string
5. Deploy!

### 4. Push Schema to Neon
After the first deploy, run from your local machine:
```bash
# Set DATABASE_URL to your Neon connection string
export DATABASE_URL="postgresql://user:pass@ep-xxx-pooler..."
npx prisma db push
```
This creates the tables on Neon.

### 5. Netlify Identity (optional auth)
1. Netlify dashboard → Integrations → Identity → Enable
2. Registration preferences: Open or Invite only
3. The Identity widget is already loaded in `src/app/layout.tsx`
4. Enable GitHub/Google providers if desired

### 6. PWA Installation
- Visit the deployed site on your iPhone
- Safari → Share → "Add to Home Screen"
- The app installs as a standalone PWA
- Notifications: open Settings → "Enable notifications"

### Architecture
- **Database**: Neon PostgreSQL (serverless, pooled connection via PgBouncer)
- **ORM**: Prisma (schema in `prisma/schema.prisma`, provider = `postgresql`)
- **Framework**: Next.js 16 with App Router
- **Hosting**: Netlify (Next.js plugin handles SSR/SSG)
- **PWA**: Service worker (`public/sw.js`) with:
  - App shell caching
  - Background periodic sync (checks for alerts every 15 min)
  - Message-based alert scheduling (from the page)
  - `showNotification` via service worker (required for iOS PWA)
- **Notifications**: Three layers:
  1. Page polling (every 20s while tab is open)
  2. SW `setTimeout` scheduling (tab backgrounded but SW alive)
  3. SW `periodicSync` (PWA closed, fires every ~15 min on installed PWAs)
