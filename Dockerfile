# ── Stage 1: build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# better-sqlite3 native addon needs Python + C++ toolchain at compile time
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY src/          ./src/
COPY tsconfig.json tsup.config.ts ./
RUN npm run build

# Prune devDeps so the copied node_modules is production-only
RUN npm prune --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────
FROM node:20-alpine

# Non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Copy compiled output and pruned deps from builder — no build tools needed here
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# SQLite cache directory owned by the app user
RUN mkdir -p /home/app/.google-map-mcp && chown -R app:app /app /home/app/.google-map-mcp

USER app

ENV NODE_ENV=production
ENV TRANSPORT=sse
ENV PORT=3000
ENV CACHE_DB_PATH=/home/app/.google-map-mcp/cache.db

EXPOSE 3000

CMD ["node", "dist/index.js"]
