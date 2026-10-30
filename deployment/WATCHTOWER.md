# GitHub Actions and Watchtower

```text
Push to main → tests + lint + build → publish both sha-<commit> images
            → promote both production tags → Watchtower → app containers
```

GitHub Actions builds release images. Watchtower on the VPS polls GHCR every
300 seconds and updates `api`, `api2`, `worker`, and `web`. MongoDB, Traefik,
backups, setup jobs, and Watchtower itself are not selected. The original
[containrrr project was archived](https://github.com/containrrr/watchtower/discussions/2135);
this setup pins the [Nicholas Fedor fork](https://github.com/nicholas-fedor/watchtower/releases/tag/v1.23.2)
to version `1.23.2`, which negotiates modern Docker API versions.

The publisher keeps immutable `sha-<full commit SHA>` tags for manual releases
and rollback. Its final job runs only after both builds succeed, verifies both
images exist, and copies them to `production` without rebuilding. Runs are
serialized per branch, and superseded commits skip promotion. Pull requests
run checks without publishing or promoting.

## First-time VPS activation

Complete the [initial deployment](../DEPLOYMENT.md), public HTTPS/email checks,
and backup/restore checks first. Push these changes and wait for the `promote`
job to succeed on `main`. Both GHCR packages must have a `production` tag.
Deploy the matching source revision to the VPS before enabling Watchtower.

From the repository root on the Linux VPS, edit the existing private `.env`:

```dotenv
APP_VERSION=production
COMPOSE_FILE=compose.yaml:compose.override.yaml:compose.watchtower.yaml
WATCHTOWER_POLL_INTERVAL=300
```

Keep the existing `DOMAIN`, `GHCR_OWNER`, and other production settings.
`COMPOSE_FILE` makes normal Compose commands load the Watchtower override.
The override explicitly selects `production` images for application services
and the two setup jobs. A commit tag does not change when a new commit is
published, so a pinned SHA cannot be used for automatic updates.

Create a dedicated registry configuration directory:

```bash
sudo install -d -m 700 deployment/secrets/watchtower
```

For **private** GHCR packages, use a classic GitHub PAT granting `read:packages`
and access to both packages, including organization SSO where required:

```bash
read -r -p "GitHub username for pulling: " GHCR_USER
read -r -s -p "GitHub read:packages token: " GHCR_TOKEN
printf '\n'
printf '%s' "$GHCR_TOKEN" | sudo docker --config deployment/secrets/watchtower \
  login ghcr.io --username "$GHCR_USER" --password-stdin
unset GHCR_TOKEN
sudo chmod 600 deployment/secrets/watchtower/config.json
```

For **public** packages, an empty registry configuration is sufficient:

```bash
printf '%s\n' '{"auths":{}}' | sudo tee deployment/secrets/watchtower/config.json > /dev/null
sudo chmod 600 deployment/secrets/watchtower/config.json
```

Use one of those alternatives. The directory is ignored by Git and Docker
builds. Its read-only mount lets Watchtower reload credentials if `docker login`
replaces the file. It does not inherit the host's registry login automatically.
See [private-registry configuration](https://watchtower.nickfedor.com/v1.23.2/advanced-features/private-registries/).

Validate, pull, start, and check:

```bash
sudo docker compose config --quiet
sudo docker --config deployment/secrets/watchtower compose pull
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300
sudo docker compose ps -a
sudo docker compose logs --tail 100 watchtower
curl --fail https://YOUR-DOMAIN/health/frontend
curl --fail https://YOUR-DOMAIN/health/ready
```

Watchtower needs access to `/var/run/docker.sock` to recreate containers. That
grants control of the Docker host even with a read-only socket bind mount.
The service exposes no HTTP API or public port, uses explicit application
labels and scope, and cannot update itself under this configuration.

## Update behavior and limits

After the next successful main release, wait at least one polling interval and
check Watchtower logs and public health endpoints. A successful Actions run
confirms image publication; VPS logs and health checks confirm delivery.

The fork's [rolling mode](https://watchtower.nickfedor.com/v1.23.2/configuration/update-behavior/)
replaces containers one at a time and waits for configured health checks. We
disable Compose dependency ordering in Watchtower because its linked-container
mode conflicts with rolling updates. Compose still handles dependencies at
bootstrap. The worker has no HTTP healthcheck. A single Caddy/worker container
can briefly interrupt frontend/email service while restarting. This is not a
zero-downtime deployment or automatic rollback system; a healthcheck timeout
can allow the updater to continue after logging a warning.

Both production tags are promoted after both builds pass, but GHCR does not
provide an atomic transaction across the two image packages. A failed tag write
fails the Actions job and may leave one tag advanced. Re-run promotion after
fixing the registry error. Releases must remain compatible while old and new
containers overlap during polling and rolling replacement.

Watchtower updates images using the existing container settings. It does not
pull this Git repository, apply Compose/Traefik changes, rotate `.env` values,
run indexes or upload initialization again, or migrate data. Such releases
need manual maintenance: stop Watchtower, take backups, update source/config,
pull the intended release, run setup/migrations, and apply Compose before
resuming automatic updates. The fork's maintainers also state that Watchtower
is not recommended as a production orchestrator; this is an opt-in image updater.

## Pause, maintenance, and rollback

Before backups, restores, infrastructure changes, or a manual release:

```bash
sudo docker compose stop watchtower
```

To resume after successful checks, run `sudo docker compose start watchtower`.
Do not resume it during a rollback: it would follow the current production
tags again.

For a persistent rollback, stop Watchtower and edit `.env` to use:

```dotenv
COMPOSE_FILE=compose.yaml:compose.override.yaml
APP_VERSION=sha-PREVIOUS_FULL_40_CHARACTER_COMMIT_SHA
```

Restore the matching source/config revision if necessary, then use the
[manual pull/start and rollback procedure](../DEPLOYMENT.md#roll-back-to-a-published-release).
The registry configuration remains available for `docker --config
deployment/secrets/watchtower compose pull`. Named database, certificate, and
upload volumes are preserved. Watchtower cleans obsolete local images, so
retain immutable SHA tags in GHCR for rollback. A rollback does not undo data
changes. Re-enable Watchtower only after a corrected release has advanced both
production tags and you have applied any required configuration changes.
