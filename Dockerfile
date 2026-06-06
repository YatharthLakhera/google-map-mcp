# ── Stage 1: build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# better-sqlite3 is a native addon — needs Python + C++ toolchain
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY src/         ./src/
COPY tsconfig.json tsup.config.ts ./
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
# Production deps only — also recompiles better-sqlite3 for this image
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV TRANSPORT=sse
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
