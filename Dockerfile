# Base stage
FROM oven/bun AS base
LABEL maintainer="Grimoire Developers <contact@grimoire.pro>"
LABEL version="0.4.0"
LABEL description="Bookmark manager for the wizards"
LABEL org.opencontainers.image.source="https://github.com/goniszewski/grimoire"

RUN apt-get update && apt-get install -y python3 python3-pip wget build-essential && \
    rm -rf /var/lib/apt/lists/* && \
    bun i -g svelte-kit@latest

RUN adduser --disabled-password --gecos '' grimoire
RUN mkdir -p /app/data && chown -R grimoire:grimoire /app/data && chmod 755 /app/data
WORKDIR /app

FROM base AS dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN bun run svelte-kit sync
ARG PUBLIC_ORIGIN="http://localhost:5173"
ARG PORT=5173
ARG PUBLIC_HTTPS_ONLY="false"
ARG PUBLIC_SIGNUP_DISABLED="false"
ARG BODY_SIZE_LIMIT="5000000"
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096"
RUN bun --bun run build

FROM base AS release
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/migrate.js ./migrate.js
COPY --from=build /app/package.json ./package.json
ENV NODE_ENV=production \
    PUBLIC_ORIGIN=${PUBLIC_ORIGIN:-http://localhost:5173} \
    ORIGIN=${PUBLIC_ORIGIN:-http://localhost:5173} \
    PORT=${PORT:-5173} \
    PUBLIC_HTTPS_ONLY=${PUBLIC_HTTPS_ONLY:-false} \
    PUBLIC_SIGNUP_DISABLED=${PUBLIC_SIGNUP_DISABLED:-false} \
    BODY_SIZE_LIMIT=${BODY_SIZE_LIMIT:-5000000}

USER grimoire
EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/api/health || exit 1
ENTRYPOINT ["sh", "-c", "bun --bun run run-migrations && bun ./build/index.js"]
