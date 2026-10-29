# Build from the repository root:
# docker build -f backend/Dockerfile -t the-way-backend:local .
FROM node:24-bookworm-slim AS dependencies

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app/backend

COPY --from=dependencies --chown=node:node /app/backend/node_modules ./node_modules
COPY --chown=node:node backend/package.json ./package.json
COPY --chown=node:node backend/server.js backend/worker.js ./
COPY --chown=node:node backend/assets ./assets
COPY --chown=node:node backend/config ./config
COPY --chown=node:node backend/controllers ./controllers
COPY --chown=node:node backend/middleware ./middleware
COPY --chown=node:node backend/models ./models
COPY --chown=node:node backend/routes ./routes
COPY --chown=node:node backend/scripts ./scripts
COPY --chown=node:node backend/services ./services
COPY --chown=node:node backend/utils ./utils
COPY --chown=node:node shared /app/shared

RUN mkdir -p /app/uploads && chown node:node /app/uploads
ENV UPLOADS_DIR=/app/uploads

USER node
EXPOSE 4000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health/ready', { signal: AbortSignal.timeout(3000) }).then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
