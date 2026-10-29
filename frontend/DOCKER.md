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
go to Caddy at `web:80` over the private Docker network.

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

Leave `VITE_BACKEND_URL` empty for the single-VPS setup. Browser requests use the frontend origin, and Traefik routes `/api` directly to the API containers. The routing configuration is not embedded in browser JavaScript.

If a separately hosted API is needed, override the public build argument:

```bash
docker build --pull -f frontend/Dockerfile \
  --build-arg VITE_BACKEND_URL=https://api.example.org \
  -t the-way-frontend:local .
```

That value is public and baked into the bundle. Changing a container's environment later does not change it. A separate API origin also requires matching backend CORS and cookie settings. Do not put credentials in Vite variables or build arguments.

## Routing and caching

`frontend/Caddyfile` provides React Router fallback for direct page reloads, compression, one-year immutable caching for hashed `/assets/` files, and revalidation for HTML and other public files. Missing hashed assets return 404. Keep previous hashed assets available across releases or provide a controlled refresh path for already-open browsers as part of the later deployment workflow.

The root [Compose setup](../DOCKER.md) includes database initialization, runtime environment configuration, index creation, and backup tools. It builds this image with an empty `VITE_BACKEND_URL` and passes no backend credentials to the frontend.

References: [Vite static deployment](https://vite.dev/guide/static-deploy.html), [Caddy routing](https://caddyserver.com/docs/caddyfile/directives/handle), and [Traefik services](https://doc.traefik.io/traefik/reference/routing-configuration/http/load-balancing/service/).
