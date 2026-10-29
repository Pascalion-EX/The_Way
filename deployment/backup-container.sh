#!/bin/sh
set -eu
umask 077

: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is required}"
retention=${BACKUP_RETENTION_DAYS:-7}
case "$retention" in
  ''|*[!0-9]*) echo 'BACKUP_RETENTION_DAYS must be a positive integer' >&2; exit 1 ;;
esac
if [ "$retention" -lt 1 ]; then
  echo 'BACKUP_RETENTION_DAYS must be a positive integer' >&2
  exit 1
fi

mkdir -p /backups
MONGO_TOOLS_CONFIG=$(mktemp)
export MONGO_TOOLS_CONFIG
archive="/backups/the_way-$(date -u +%Y%m%dT%H%M%S)-$$.archive.gz"
uploads_archive="${archive%.archive.gz}.uploads.tar.gz"
trap 'rm -f "$MONGO_TOOLS_CONFIG" "$archive.partial" "$uploads_archive.partial"' EXIT
trap 'exit 1' HUP INT TERM

# Keep the password out of command-line arguments and tool logs.
mongosh --nodb --quiet --file /scripts/mongo-tools-config.js
mongodump --config "$MONGO_TOOLS_CONFIG" --host db --port 27017 \
  --username kerolosafam_db_user --authenticationDatabase the_way --db the_way \
  --numParallelCollections 1 --gzip --archive="$archive.partial"
tar -czf "$uploads_archive.partial" --exclude='./.*' -C /uploads .
mv "$uploads_archive.partial" "$uploads_archive"
mv "$archive.partial" "$archive"
find /backups -maxdepth 1 -type f -name 'the_way-*.archive.gz' -mtime "+$retention" -delete
find /backups -maxdepth 1 -type f -name 'the_way-*.uploads.tar.gz' -mtime "+$retention" -delete
printf 'Backup written: %s\n' "$archive"
printf 'Uploaded images backup written: %s\n' "$uploads_archive"
