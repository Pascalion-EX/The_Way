# Backend Docker image

Build from the **repository root**, because backend modules import `../shared`:

```bash
docker build --pull -f backend/Dockerfile -t the-way-backend:local .
```

The image uses Node 24 on Debian slim, installs locked production dependencies in a separate stage, and runs `node server.js` as the unprivileged `node` user. It includes backend runtime code, email assets, operator scripts, and shared modules. Frontend files, backend tests, dependency-install caches, and local `.env` files are excluded from the runtime image. The root `.dockerignore` excludes local environment files and host `node_modules` from the build context.

## Configure and start

```bash
cp backend/.env.example backend/.env.docker
# Fill in the database connection, random JWT secret, HTTPS origin, and mail settings.
```

Use a MongoDB URI reachable from the container. The container's `localhost` does not refer to your VPS host or another container. For MongoDB in a separate container, attach both containers to the same Docker network and use its service name. The root [Compose setup](../DOCKER.md) configures this automatically.

Production startup checks the required configuration. Passwords/JWT secrets may alternatively be mounted as files and supplied through `MONGODB_URL_FILE`, `MONGO_APP_PASSWORD_FILE`, `JWT_SECRET_FILE`, and `SMTP_PASS_FILE`, which the existing runtime loader supports.

Once the database is reachable, create declared indexes before starting the API. The following commands assume the supplied URI is accessible on Docker's default network; add your shared `--network` option to both commands when using container service names:

```bash
docker run --rm --init --stop-timeout 45 --no-healthcheck \
  --env-file backend/.env.docker \
  the-way-backend:local node scripts/createIndexes.js

docker run -d --name the-way-backend --init --stop-timeout 45 \
  --env-file backend/.env.docker \
  --memory 1g --cpus 1 --pids-limit 128 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -p 127.0.0.1:4000:4000 \
  the-way-backend:local

curl --fail http://127.0.0.1:4000/health/ready
docker logs --tail 100 the-way-backend
```

Port 4000 is bound to the host's loopback interface for a host reverse proxy or local checks. A proxy running in another container should share the API's network instead. Production browser traffic requires HTTPS, consistent with the app's secure authentication cookies. Set `TRUST_PROXY=1` only for the intended single-proxy topology.

The image's healthcheck uses Node's built-in HTTP client and checks database readiness. It follows `PORT` when overridden. `--init` forwards signals/reaps child processes, and the 45-second stop timeout gives the existing shutdown handler time to drain requests and close connections.

The same image can run `node worker.js` with `--no-healthcheck`; disable the embedded API worker using `EMAIL_WORKER_ENABLED=false` when using a dedicated worker service. MongoDB remains a separate service and is not installed in this image.

The Compose API/worker/index services share `backend/Dockerfile`. Follow the
root [Compose setup](../DOCKER.md) to run the frontend, both APIs, the email
worker, and MongoDB together. It supplies runtime credentials from a root `.env`
through `process.env`; `config/secrets.js` exposes them to backend callers.


Image uploads use `UPLOADS_DIR` (default: the repository’s `uploads/` folder;
`/app/uploads` in the image). Mount persistent writable storage there when
running a standalone API. Both Compose API containers share `uploads_data`,
initialized by the one-off `uploads-init` service. Do not bake uploaded files
into images. `/api/uploads/images` accepts JPEG, PNG, and WebP file bytes with
the corresponding `Content-Type`; it requires a verified staff account and
returns a relative `/uploads/…webp` URL for the content’s existing image field.
