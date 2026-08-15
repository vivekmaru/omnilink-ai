# ==============================================================================
# OmniLink AI - Multi-Stage Production Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend and Server Bundle
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native build tools for better-sqlite3 and esbuild
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for compilation)
RUN npm ci

# Copy source code and configuration files
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY server/ ./server/
COPY server.ts ./
COPY public/ ./public/

# Compile production Vite client bundle and esbuild server bundle (dist/server.cjs)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install runtime utilities (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Remove build tools after compiling native addons
RUN apt-get purge -y python3 make g++ && apt-get autoremove -y

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create persistent data directory
RUN mkdir -p /app/data

# Persistent volume for SQLite database (omnilink.db and WAL files)
VOLUME ["/app/data"]

# Healthcheck to verify server and SQLite health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
