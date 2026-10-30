# Single-VPS Compose setup

For production deployment through GitHub Actions and GitHub Container Registry
(GHCR), follow the [step-by-step VPS deployment guide](DEPLOYMENT.md). It includes
the publishing workflow and registry override to add to the repository. This
reference also covers optional local image builds and the base Compose setup.

Run commands from the repository root. The host needs Docker Engine with the
Compose plugin. The stack targets the planned 4-vCPU / 8-GB VPS; its resource
limits are a starting configuration, not a measured concurrent-user capacity.

## Build locally before deployment

```bash
npm run deploy:build
```

This runs `docker compose -f compose.build.yaml build api web`. It builds both
images without a hostname, database, SMTP credentials, JWT secret, or `.env`.
It does not start containers. `compose.yaml` extends the same base image/build
definitions. The guide's production override replaces runtime image references
with published GHCR tags and removes application builds from production.

Commit the source, Dockerfiles, both Compose files, and `.env.example` to
GitHub along with the workflow and override described in the deployment guide.
Local images are stored in Docker, not Git. For the GHCR route, GitHub Actions
builds release images and the VPS pulls them. Runtime `.env` files remain private
on each machine and are excluded from Git and Docker build contexts.

`docker compose up -d --build` starts the deployment stack as well as building
it, so it requires the production settings described below. Use the build-only
command above while preparing the project locally.

## Configure on the VPS

Complete the workflow and registry-override setup in the deployment guide first.
That setup adds `GHCR_OWNER` and a published `sha-<full commit SHA>` value for
`APP_VERSION` to the following application configuration.

```bash
cp .env.example .env
chmod 600 .env
```

Fill in `.env` before starting containers. Set `DOMAIN` to the public hostname without a
scheme, port, or trailing slash. Point its DNS to the VPS and allow inbound TCP
80/443; UDP 443 enables HTTP/3. Set `ACME_EMAIL` to the certificate contact
address. Traefik obtains and renews HTTPS certificates through Let’s Encrypt.

Generate three different values with `openssl rand -hex 32` for
`MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD`, and `JWT_SECRET`. Supply your SMTP
provider's host, port, username, password, sender address, and video-request
recipient. Use port 465 for implicit TLS or 587 for STARTTLS. Single-quote
passwords containing `$` or `#` in `.env` to keep them literal.

Compose reads the root `.env` for interpolation and maps selected values into
each container's environment. Exported shell variables take precedence, so CI
can inject the same names. Backend callers use `getSecrets()` from
`backend/config/secrets.js`, which reads `process.env`. The existing optional
`*_FILE` support remains available for standalone backend containers.
The [Docker environment documentation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
describes precedence and quoting.

The app gets the `kerolosafam_db_user` database user's password; the database root password is
only passed to MongoDB. Traefik gets the public hostname and ACME contact
address; Caddy serves static files on internal HTTP port 80. Backend credentials
are runtime settings and are never passed
as frontend build arguments. `.env` is ignored by Git and the Docker build
context. Use `config --quiet` for validation without printing resolved secrets.

## Pull and start a published release

After configuring the registry override, production environment, and any
private-GHCR login from the deployment guide:

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300
sudo docker compose ps -a
curl --fail https://YOUR-DOMAIN/health/frontend
curl --fail https://YOUR-DOMAIN/health/ready
```

API, worker, and index services reuse the same published backend image tag.
Keep the web image on the same release tag. The VPS runs no application image
builds and needs no host Node/npm installation. To use another environment
file, pass `docker compose --env-file /path/to/file ...`.

MongoDB persists to `mongo_data`. On a fresh volume,
`deployment/mongo-init.js` creates `kerolosafam_db_user` with `readWrite` access to `the_way`.
An `indexes` job then creates declared indexes. The `uploads-init` job sets
ownership of the shared uploads folder for the unprivileged API user. Both
jobs exit successfully before either API or the email worker starts. It remains visible as an exited
container. Caddy serves the React frontend internally. Traefik waits for Caddy
and both APIs to become healthy, publishes ports 80/443, redirects HTTP to HTTPS,
and owns certificate issuance and renewal. Certificate state persists in
`traefik_data` at `/letsencrypt/acme.json`.

```text
Browser → Traefik (HTTPS / TLS)
             ├── /api, /api/*, /health/live, /health/ready → API 1 + API 2
             └── all other paths → Caddy (internal HTTP) → React files
```

[`deployment/traefik/dynamic.yml`](deployment/traefik/dynamic.yml) defines the
hostname routes, equal-weight API load balancing, readiness checks, security
headers, and the 100 KB API request limit (5 MB for `/api/uploads/images`). Failed readiness checks remove an
API from rotation; if both are unavailable, Traefik returns an error rather
than frontend HTML. Caddy retains SPA fallback and static asset caching.
Traefik uses the file provider without a Docker socket mount or public dashboard.
The backend keeps `TRUST_PROXY=1` because API traffic passes through one proxy;
Traefik uses its direct peer address instead of trusting client-supplied
forwarding headers. See [Traefik services](https://doc.traefik.io/traefik/reference/routing-configuration/http/load-balancing/service/)
and [ACME configuration](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/).

When upgrading the previous public-Caddy stack, add `ACME_EMAIL` to `.env`,
publish/pull the matching new frontend image, and run the normal Compose update.
Compose recreates `web` without published ports before starting Traefik. Expect
a brief interruption and a new certificate request. Existing `caddy_data` and
`caddy_config` volumes are no longer used; keep them for rollback. Preserve
`traefik_data` across later releases.

The [official MongoDB image](https://hub.docker.com/_/mongo) initializes users
only on an empty data directory. Changing passwords in `.env` does not change
users in an existing database: update those users through MongoDB as part of
credential rotation. Keep named volumes when restarting or updating the stack;
`docker compose down -v` deletes them.

Useful operator commands:

```bash
docker compose logs --tail 100 traefik api api2 worker db web uploads-init
docker compose run --rm --no-deps indexes
docker compose exec api node scripts/checkEmail.js
```

After changing runtime credentials, recreate the affected services with
`docker compose up -d --wait`. A process restart alone keeps its previous
container environment. Image build/start and HTTPS still need to be verified
on a Docker-enabled host with the actual domain and SMTP account.

## Automatic image updates

The optional [Watchtower integration](deployment/WATCHTOWER.md) connects the
GitHub Actions publisher to the VPS. After both tested images publish, a final
job promotes their `production` tags. `compose.watchtower.yaml` watches only
`api`, `api2`, `worker`, and `web`, and uses the maintained Nicholas Fedor fork
pinned by version and image digest. Follow its activation instructions after
initial deployment checks. Named data volumes stay mounted across updates.
Keep immutable SHA releases for rollback. Host configuration and migrations
still require manual deployment.

## Uploaded images

Lessons, games, activities, trips, and chants use image file pickers on their
create/edit pages. Existing image links remain visible until replaced. Audio
and video fields retain their current behavior. The upload endpoint requires a
verified staff account and shares a 60-upload hourly allowance per account
across both API containers. JPEG, PNG, and still WebP images up to 5 MB and
20 megapixels are decoded, stripped of metadata, resized to fit 2560 × 2560,
and saved as WebP using [Sharp](https://sharp.pixelplumbing.com/api-output/).

The local `uploads/` folder is created automatically and its files stay out of
Git and image builds. In Compose, `uploads_data` persists at `/app/uploads` in
both APIs. Caddy mounts the same volume read-only at `/srv/uploads` and serves
`/uploads/<generated-name>.webp` without React fallback. Uploaded content images
are publicly accessible at their generated URLs. Certificate and database
volumes remain separate. Keep all three volumes across updates.

Publish matching backend and frontend images with these Compose changes. The
`uploads-init` service uses the backend image and initializes permissions
before the APIs and Caddy start; no host-directory ownership change is needed.
Do not remove images merely because a form is cancelled or one record is
removed: lesson variants and other records can share an image URL. Abandoned
uploads remain stored; review references before pruning files.

## Backup and recovery

When using automatic updates, stop Watchtower before backup/recovery with
`docker compose stop watchtower`, and resume it only after successful startup
and health checks. See the [maintenance procedure](deployment/WATCHTOWER.md#pause-maintenance-and-rollback).

```bash
docker compose --profile tools run --rm backup
```

This writes a database `.archive.gz` and a companion `.uploads.tar.gz` with
the same timestamp under the ignored `deployment/backups/` directory. `BACKUP_RETENTION_DAYS` defaults to 7; older completed archives are
removed after a successful dump. Schedule this command on the host for regular
backups and copy the archives off the VPS. The tools use a private temporary
config file for the password, following the
[MongoDB tools documentation](https://www.mongodb.com/docs/database-tools/mongodump/#std-option-mongodump.--config).
Temporary configuration and incomplete archives are removed when the command
exits. Copy both completed archives off the VPS; a database backup alone does
not contain uploaded image bytes.

For a consistent backup of this standalone database, quiesce writes first:
stop `traefik`, `web`, `api`, `api2`, and `worker`, run the backup, then start the stack
again with `docker compose up -d --wait`.

Recovery replaces collections present in the chosen archive. Stop traffic,
both APIs, and the worker first; keep MongoDB running. Use an actual archive
filename in the restore command:

```bash
docker compose stop traefik web api api2 worker
docker compose --profile tools run --rm --entrypoint sh backup \
  /scripts/restore-container.sh /backups/the_way-YYYYMMDDTHHMMSS-PID.archive.gz
docker compose run --rm --no-deps indexes
docker compose up -d --wait
```

When the matching `.uploads.tar.gz` is present, recovery validates and restores
those images before restoring the database. Older releases have no companion
archive, so their database archives remain usable. Existing image files are
retained. Collections absent from the archive remain in the database. Validate recovery
on a separate test database before relying on backups for production.
