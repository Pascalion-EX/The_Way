#!/bin/sh
set -eu

# Run after pulling the new image, while the old frontends are still running
# and Watchtower is stopped. Keep the snapshots if any later deployment fails.
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
docker compose config --quiet
backup_dir=$(mktemp -d "${TMPDIR:-/tmp}/the-way-frontend-assets.XXXXXX")
printf 'Frontend asset snapshots: %s\n' "$backup_dir"

copied=false
for service in web web2; do
  container=$(docker compose ps -q "$service")
  if [ -z "$container" ]; then
    printf 'Skipping %s: no running container\n' "$service"
    continue
  fi
  mkdir "$backup_dir/$service"
  docker compose cp "$service:/srv/assets/." "$backup_dir/$service/"
  copied=true
done

if [ "$copied" != true ]; then
  echo 'No running frontend assets found; use the normal first-deployment procedure.' >&2
  exit 1
fi

# Seed the new shared volume without replacing the old containers. Publish
# complete files atomically, preserve existing cache entries, and omit private
# manifests/staging files. Never copy HTML into the asset volume.
docker compose run --rm --no-deps --pull never \
  --label com.centurylinklabs.watchtower.enable=false \
  --entrypoint sh --volume "$backup_dir:/seed:ro" web -eu -c '
  mkdir -p /srv/assets
  for replica in web web2; do
    [ -d "/seed/$replica" ] || continue
    (
      cd "/seed/$replica"
      find . -type d -name ".*" ! -name . -prune -o \
        -type f ! -name ".*" -exec sh -eu -c '\''
        for file do
          target=/srv/assets/${file#./}
          [ ! -e "$target" ] || continue
          mkdir -p "${target%/*}"
          temporary=$(mktemp "${target%/*}/.seed.XXXXXX")
          cp "$file" "$temporary"
          mv -n "$temporary" "$target"
          rm -f "$temporary"
        done
      '\'' sh {} +
    )
  done
'

printf 'Assets from both replicas are preserved. Apply the new services with Compose before resuming Watchtower.\n'
