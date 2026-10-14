#!/bin/bash
# Mirror the newest backup from the GCS bucket into Google Drive, so the clinic's data
# exists in two places rather than one.
#
# Why rclone and a user OAuth token rather than a service account: a service account
# cannot usefully write into a personal My Drive. Files it creates are owned by the
# service account, which has no storage quota outside a Workspace Shared Drive, so the
# upload fails or the file is invisible to the user. Acting as the user keeps the files
# owned by — and counted against — the clinic's own 15 GB.
#
# Honest limitation: both copies live under one Google login. This protects against
# accidental deletion, a bad lifecycle rule, project deletion and billing suspension.
# It does NOT protect against the account itself being compromised or closed.
#
# Required environment:
#   BUCKET          source bucket name, without gs://
#   RCLONE_CONFIG   full rclone config contents, from Secret Manager
#   DRIVE_FOLDER    destination path inside Drive (default: NextDent-Backups)
set -euo pipefail

: "${BUCKET:?BUCKET is required}"
: "${RCLONE_CONFIG:?RCLONE_CONFIG is required}"
DRIVE_FOLDER="${DRIVE_FOLDER:-NextDent-Backups}"

CONF="$(mktemp)"
trap 'rm -f "$CONF"' EXIT
printf '%s' "${RCLONE_CONFIG}" > "$CONF"

# Newest object in the bucket — gcloud storage ls sorts lexicographically and the
# filenames are ISO timestamps, so the last line is the most recent.
LATEST="$(gcloud storage ls "gs://${BUCKET}/" | tail -1)"
[ -n "${LATEST}" ] || { echo "[drive] nothing in gs://${BUCKET}" >&2; exit 1; }
NAME="$(basename "${LATEST}")"

echo "[drive] copying ${NAME}"
TMP="/tmp/${NAME}"
gcloud storage cp "${LATEST}" "${TMP}"

# Refuse to upload a truncated file, for the same reason backup.sh does.
BYTES="$(wc -c < "${TMP}")"
if [ "${BYTES}" -lt 100000 ]; then
  echo "[drive] FAILED: ${NAME} is only ${BYTES} bytes" >&2
  exit 1
fi
gzip -t "${TMP}"

rclone --config "$CONF" copyto "${TMP}" "drive:${DRIVE_FOLDER}/${NAME}" --no-traverse
echo "[drive] uploaded ${NAME} (${BYTES} bytes) to drive:${DRIVE_FOLDER}/"

# Keep Drive in step with the bucket's 30-day lifecycle, so it does not grow forever.
rclone --config "$CONF" delete "drive:${DRIVE_FOLDER}" --min-age 30d || true
echo "[drive] pruned copies older than 30 days"

rm -f "${TMP}"
