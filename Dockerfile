# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --chmod=644 package*.json ./
COPY --chown=node:node prisma ./prisma
COPY --chmod=644 prisma.config.ts ./
RUN --mount=type=secret,id=proxy_ca if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --chmod=644 package*.json ./
COPY --chmod=644 prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node server ./server
COPY --chmod=644 docker-entrypoint.sh ./
RUN mkdir -p /app/data && chown -R node:node /app/data
ENV NODE_ENV=production PORT=8002 DATABASE_URL=file:/app/data/personal-os.db
USER node
EXPOSE 8002
HEALTHCHECK --interval=30s --start-period=30s CMD node -e "fetch('http://127.0.0.1:8002/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
