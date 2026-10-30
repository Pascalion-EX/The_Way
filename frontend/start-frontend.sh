#!/bin/sh
set -eu

retention=${ASSET_RETENTION_DAYS:-30}
case "$retention" in
  ''|*[!0-9]*) echo 'ASSET_RETENTION_DAYS must be an integer between 1 and 365' >&2; exit 1 ;;
esac
if [ "$retention" -lt 1 ] || [ "$retention" -gt 365 ]; then
  echo 'ASSET_RETENTION_DAYS must be an integer between 1 and 365' >&2
  exit 1
fi

# index.html always comes from the new image. Only hashed assets are shared
# across replacements, so open tabs can finish loading an earlier release.
test -d /opt/frontend-assets
mkdir -p /srv/assets
manifest=/srv/assets/.asset-manifest
if [ -f "$manifest" ]; then
  while IFS= read -r asset; do
    # Start the grace period when an asset leaves a release, even if that
    # release ran for months before this deployment.
    case "$asset" in
      ./*)
        if [ -f "/srv/assets/$asset" ] && [ ! -f "/opt/frontend-assets/$asset" ]; then
          touch "/srv/assets/$asset"
        fi ;;
    esac
  done < "$manifest"
fi
staging=$(mktemp -d /srv/assets/.stage.XXXXXX)
next_manifest=""
trap 'rm -rf "$staging"; if [ -n "$next_manifest" ]; then rm -f "$next_manifest"; fi' EXIT
cp -R /opt/frontend-assets/. "$staging/"
# Two replicas may publish the same build while one already serves requests.
# Rename complete files atomically instead of truncating a public cache file.
find "$staging" -type f -exec sh -c '
  set -eu
  staging=$1
  target=$2
  shift 2
  for file do
    relative=${file#"$staging/"}
    case "$relative" in */*) mkdir -p "$target/${relative%/*}" ;; esac
    mv -f "$file" "$target/$relative"
  done
' sh "$staging" /srv/assets {} +
rm -rf "$staging"
next_manifest=$(mktemp /srv/assets/.manifest.XXXXXX)
(cd /opt/frontend-assets && find . -type f -print) > "$next_manifest"
mv "$next_manifest" "$manifest"
trap - EXIT
# Current assets have fresh copy timestamps; retired assets retain their
# retirement timestamps. Metadata is never part of public asset expiry.
find /srv/assets -type f ! -name '.*' -mtime "+$retention" -delete

exec "$@"
