FROM oven/bun AS builder
LABEL maintainer="Grimoire Developers <contact@grimoire.pro>"
LABEL description="Bookmark manager for the wizards"
LABEL org.opencontainers.image.source="https://github.com/goniszewski/grimoire"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      xz-utils python3 python3-pip wget build-essential && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /etc/s6-overlay/s6-rc.d/grimoire /etc/s6-overlay/s6-rc.d/user/contents.d

RUN mkdir -p /app/data

ARG S6_OVERLAY_VERSION=3.1.6.2
ARG TARGETARCH=x86_64
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${TARGETARCH}.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-${TARGETARCH}.tar.xz && \
    rm /tmp/s6-overlay-*xz

COPY docker/etc/s6-overlay /etc/s6-overlay/
RUN chmod +x /etc/s6-overlay/s6-rc.d/grimoire/run

ENV S6_KEEP_ENV=1 \
    S6_SERVICES_GRACETIME=15000 \
    S6_KILL_GRACETIME=10000 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
    S6_SYNC_DISKS=1

RUN bun i -g svelte-kit@latest

WORKDIR /app

FROM builder AS dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile && \
    bun install --frozen-lockfile --production

FROM builder AS build
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

FROM builder AS release

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/migrate.js ./migrate.js
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh /
COPY docker/etc/ /etc/
ENV NODE_ENV=production \
    PUBLIC_ORIGIN=${PUBLIC_ORIGIN:-http://localhost:5173} \
    ORIGIN=${PUBLIC_ORIGIN:-http://localhost:5173} \
    PORT=${PORT:-5173} \
    PUBLIC_HTTPS_ONLY=${PUBLIC_HTTPS_ONLY:-false} \
    PUBLIC_SIGNUP_DISABLED=${PUBLIC_SIGNUP_DISABLED:-false} \
    BODY_SIZE_LIMIT=${BODY_SIZE_LIMIT:-5000000}
RUN chmod +x /docker-entrypoint.sh
EXPOSE ${PORT:-5173}
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/api/health || exit 1
ENTRYPOINT ["/init"]

