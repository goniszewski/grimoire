FROM node:20-slim AS base
RUN corepack enable
RUN apt-get update && apt-get install -y python3 python3-pip wget build-essential && rm -rf /var/lib/apt/lists/*
RUN npm i -g bun@latest
WORKDIR /usr/src/app

FROM base AS install
WORKDIR /temp/dev
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile || (echo "Bun install failed" && cat ~/.bun/install.log && exit 1)

WORKDIR /temp/prod
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production || (echo "Bun install failed" && cat ~/.bun/install.log && exit 1)

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ARG PUBLIC_ORIGIN="http://localhost:5173"
ARG PORT=5173
ARG PUBLIC_HTTPS_ONLY="false"
ARG PUBLIC_SIGNUP_DISABLED="false"
ARG BODY_SIZE_LIMIT="5000000"
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=8192
RUN bun --bun run build

ENV PUBLIC_ORIGIN=$PUBLIC_ORIGIN
ENV ORIGIN=$PUBLIC_ORIGIN
ENV PORT=$PORT
ENV PUBLIC_HTTPS_ONLY=$PUBLIC_HTTPS_ONLY
ENV PUBLIC_SIGNUP_DISABLED=$PUBLIC_SIGNUP_DISABLED
ENV BODY_SIZE_LIMIT=$BODY_SIZE_LIMIT

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app .
ENV NODE_ENV=production
EXPOSE $PORT
ENTRYPOINT [ "bun","./build/index.js" ]