# Nightly database backup job: pg_dump the Supabase database into a private GCS bucket.
# Runs as a Cloud Run Job on a Cloud Scheduler trigger — see ops/backup/README.md.
#
# pg_dump must be at least as new as the server (Supabase runs Postgres 17), so the
# client comes from PGDG rather than Debian's older packaged version.
FROM google/cloud-sdk:slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg lsb-release \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl --fail -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
      https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-17 \
 && apt-get purge -y gnupg && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# rclone, for mirroring the finished backup into Google Drive (drive-sync.sh)
RUN curl -fsSL https://downloads.rclone.org/rclone-current-linux-amd64.deb -o /tmp/rclone.deb \
 && apt-get update && apt-get install -y --no-install-recommends /tmp/rclone.deb \
 && rm -f /tmp/rclone.deb && rm -rf /var/lib/apt/lists/*

COPY backup.sh /usr/local/bin/backup.sh
COPY drive-sync.sh /usr/local/bin/drive-sync.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/drive-sync.sh

ENTRYPOINT ["/usr/local/bin/backup.sh"]
