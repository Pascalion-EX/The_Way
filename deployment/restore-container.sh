#!/bin/sh
set -eu
umask 077

: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is required}"
archive=${1:?Supply an archive path under /backups}
case "$archive" in
  /backups/*.archive.gz) ;;
  *) echo 'Supply an archive path under /backups ending in .archive.gz' >&2; exit 1 ;;
esac
if [ ! -s "$archive" ]; then
  echo 'Backup archive is missing or empty' >&2
  exit 1
fi

MONGO_TOOLS_CONFIG=$(mktemp)
export MONGO_TOOLS_CONFIG
trap 'rm -f "$MONGO_TOOLS_CONFIG"' EXIT
trap 'exit 1' HUP INT TERM
mongosh --nodb --quiet --file /scripts/mongo-tools-config.js

# Manual recovery operation: replace collections contained in the archive.
mongorestore --config "$MONGO_TOOLS_CONFIG" --host db --port 27017 \
  --username kerolosafam_db_user --authenticationDatabase the_way --nsInclude 'the_way.*' \
  --numParallelCollections 1 --stopOnError --drop --gzip --archive="$archive"
