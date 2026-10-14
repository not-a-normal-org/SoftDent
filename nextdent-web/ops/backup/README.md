# Nightly database backup

Supabase's free plan takes **no backups at all**, so this is the only copy of the
clinic's data besides the live database. It dumps the application schema to a private
Cloud Storage bucket every night.

| | |
|---|---|
| Runs | 02:00 Asia/Dhaka, nightly |
| Destination | `gs://nextdent-backups-727181117105/` (project `nextdent-509613`, `asia-northeast1`) |
| Retention | 30 days, enforced by a bucket lifecycle rule |
| Size | ~800 KB gzipped |
| Job | Cloud Run Job `nextdent-backup` |
| Trigger | Cloud Scheduler `nextdent-backup-nightly` |

The bucket is private with public access prevention **enforced**, and encrypted at rest.

## Restoring

Restores need **PostgreSQL 17 or newer** — the dump is produced by `pg_dump` 17 and
uses `transaction_timeout`, which older servers reject.

The dump is self-contained: it creates the extensions and the schema itself, so a
freshly created, empty database is all that is required.

```bash
# 1. fetch the most recent backup
gcloud storage ls gs://nextdent-backups-727181117105/          # newest is last
gcloud storage cp gs://nextdent-backups-727181117105/nextdent-<STAMP>.sql.gz .

# 2. restore into an empty database
createdb nextdent_restored
gunzip -c nextdent-<STAMP>.sql.gz | psql -d nextdent_restored -v ON_ERROR_STOP=1

# 3. sanity-check it
psql -d nextdent_restored -c 'select count(*) from "Patient";'
psql -d nextdent_restored -c "select \"brandName\" from \"Drug\" where \"brandName\" % 'nappa' limit 3;"
```

No Postgres 17 to hand? Use Docker:

```bash
docker run -d --name pgrestore -e POSTGRES_PASSWORD=test postgres:17
docker exec pgrestore psql -U postgres -c 'create database nextdent_restored;'
gunzip -c nextdent-<STAMP>.sql.gz \
  | docker exec -i pgrestore psql -U postgres -d nextdent_restored -v ON_ERROR_STOP=1
```

To restore *into Supabase*, point `psql` at the **session pooler** (port 5432). The
transaction pooler (6543) cannot run a restore.

## Why the dump is built the way it is

Each of these was found by actually restoring the file, and skipping any one of them
produces a backup that looks fine but will not restore:

- **`--schema=public`** — a full dump of a Supabase database also carries Supabase's
  own schemas and extensions (`supabase_vault`, `auth`, `storage`, …). Restoring that
  onto stock Postgres aborts with `extension "supabase_vault" is not available`. The
  whole application lives in `public`.
- **Explicit `CREATE EXTENSION` lines** — `pg_dump` omits extensions when `--schema`
  is used, because extensions are database-scoped rather than schema-scoped. Without
  them, all five trigram indexes fail with
  `operator class "public.gin_trgm_ops" does not exist`. They are created `WITH SCHEMA
  public`, because the dump qualifies the operator class as `public.gin_trgm_ops`.
- **Rewriting `CREATE SCHEMA public` to `IF NOT EXISTS`** — a newly created database
  already has `public`, so the dump's unconditional form aborts the restore.
- **Session pooler, not transaction pooler** — `pg_dump` needs a stable session and a
  consistent snapshot. Supabase's direct host is IPv6-only, which Cloud Run cannot
  reach, so the session pooler is the only workable option.

The script refuses to upload a dump under 100 KB and verifies the gzip before
uploading, so a failed dump fails loudly rather than quietly replacing good backups
with an empty file.

## Operations

```bash
# run a backup right now
gcloud run jobs execute nextdent-backup --region=asia-northeast1

# recent runs
gcloud run jobs executions list --job=nextdent-backup --region=asia-northeast1

# logs from the last run
gcloud logging read \
  'resource.type=cloud_run_job AND resource.labels.job_name=nextdent-backup' \
  --limit=50 --project=nextdent-509613

# change the schedule
gcloud scheduler jobs update http nextdent-backup-nightly \
  --location=asia-northeast1 --schedule="0 3 * * *" --time-zone="Asia/Dhaka"
```

After changing `backup.sh`, rebuild and point the job at the new image:

```bash
cd ops/backup
gcloud builds submit --region=asia-northeast1 \
  --tag=asia-northeast1-docker.pkg.dev/nextdent-509613/cloud-run-source-deploy/nextdent-backup:v4 .
gcloud run jobs update nextdent-backup --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/nextdent-509613/cloud-run-source-deploy/nextdent-backup:v4
```

## Known gaps

- **Single location.** Backups sit in the same Google account as the database's
  billing. An offsite copy (OneDrive) is the intended second tier.
- **Not monitored.** A failed run marks the execution failed, but nobody is told.
  Worth adding a log-based alert to email on failure.
- **Never restored into production.** The restore has been verified into a scratch
  database, which is the right test, but a real recovery has not been rehearsed.

---

## Second copy in Google Drive (needs one manual step)

Backups currently live only in the GCS bucket, inside the same Google account that
pays for the project. Mirroring them to Drive puts the data in two places.

**What this protects against:** accidental deletion, a bad lifecycle rule, project
deletion, billing suspension. Drive's own trash keeps 30 days.
**What it does not:** the Google account itself being compromised or closed — both
copies sit under one login. A genuinely independent copy needs a second provider or a
periodic download to a clinic machine.

### Why it needs you

A service account cannot usefully write into a personal My Drive: files it creates are
owned by the service account, which has no storage quota outside a Workspace Shared
Drive, so the upload fails or the file never appears. The job has to act as *you*,
which means a one-time OAuth consent in a browser. That is the only step I cannot do.

### Setup

```bash
# 1. on your Mac — opens a browser for Google consent
brew install rclone
rclone config          # n) new remote → name: drive → storage: drive → scope: 1 (full)
                       # leave client_id/secret blank → y) auto config → opens browser

# 2. check it works
rclone mkdir drive:NextDent-Backups
rclone lsd drive:

# 3. put the token in Secret Manager
rclone config file     # prints the path, usually ~/.config/rclone/rclone.conf
gcloud secrets create nextdent-rclone-config --data-file="$(rclone config file | tail -1)" \
  --project=nextdent-509613
gcloud secrets add-iam-policy-binding nextdent-rclone-config \
  --member="serviceAccount:727181117105-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --project=nextdent-509613

# 4. create the mirror job (image v4 already contains rclone and drive-sync.sh)
gcloud run jobs create nextdent-drive-sync \
  --image=asia-northeast1-docker.pkg.dev/nextdent-509613/cloud-run-source-deploy/nextdent-backup:v4 \
  --command=/usr/local/bin/drive-sync.sh \
  --region=asia-northeast1 --project=nextdent-509613 \
  --set-secrets=RCLONE_CONFIG=nextdent-rclone-config:latest \
  --set-env-vars=BUCKET=nextdent-backups-727181117105,DRIVE_FOLDER=NextDent-Backups \
  --max-retries=2 --task-timeout=10m --memory=512Mi

# 5. prove it works before trusting it
gcloud run jobs execute nextdent-drive-sync --region=asia-northeast1 --wait
rclone ls drive:NextDent-Backups

# 6. run it nightly, 30 minutes after the backup
gcloud scheduler jobs create http nextdent-drive-sync-nightly \
  --location=asia-northeast1 --project=nextdent-509613 \
  --schedule="30 2 * * *" --time-zone="Asia/Dhaka" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/nextdent-509613/jobs/nextdent-drive-sync:run" \
  --http-method=POST \
  --oauth-service-account-email=727181117105-compute@developer.gserviceaccount.com
```

`drive-sync.sh` copies only the newest dump, refuses anything under 100 KB, verifies
the gzip before uploading, and prunes Drive copies over 30 days old so the folder
tracks the bucket's own lifecycle.

## Alerting

A failed backup emails **nextdent.barishal@gmail.com** via the Cloud Monitoring policy
*"NextDent — nightly database backup failed"*, which matches any `ERROR` log from the
`nextdent-backup` job. Verified by deliberately pointing the job at a non-existent
bucket and confirming the failure produced a matching log entry.
