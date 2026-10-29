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
uploads_archive="${archive%.archive.gz}.uploads.tar.gz"
MONGO_TOOLS_CONFIG=$(mktemp)
export MONGO_TOOLS_CONFIG
trap 'rm -f "$MONGO_TOOLS_CONFIG" "$MONGO_TOOLS_CONFIG.entries" "$MONGO_TOOLS_CONFIG.types"' EXIT
trap 'exit 1' HUP INT TERM
# Pre-upload releases have no companion archive. New backups restore both.
if [ -e "$uploads_archive" ]; then
  if [ ! -s "$uploads_archive" ]; then
    echo 'Uploaded images archive is empty' >&2; exit 1
  fi
  # Backups contain only generated filenames. Reject paths, links, and other
  # entries before extraction into the shared persistent directory.
  tar -tzf "$uploads_archive" > "$MONGO_TOOLS_CONFIG.entries"
  while IFS= read -r entry; do
    case "$entry" in
      ./) ;;
      ./*) name=${entry#./};
        case "$name" in */*|.*) echo 'Invalid uploaded image archive entry' >&2; exit 1 ;; esac
        case "$name" in
          *.webp) stem=${name%.webp};
            case "$stem" in *[!a-f0-9]*) echo 'Invalid uploaded image filename' >&2; exit 1 ;; esac
            [ "${#stem}" -eq 64 ] || exit 1 ;;
          *) echo 'Invalid uploaded image filename' >&2; exit 1 ;;
        esac ;;
      *) echo 'Invalid uploaded image archive entry' >&2; exit 1 ;;
    esac
  done < "$MONGO_TOOLS_CONFIG.entries"
  tar -tvzf "$uploads_archive" > "$MONGO_TOOLS_CONFIG.types"
  while IFS= read -r entry; do
    case "$entry" in
      -*) ;;
      d*' ./') ;;
      *) echo 'Uploaded image archives cannot contain links or special files' >&2; exit 1 ;;
    esac
  done < "$MONGO_TOOLS_CONFIG.types"
  # Extract files without retaining archive ownership. Applications run as 1000.
  tar -xzf "$uploads_archive" --no-same-owner --no-overwrite-dir -C /uploads
  chown -R 1000:1000 /uploads
  chmod 755 /uploads
fi

mongosh --nodb --quiet --file /scripts/mongo-tools-config.js

# Manual recovery operation: replace collections contained in the archive.
mongorestore --config "$MONGO_TOOLS_CONFIG" --host db --port 27017 \
  --username kerolosafam_db_user --authenticationDatabase the_way --nsInclude 'the_way.*' \
  --numParallelCollections 1 --stopOnError --drop --gzip --archive="$archive"
