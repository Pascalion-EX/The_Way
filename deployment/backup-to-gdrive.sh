#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  cat <<'EOF'
Usage: backup-to-gdrive.sh [gdrive:folder]

Back up the Compose database and uploaded images to a verified ZIP, then
upload it to Google Drive. Running APIs, the email worker, and Watchtower
are stopped during the dump and restarted before the upload.

Defaults:
  GDRIVE_BACKUP_REMOTE          gdrive:the-way-backups
  GDRIVE_BACKUP_RETENTION_DAYS  7 (local ZIPs; Drive copies are retained)
  RCLONE_CONFIG                deployment/secrets/rclone/rclone.conf

See deployment/GOOGLE_DRIVE_BACKUPS.md for authentication and scheduling.
EOF
}

if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  usage
  exit 0
fi
if (( $# > 1 )); then
  usage >&2
  exit 1
fi

fail() { printf 'Backup error: %s\n' "$*" >&2; exit 1; }
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
cd -- "$root"
destination=${1:-${GDRIVE_BACKUP_REMOTE:-gdrive:the-way-backups}}
destination=${destination%/}
retention=${GDRIVE_BACKUP_RETENTION_DAYS:-7}
export RCLONE_CONFIG=${RCLONE_CONFIG:-"$root/deployment/secrets/rclone/rclone.conf"}

[[ $destination =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*: ]] || fail 'Use an rclone destination such as gdrive:the-way-backups.'
[[ $retention =~ ^[1-9][0-9]*$ ]] || fail 'GDRIVE_BACKUP_RETENTION_DAYS must be a positive integer.'
for dependency in docker zip unzip rclone flock; do
  command -v "$dependency" >/dev/null || fail "Install the required command: $dependency"
done
[[ -s $RCLONE_CONFIG && -r $RCLONE_CONFIG ]] || fail "Configure Google Drive first; rclone config is missing or unreadable: $RCLONE_CONFIG"
docker compose version >/dev/null

backups="$root/deployment/backups"
mkdir -p -- "$backups"
exec 9>"$backups/.gdrive-backup.lock"
flock -n 9 || fail 'Another Google Drive backup is already running.'

staging=''
archive=''
writers=()
watchtower_stopped=0

resume_services() {
  if (( ${#writers[@]} )); then
    # Start existing containers only; do not recreate them or pull new images.
    if ! docker compose start --wait --wait-timeout 300 "${writers[@]}"; then
      printf 'Could not restart database writers. Check docker compose ps/logs; Watchtower remains stopped.\n' >&2
      return 1
    fi
    writers=()
  fi
  if (( watchtower_stopped )); then
    docker compose start watchtower || return 1
    watchtower_stopped=0
  fi
}

cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  if ! resume_services; then status=1; fi
  if [[ -n $staging ]]; then rm -rf -- "$staging"; fi
  if (( status != 0 )) && [[ -n $archive && -s $archive ]]; then
    printf 'Backup kept locally for retry: %s\n' "$archive" >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Check authentication/connectivity before interrupting application writes.
rclone mkdir "$destination"
running=$(docker compose --profile tools ps --status running --services)
db_running=0
for service in $running; do
  case "$service" in
    db) db_running=1 ;;
  esac
done
(( db_running )) || fail 'The Compose db service must already be running.'

for service in $running; do
  if [[ $service == watchtower ]]; then
    watchtower_stopped=1
    docker compose stop watchtower
  fi
done
for service in $running; do
  case "$service" in
    api|api2|worker) writers+=("$service") ;;
  esac
done
if (( ${#writers[@]} )); then docker compose stop "${writers[@]}"; fi

staging=$(mktemp -d "$backups/.gdrive.XXXXXX")
printf 'Creating database and uploaded-image archives...\n'
# The private staging mount isolates this run from existing local backups.
# Match the host UID so the resulting mode-600 files can be zipped without
# changing ownership. MongoDB credentials remain inside the backup service.
docker compose --profile tools run --rm --no-deps -T \
  --user "$(id -u):$(id -g)" --env HOME=/tmp \
  --volume "$staging:/backups" backup

shopt -s nullglob
databases=("$staging"/the_way-*.archive.gz)
(( ${#databases[@]} == 1 )) || fail 'Expected exactly one completed database archive.'
database=${databases[0]}
images=${database%.archive.gz}.uploads.tar.gz
[[ -s $database && -s $images ]] || fail 'The database/image backup pair is missing or empty.'

# Keep downtime limited to the dump, including when the upload is slow/fails.
resume_services
filename="the_way-gdrive-$(date -u +%Y%m%dT%H%M%S)-${staging##*.}.zip"
# The dump and image archives are already compressed; store them without
# recompression. Flat names preserve compatibility with restore-container.sh.
zip -q -0 -j "$staging/backup.zip" "$database" "$images"
unzip -tq "$staging/backup.zip"
archive="$backups/$filename"
mv -- "$staging/backup.zip" "$archive"
rm -rf -- "$staging"
staging=''

printf 'Uploading %s...\n' "$filename"
# copyto preserves older remote backups. Check the exact uploaded ZIP before
# pruning local copies, and leave the ZIP in place on any transfer/check error.
rclone copyto "$archive" "$destination/$filename" \
  --checksum --immutable --retries 3 --low-level-retries 10
rclone check "$backups" "$destination" --one-way --include "/$filename"
find "$backups" -maxdepth 1 -type f -name 'the_way-gdrive-*.zip' \
  ! -name "$filename" -mtime "+$retention" -delete
printf 'Verified Google Drive backup: %s/%s\nLocal ZIP: %s\n' "$destination" "$filename" "$archive"
