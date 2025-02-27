FROM --platform=$BUILDPLATFORM oven/bun:1.2 AS builder
LABEL maintainer="Grimoire Developers <contact@grimoire.pro>"
LABEL description="Bookmark manager for the wizards"
LABEL org.opencontainers.image.source="https://github.com/goniszewski/grimoire"

RUN mkdir -p /etc/s6-overlay/s6-rc.d/grimoire /etc/s6-overlay/s6-rc.d/user/contents.d && \
    mkdir -p /app/data

# Different build strategy based on architecture
ARG TARGETARCH
RUN if [ "${TARGETARCH}" = "arm64" ]; then \
      # ARM64 build - avoid libc-bin issues
      apt-get update && \
      apt-mark hold libc-bin && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        xz-utils wget python3 python3-pip build-essential && \
      rm -rf /var/lib/apt/lists/*; \
    else \
      # Standard installation for other architectures
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        xz-utils python3 python3-pip wget build-essential && \
      rm -rf /var/lib/apt/lists/*; \
    fi

ARG S6_OVERLAY_VERSION=3.1.6.2
RUN case "${TARGETARCH}" in \
        "amd64") S6_ARCH="x86_64" ;; \
        "arm64") S6_ARCH="aarch64" ;; \
        "386") S6_ARCH="i686" ;; \
        "arm/v7") S6_ARCH="armhf" ;; \
        "arm/v6") S6_ARCH="arm" ;; \
        *) S6_ARCH="x86_64" && echo "Warning: Unknown architecture ${TARGETARCH}, defaulting to x86_64" ;; \
    esac && \
    echo "Architecture: Docker ${TARGETARCH} -> s6-overlay ${S6_ARCH}" && \
    wget -q -O /tmp/s6-overlay-noarch.tar.xz https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz && \
    wget -q -O /tmp/s6-overlay-${S6_ARCH}.tar.xz https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-${S6_ARCH}.tar.xz && \
    rm /tmp/s6-overlay-*xz

COPY docker/etc/s6-overlay /etc/s6-overlay/
RUN chmod +x /etc/s6-overlay/s6-rc.d/grimoire/run

ENV S6_KEEP_ENV=1 \
    S6_SERVICES_GRACETIME=15000 \
    S6_KILL_GRACETIME=10000 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
    S6_SYNC_DISKS=1

RUN bun i -g svelte-kit@latest

RUN adduser --disabled-password --gecos '' grimoire
RUN mkdir -p /app/data && chown -R grimoire:grimoire /app/data && chmod 766 /app/data
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
ENV NODE_ENV=production \
    PUBLIC_ORIGIN=${PUBLIC_ORIGIN:-http://localhost:5173} \
    ORIGIN=${PUBLIC_ORIGIN:-http://localhost:5173} \
    PORT=${PORT:-5173} \
    PUBLIC_HTTPS_ONLY=${PUBLIC_HTTPS_ONLY:-false} \
    PUBLIC_SIGNUP_DISABLED=${PUBLIC_SIGNUP_DISABLED:-false} \
    BODY_SIZE_LIMIT=${BODY_SIZE_LIMIT:-5000000}

RUN chmod +x /docker-entrypoint.sh
USER grimoire
EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/api/health || exit 1
ENTRYPOINT ["/docker-entrypoint.sh"]
