# ── Stage 1: build native deps (better-sqlite3) ──────────────────────────────
FROM node:20-alpine AS builder

# build tools needed to compile better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# ── Stage 2: lean runtime image ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# copy native modules + prod deps from builder
COPY --from=builder /app/node_modules ./node_modules
# copy source
COPY . .

# SQLite file lives in a Docker volume mounted at /data
ENV DB_PATH=/data/volleyops.db
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Create the data dir in case the volume isn't mounted
RUN mkdir -p /data

CMD ["node", "server.js"]
