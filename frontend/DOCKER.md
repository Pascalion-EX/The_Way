# Frontend Docker image

Build from the **repository root**, so the build can include `shared/` imports:

```bash
docker build --pull -f frontend/Dockerfile -t the-way-frontend:local .
```

The build stage uses Node 24, installs locked dependencies (including the Vite/Tailwind build tools), and runs `npm run build`. The runtime stage contains Caddy and the compiled static files. It does not run a Node process or Vite preview. Local `.env` files, host `node_modules`, source Git metadata, tests, and backend code are not copied into the runtime image.

## Local preview

```bash
docker run -d --name the-way-frontend \
  -p 127.0.0.1:8080:80 \
  the-way-frontend:local

curl --fail http://127.0.0.1:8080/health/frontend
curl --fail http://127.0.0.1:8080/login
docker logs --tail 100 the-way-frontend
```

Visit `http://localhost:8080`. Static pages can load while the API is unavailable; login and protected content need a working backend. HTTP preview alone does not provide production authentication: the backend uses Secure cookies and production requires an HTTPS public origin.

## Production routing

The supplied [Compose stack](../DOCKER.md) publishes only Traefik on TCP 80/443
and UDP 443 for HTTP/3. Traefik handles HTTPS certificates and redirects, routes
`/api`, `/api/*`, `/health/live`, and `/health/ready` directly to `api:4000` and
`api2:4000`, and balances requests across healthy API containers. Other paths
go to Caddy at `web:80` and `web2:80` over the private Docker network. Caddy also serves
uploaded images at `/uploads/` from its read-only mount of `uploads_data`;
missing uploads return 404 instead of React HTML.

Caddy serves the React files over HTTP only. It has no API upstream setting,
public port binding, or certificate responsibility. A standalone preview
returns 404 for API paths; use the full Compose stack for login and protected
content. Unknown API paths and API failures cannot fall back to React HTML.

Set `DOMAIN` and `ACME_EMAIL` in the root `.env` and preserve the
`traefik_data` volume for certificates. Keep backend `APP_ORIGIN` equal to
`https://YOUR-HOSTNAME` without a trailing slash and `TRUST_PROXY=1` because
Traefik connects directly to each API. The API and Caddy ports stay private.
See [Traefik’s ACME configuration](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/).

The image healthcheck verifies that `index.html` exists and Caddy answers on a
separate loopback-only HTTP listener at port 2016. That port is not published.
Frontend container health is independent of backend/database readiness; use
public `/health/ready` to check the API through Traefik.

## API URL at build time

Leave `VITE_BACKEND_URL` empty for the single-VPS setup. Browser requests use the frontend origin, and Traefik routes `/api` directly to the API containers. The routing configuration is not embedded in browser JavaScript. Locally,
Vite proxies `/uploads` to port 4000. Uploaded image paths also resolve against
`VITE_BACKEND_URL` when a separate API origin is configured.

If a separately hosted API is needed, override the public build argument:

```bash
docker build --pull -f frontend/Dockerfile \
  --build-arg VITE_BACKEND_URL=https://api.example.org \
  -t the-way-frontend:local .
```

That value is public and baked into the bundle. Changing a container's environment later does not change it. A separate API origin also requires matching backend CORS and cookie settings. Do not put credentials in Vite variables or build arguments.

## Routing and caching

`frontend/Caddyfile` provides React Router fallback for direct page reloads, compression, one-year immutable caching for hashed `/assets/` files, and revalidation for HTML and other public files. Both replicas follow the same release channel and mount `frontend_assets`. The volume retains hashed assets from earlier releases so open tabs can load lazy pages after Watchtower replaces the image. The image entrypoint publishes its new assets before starting Caddy and expires unused files after `ASSET_RETENTION_DAYS` (default 30, configurable from 1 to 365). HTML comes from the current image and revalidates on every request; only the asset directory persists. Missing assets return 404 with `Cache-Control: no-store`.

A `vite:preloadError` handler refreshes an online tab at most once per entry bundle, using session storage to prevent reload loops. If storage is blocked, the browser is offline, or the failure persists, an error boundary provides a reload button. Tabs whose assets were already lost before the migration may need a hard refresh after the corrected release is deployed. See [Vite’s load-error handling](https://vite.dev/guide/build.html#load-error-handling).

The root [Compose setup](../DOCKER.md) includes database initialization, runtime environment configuration, index creation, and backup tools. It builds this image with an empty `VITE_BACKEND_URL` and passes no backend credentials to the frontend.

References: [Vite static deployment](https://vite.dev/guide/static-deploy.html), [Caddy routing](https://caddyserver.com/docs/caddyfile/directives/handle), and [Traefik services](https://doc.traefik.io/traefik/reference/routing-configuration/http/load-balancing/service/).


## One-time migration for existing deployments

The asset volume is a Compose change. Watchtower replaces images with the
existing container configuration, so an image update alone cannot attach it.
If Watchtower is enabled, stop it before publishing/applying this release:

```bash
sudo docker compose stop watchtower
```

Check out the corrected source/configuration and select matching published
images using the normal [deployment procedure](../DEPLOYMENT.md). While both
old frontend containers are still running, pull the corrected images, preserve
their available assets, and seed the new volume before recreating services:

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo sh deployment/preserve-frontend-assets.sh
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300
curl --fail https://YOUR-DOMAIN/health/frontend
```

Use the dedicated `docker --config deployment/secrets/watchtower compose pull`
command if that is where your private GHCR login is stored. The preservation
script snapshots each running replica separately and prints the backup
directory. It aborts if a snapshot fails, excludes private manifests and
unfinished files from the shared cache, and leaves existing cached assets
intact. Keep the snapshots until deployment checks pass. Run this helper only
for the migration; later releases retain their assets in the shared volume.
Copying the old assets cannot restore a file already missing from the old container; the
corrected complete release and a hard refresh restore navigation for those
clients. Keep the `frontend_assets` volume on future updates, and retain these
files for the whole configured grace period.

After public health and browser navigation checks pass, resume Watchtower if
it was previously enabled. Do not delete the running container’s assets or
mount a persistent volume over all of `/srv`, which would retain stale HTML.
