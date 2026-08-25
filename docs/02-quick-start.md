# Quick start

The fastest path to explore the UI is the [hosted public demo](https://goniszewski.com/grimoire/demo/).
It is a static, client-only build with synthetic session data and no hosted
library. For a private local library, use Docker below.

## Run locally with Docker

One container serves the UI and the API on your machine only.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) v2

## Steps

### 1. Clone and start

```sh
git clone https://github.com/goniszewski/grimoire.git
cd grimoire
docker compose up -d
```

The first run **builds the image from the local Dockerfile**. That can take several minutes. Later starts reuse the image.

### 2. Check health

```sh
curl http://127.0.0.1:3210/health
```

Wait until this succeeds before opening the UI.

### 3. Open the app

Open [http://127.0.0.1:3210](http://127.0.0.1:3210).

The compose file publishes `127.0.0.1:3210:3210`, so the host port is loopback-only. Data lives in the `grimoire-data` Docker volume.

Optional AI keys can be seeded in `docker-compose.yml` for first start; day-to-day provider settings live in **Settings** inside the app.

## Next

- [Using Grimoire](./03-using-grimoire.md)
- [Development](./04-development.md)
- [Install without Docker](./05-install-without-docker.md)
- Longer Docker notes: [docker-deployment.md](./docker-deployment.md)
