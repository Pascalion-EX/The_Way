# Build from the repository root:
# docker build -f frontend/Dockerfile -t the-way-frontend:local .
FROM node:24-bookworm-slim AS build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY frontend/index.html frontend/vite.config.js frontend/jsconfig.json ./
COPY frontend/src ./src
COPY frontend/public ./public
COPY shared /app/shared

# Vite embeds this public value in the JavaScript bundle. Empty uses /api on
# the frontend's own origin; local .env files are excluded by .dockerignore.
ARG VITE_BACKEND_URL=""
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
RUN npm run build

FROM caddy:2-alpine AS runtime

COPY frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv

EXPOSE 80
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["sh", "-c", "test -s /srv/index.html && wget -q --spider -T 3 http://127.0.0.1:2016/health/frontend"]

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
