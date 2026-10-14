#!/bin/bash
# Dump the whole database to a gzipped SQL file and upload it to the backup bucket.
#
# Required environment:
#   DATABASE_URL  Postgres connection string. MUST be the session pooler (port 5432):
#                 pg_dump needs a stable session and a consistent snapshot, which a
#                 transaction pooler breaks, and Supabase's direct host is IPv6-only.
#   BUCKET        destination bucket name, without the gs:// prefix.
#
# Exits non-zero on any failure so the Cloud Run Job execution is marked failed and
# the Scheduler surfaces it, rather than silently writing an empty/partial object.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BUCKET:?BUCKET is required}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="nextdent-${STAMP}.sql.gz"
TMP="/tmp/${FILE}"

echo "[backup] pg_dump starting at ${STAMP}"
# Three things make this dump restorable onto plain Postgres 17, all verified by
# actually restoring it (see README):
#
#  1. --schema=public — a full dump of a Supabase database also carries Supabase's
#     own schemas and extensions (supabase_vault, auth, storage, …), and restoring
#     that into stock Postgres dies on the first missing extension. The entire
#     application lives in `public`.
#  2. The CREATE EXTENSION lines below — pg_dump omits extensions when --schema is
#     used, because extensions are database-scoped, not schema-scoped. Without them
#     every trigram index fails with "operator class gin_trgm_ops does not exist".
#     They must be created in `public`, since the dump qualifies the operator class
#     as public.gin_trgm_ops.
#  3. Rewriting CREATE SCHEMA public to be idempotent — a freshly created database
#     already has `public`, so the dump's unconditional CREATE SCHEMA aborts it.
#
# --no-owner/--no-privileges drop role grants, since Supabase's roles won't exist
# on the machine you restore onto.
{
  echo "CREATE SCHEMA IF NOT EXISTS public;"
  echo "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;"
  echo "CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;"
  echo "CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;"
  pg_dump "${DATABASE_URL}" --schema=public --no-owner --no-privileges \
    | sed 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/'
} | gzip -9 > "${TMP}"

BYTES="$(wc -c < "${TMP}")"
# A valid gzipped dump of this database is well over 100 KB; anything smaller means
# pg_dump produced nothing useful, and uploading it would quietly replace good backups
# with junk until the 30-day window rotated the real ones out.
if [ "${BYTES}" -lt 100000 ]; then
  echo "[backup] FAILED: dump is only ${BYTES} bytes, refusing to upload" >&2
  exit 1
fi

# Verify the archive is intact before it counts as a backup.
gzip -t "${TMP}"
echo "[backup] dump ok: ${BYTES} bytes"

gcloud storage cp "${TMP}" "gs://${BUCKET}/${FILE}"
echo "[backup] uploaded gs://${BUCKET}/${FILE}"

rm -f "${TMP}"
