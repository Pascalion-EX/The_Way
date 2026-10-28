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

## Connect the backend

The default upstream is `api:4000`. Containers must share a Docker network, and the upstream name must resolve on that network. For a backend already running as `the-way-backend`, create/connect a shared network and start the frontend with its name:

```bash
docker network create the-way
docker network connect the-way the-way-backend

# Use this instead of the preview container above.
docker run -d --name the-way-frontend --network the-way \
  -p 127.0.0.1:8080:80 \
  -e API_UPSTREAMS=the-way-backend:4000 \
  the-way-frontend:local
```

If the network already exists or the backend is already attached, skip the corresponding creation/connection command. Stop/remove your previous preview container before reusing its name/port. No backend port needs to be published for this internal connection; the earlier backend host binding can still be used for local checks.

The supplied Compose `web` service uses `api:4000 api2:4000` for the two existing API services and shares their private network. Caddy preserves the `/api` prefix, forwards cookies and proxy headers, checks backend readiness, and balances healthy upstreams. When the API is unavailable, its routes return a proxy error; they do not fall back to the React application HTML.

## Runtime settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `SITE_ADDRESS` | `:80` | HTTP preview; set a public hostname such as `way.example.org` to enable automatic HTTPS |
| `API_UPSTREAMS` | `api:4000` | One or more space-separated backend addresses reachable from the container |

For production, point the hostname to the VPS, make inbound TCP 80/443 reachable (UDP 443 is optional), and preserve Caddy state:

```bash
docker run -d --name the-way-frontend --network the-way \
  --restart unless-stopped --stop-timeout 30 \
  -p 80:80 -p 443:443 -p 443:443/udp \
  -e SITE_ADDRESS=way.example.org \
  -e API_UPSTREAMS=the-way-backend:4000 \
  -v the-way-caddy-data:/data \
  -v the-way-caddy-config:/config \
  the-way-frontend:local
```

Use the actual hostname and keep backend `APP_ORIGIN` equal to `https://YOUR-HOSTNAME`, without a trailing slash. Use `TRUST_PROXY=1` for this single-proxy topology, and keep the API port private. The `web` Compose service configures the hostname through `DOMAIN`; Caddy can obtain certificates without a configured account email. Certificate/network setup must be verified on the VPS.

The image healthcheck verifies that `index.html` exists and Caddy answers on a separate loopback-only HTTP listener at port 2016. That port is not published. Frontend container health is independent of backend/database readiness; use `/health/ready` for the proxied backend check.

## API URL at build time

Leave `VITE_BACKEND_URL` empty for the single-VPS setup. Browser requests use the frontend origin, and Caddy proxies `/api` internally. `API_UPSTREAMS` is runtime-only and is not embedded in browser JavaScript.

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

References: [Vite static deployment](https://vite.dev/guide/static-deploy.html), [Caddy routing](https://caddyserver.com/docs/caddyfile/directives/handle), and [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
