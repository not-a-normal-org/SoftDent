# NextDent — Deployment Guide (staging)

A container-first setup for standing up the app on a server or a PaaS. **The app image intentionally contains no patient data** — seeding real data is a separate, secured step.

## Architecture
```
        ┌──────────────┐     HTTPS      ┌───────────────────────┐
 users →│ reverse proxy│ ─────────────► │ NextDent app (Next 16 │
        │ (TLS, Caddy/ │                │ standalone, port 3000)│
        │  Nginx)      │                └──────────┬────────────┘
        └──────────────┘                           │  DATABASE_URL (sslmode=require)
                                                    ▼
                                        ┌───────────────────────┐
                                        │  PostgreSQL 16        │
                                        │  (managed or self-run)│
                                        └───────────────────────┘
        object storage (S3/R2)  ← photos & imaging (future upload feature)
```

## Prerequisites
- Docker + Docker Compose (or a container host / PaaS)
- PostgreSQL 16 with the `pg_trgm` and `unaccent` extensions available (the migrations `CREATE EXTENSION` them; the official `postgres` image ships both)
- A TLS-terminating reverse proxy in front (never expose the app on plain HTTP in production)

## Environment variables
Copy `.env.example` → `.env` and fill in:

| Var | Required | Notes |
|---|:--:|---|
| `DATABASE_URL` | ✅ | Postgres connection string; managed providers need `?sslmode=require` |
| `APP_URL` | ✅ | Public base URL, no trailing slash (used for OAuth redirect) |
| `TZ` | ✅ | `Asia/Dhaka` — the clinic's zone (UTC+6, no DST). Set in the Dockerfile and the compose `app` service; set it on any other host too |
| `POSTGRES_PASSWORD` | compose only | Password for the bundled `db` service |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables the Google Calendar connect flow (gated until set) |
| `S3_*` | optional | Reserved for patient/case photo & imaging uploads (UI is future work) |
| `BULKSMS_API_KEY` / `BULKSMS_SENDER_ID` | optional | SMS via BulkSMS BD — **deferred; rotate the leaked legacy key first** |

> No JWT/session secret is needed — sessions are opaque tokens stored server-side in Postgres.

## 1. Local staging (all-in-one)
```bash
cp .env.example .env          # set POSTGRES_PASSWORD, DATABASE_URL, APP_URL
docker compose up --build
```
This starts Postgres, runs `prisma migrate deploy` (the `migrate` service), then starts the app on **http://localhost:3000**. Health check: `GET /api/health`.

## 2. Managed Postgres (recommended for real staging/prod)
1. Provision Postgres 16 (Neon, Supabase, RDS, etc.).
2. Ensure extensions are allowed (`pg_trgm`, `unaccent`) — the migrations create them.
3. Put the connection string in `DATABASE_URL` (with `sslmode=require`).
4. Run migrations against it:
   ```bash
   DATABASE_URL="postgres://…" npx prisma migrate deploy
   ```
   (or let the compose `migrate` service do it by pointing `DATABASE_URL` at the managed DB and running only that service).

## 3. Seed data & create the first login  ⚠️ handle PHI carefully
The container has **no** patient data. From a **trusted machine** that holds the extracted CSVs (`extraction/data/*.csv`, which are git-ignored):
```bash
# loads all tables from the CSVs into the target DB
DATABASE_URL="postgres://…" npx tsx scripts/etl.ts

# create/reset the owner login
DATABASE_URL="postgres://…" OWNER_USER='nayeem' OWNER_PASSWORD='<strong>' \
  OWNER_NAME='Dr. Nazmul Alam Nayeem' npx tsx scripts/set-owner.ts
```
Never bake the CSVs into the image or commit them. For a fresh clinic with no legacy data, skip the ETL and just create the owner.

## 4. Building the image only
```bash
docker build -t nextdent-web .
docker run -p 3000:3000 --env-file .env nextdent-web
```

## 5. Google Calendar (optional)
1. Google Cloud Console → create an **OAuth 2.0 Client ID** (Web application).
2. Enable the **Google Calendar API**.
3. Add redirect URI `${APP_URL}/api/google/callback`.
4. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, redeploy. Each user then connects their own Google account under Settings → Google Calendar.

## ✅ Pre-production security checklist (real PHI)
- [ ] **TLS everywhere** (reverse proxy); HSTS on.
- [ ] **Rotate the leaked BulkSMS API key** before enabling SMS.
- [ ] Managed Postgres: encryption at rest, `sslmode=require`, least-privilege DB role.
- [ ] **Automated encrypted backups** + a tested restore.
- [ ] Strong owner password; review the **RBAC** role matrix (OWNER/DOCTOR/RECEPTIONIST/ASSISTANT).
- [ ] Secrets in the platform's secret store / vault — not in the image or git.
- [ ] Restrict DB network access to the app only.
- [ ] Confirm any **Bangladesh data-residency / medical-records** requirements.
- [ ] Log/monitor (the app writes an audit trail; add infra logs + `GET /api/health` uptime checks).
- [ ] Harden the Google OAuth `state` (swap the user-id state for a signed nonce) before enabling calendar sync in prod.

## Timezone
The clinic runs on **Asia/Dhaka** (UTC+6, no DST) while containers default to UTC. Two things keep reports honest:
- `TZ=Asia/Dhaka` is baked into the image (`ENV TZ` in the Dockerfile) and passed by the compose `app` service; set it on any other platform as well (Cloud Run: `--set-env-vars TZ=Asia/Dhaka`). It is what logs, cron and bare `new Date()` defaults use.
- The code does not trust it: dates are formatted through `CLINIC_TZ` in `src/lib/format.ts`, and the `/finance` month buckets are derived in that zone, so a UTC host produces the same numbers. Don't reintroduce `getMonth()`/`getFullYear()` for bucketing — on a UTC host an expense dated the 1st (stored at clinic midnight = 18:00Z the day before) falls into the previous month.

## Notes
- Migrations are versioned in `prisma/migrations/` — always deploy with `prisma migrate deploy` (never `migrate dev` in prod).
- The image is Debian-based (`node:20-bookworm-slim`); the Prisma client is generated for `debian-openssl-3.0.x`.
- Scaling: the app is stateless (sessions live in Postgres), so run multiple replicas behind the proxy.
