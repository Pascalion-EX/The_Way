# Single-VPS Compose setup

Run commands from the repository root. The host needs Docker Engine with the
Compose plugin. The stack targets the planned 4-vCPU / 8-GB VPS; its resource
limits are a starting configuration, not a measured concurrent-user capacity.

## Build locally before deployment

```bash
npm run deploy:build
```

This runs `docker compose -f compose.build.yaml build api web`. It builds both
images without a hostname, database, SMTP credentials, JWT secret, or `.env`.
It does not start containers. `compose.yaml` extends the same image/build
definitions when the full stack runs, so both workflows use the same tags and
Dockerfiles.

Commit the source, Dockerfiles, both Compose files, and `.env.example` to
GitHub. Local images are stored in Docker, not Git. After cloning the source
on the VPS, run the same build command there. Runtime `.env` files remain
private on each machine and are excluded from Git and Docker build contexts.

`docker compose up -d --build` starts the deployment stack as well as building
it, so it requires the production settings described below. Use the build-only
command above while preparing the project locally.

## Configure on the VPS

```bash
cp .env.example .env
chmod 600 .env
```

Fill in `.env` before starting containers. Set `DOMAIN` to the public hostname without a
scheme, port, or trailing slash. Point its DNS to the VPS and allow inbound TCP
80/443; UDP 443 enables HTTP/3. Caddy obtains HTTPS certificates automatically.

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

The app gets the `way` database user's password; the database root password is
only passed to MongoDB. The web container gets `SITE_ADDRESS` and
`API_UPSTREAMS`. Backend credentials are runtime settings and are never passed
as frontend build arguments. `.env` is ignored by Git and the Docker build
context. Use `config --quiet` for validation without printing resolved secrets.

## Build and start

```bash
npm run deploy:config
npm run deploy:build
npm start
docker compose ps -a
curl --fail https://YOUR-DOMAIN/health/frontend
curl --fail https://YOUR-DOMAIN/health/ready
```

These npm scripts run `docker compose config --quiet`,
`docker compose -f compose.build.yaml build api web`, and
`docker compose up -d --wait`. API, worker, and index services
reuse the same backend image tag. To use another environment file, run the
equivalent Docker commands with `docker compose --env-file /path/to/file ...`.

MongoDB persists to `mongo_data`. On a fresh volume,
`deployment/mongo-init.js` creates `way` with `readWrite` access to `the_way`.
An `indexes` job then creates declared indexes and exits successfully before
either API or the email worker starts. It remains visible as an exited
container. Caddy waits for both APIs to become healthy, serves the frontend,
and proxies `/api` to them. Only Caddy publishes host ports. Caddy certificate
state persists in `caddy_data` and `caddy_config`.

The [official MongoDB image](https://hub.docker.com/_/mongo) initializes users
only on an empty data directory. Changing passwords in `.env` does not change
users in an existing database: update those users through MongoDB as part of
credential rotation. Keep named volumes when restarting or updating the stack;
`docker compose down -v` deletes them.

Useful operator commands:

```bash
docker compose logs --tail 100 api api2 worker db web
docker compose run --rm --no-deps indexes
docker compose exec api node scripts/checkEmail.js
```

After changing runtime credentials, recreate the affected services with
`docker compose up -d --wait`. A process restart alone keeps its previous
container environment. Image build/start and HTTPS still need to be verified
on a Docker-enabled host with the actual domain and SMTP account.

## Backup and recovery

```bash
docker compose --profile tools run --rm backup
```

This writes a compressed archive under the ignored `deployment/backups/`
directory. `BACKUP_RETENTION_DAYS` defaults to 7; older completed archives are
removed after a successful dump. Schedule this command on the host for regular
backups and copy the archives off the VPS. The tools use a private temporary
config file for the password, following the
[MongoDB tools documentation](https://www.mongodb.com/docs/database-tools/mongodump/#std-option-mongodump.--config).
The temporary file and incomplete archive are removed when the command exits.

For a consistent backup of this standalone database, quiesce writes first:
stop `web`, `api`, `api2`, and `worker`, run the backup, then start the stack
again with `docker compose up -d --wait`.

Recovery replaces collections present in the chosen archive. Stop traffic,
both APIs, and the worker first; keep MongoDB running. Use an actual archive
filename in the restore command:

```bash
docker compose stop web api api2 worker
docker compose --profile tools run --rm --entrypoint sh backup \
  /scripts/restore-container.sh /backups/the_way-YYYYMMDDTHHMMSS-PID.archive.gz
docker compose run --rm --no-deps indexes
docker compose up -d --wait
```

Collections absent from the archive remain in the database. Validate recovery
on a separate test database before relying on backups for production.
