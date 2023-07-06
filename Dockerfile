FROM node:18-alpine AS base
RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm


FROM base AS builder
WORKDIR /app
COPY package*.json .

RUN pnpm install

COPY . .

RUN pnpm build
RUN pnpm prune --production


FROM base AS installer
WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/.svelte-kit/output/ /.svelte-kit/output/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .

EXPOSE 3000

ENV NODE_ENV=production

CMD [ "pnpm", "start" ]