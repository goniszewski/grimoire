# Little Imp - Local-first bookmark manager
# Multi-stage build for production-ready container

# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package*.json bun.lock* ./
COPY daemon/package*.json daemon/bun.lock* ./daemon/

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Build frontend
RUN cd daemon && bun install --frozen-lockfile
RUN npm run build

# Production stage
FROM oven/bun:1-slim AS runtime

# Create non-root user
RUN groupadd -r littleimp && useradd -r -g littleimp littleimp

# Install necessary system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/daemon ./daemon
COPY --from=builder /app/package.json ./

# Create data directory
RUN mkdir -p /data && chown littleimp:littleimp /data

# Switch to non-root user
USER littleimp

# Environment variables
ENV HOST=0.0.0.0
ENV PORT=3210
ENV DATA_DIR=/data
ENV NODE_ENV=production
ENV LOG_FORMAT=json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3210/health || exit 1

# Expose port
EXPOSE 3210

# Volume for persistent data
VOLUME ["/data"]

# Start command
CMD ["bun", "run", "daemon:start"]
