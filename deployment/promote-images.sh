#!/bin/sh
set -eu

owner=${1:?Supply the lowercase GHCR owner}
release_sha=${2:?Supply the full release commit SHA}
case "$owner" in
  ''|*[!a-z0-9-]*|-*|*-) echo 'Invalid GHCR owner' >&2; exit 1 ;;
esac
case "$release_sha" in
  *[!a-f0-9]*) echo 'Invalid release SHA' >&2; exit 1 ;;
esac
[ "${#release_sha}" -eq 40 ] || { echo 'Supply a full 40-character release SHA' >&2; exit 1; }

# Verify BOTH immutable images before advancing either mutable tag.
for image in the-way-api the-way-web; do
  docker buildx imagetools inspect "ghcr.io/$owner/$image:sha-$release_sha" > /dev/null
done
for image in the-way-api the-way-web; do
  docker buildx imagetools create --prefer-index=false \
    --tag "ghcr.io/$owner/$image:production" "ghcr.io/$owner/$image:sha-$release_sha"
done
printf 'Published production tags for release %s\n' "$release_sha"
