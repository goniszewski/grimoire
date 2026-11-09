# Docker Deployment Guide

This guide covers the supported Docker path for Grimoire: one local-only
container that serves both the React frontend and the daemon API on port 3210.

Grimoire has scoped bearer-token authentication for local integration
surfaces such as MCP, but the first-party browser app and general REST API
still rely on the deployment's network and browser-origin boundary. Do not
publish the daemon on a public interface unless you put it behind
authentication, a VPN, or another trusted access control layer.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2 (`docker compose`)
- At least 2 GB RAM available
- 1 GB disk space for the image and local data

## Quick Start

Pull the published image (no build required):

```sh
git clone https://github.com/goniszewski/grimoire.git
cd grimoire
docker compose up -d
```

Compose pulls `goniszewski/grimoire:1.3.1` for `linux/amd64` and `linux/arm64`.
Override the version with `GRIMOIRE_VERSION=<x.y.z> docker compose up -d`, or
build from source with `docker compose build`.

### Image tags

| Tag | Meaning |
|-----|---------|
| `X.Y.Z` | Exact release. Recommended for reproducible installs. |
| `X.Y` | Latest patch of a minor release. |
| `latest` | Latest tested 1.x release. Moved manually after smoke tests. |
| `legacy-v0.5` | The pre-1.0 image that `latest` used to point to. Preserved for rollback. |

> **Upgrading from v0.5?** `latest` is no longer the v0.5 app, and 1.x is not a
> drop-in upgrade: the data layout changed from `/app/data` to `/data`. Do not
> point an existing v0.5 volume at the new image. Follow
> [Migrating from v0.5 Docker](#migrating-from-v05-docker) first.

Open `http://127.0.0.1:3210`.

The default Compose file publishes `127.0.0.1:3210:3210`, so the container is
reachable from the host machine only. Inside the container, the daemon still
uses `HOST=0.0.0.0` so Docker can forward the loopback-bound host port into the
container.

## Docker Directly

```sh
docker build -t grimoire .
docker run -d \
  -p 127.0.0.1:3210:3210 \
  -v grimoire-data:/data \
  --name grimoire \
  grimoire
```

Open `http://127.0.0.1:3210`.

## Configuration

The Docker image sets these runtime defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Container-internal bind address. Keep host port publishing loopback-only. |
| `PORT` | `3210` | HTTP port inside the container. |
| `DATA_DIR` | `/data` | SQLite database, backups, and runtime data. |
| `XDG_CONFIG_HOME` | `/data/config` | Persisted settings directory inside the data volume. |
| `HOME` | `/data` | Writable home directory for the non-root container user. |
| `CORS_ORIGINS` | built-in loopback development origins | Comma-separated exact browser origins trusted for writes through an authenticated reverse proxy or non-default browser-facing port. |
| `NODE_ENV` | `production` | Production error responses and logging defaults. |
| `LOG_FORMAT` | `json` | Structured container logs. |

AI and embedding execution uses persisted Settings UI/API values first.
Environment variables are only first-start or unattended defaults.

| Variable | Description |
|----------|-------------|
| `LLM_API_KEY` | Seeds OpenAI LLM execution and makes the default AI provider `openai`. |
| `LLM_BASE_URL` | Optional OpenAI-compatible LLM endpoint override. |
| `LLM_MODEL` | Default OpenAI LLM model. |
| `EMBEDDING_API_KEY` | Optional embedding API key override. Falls back to `LLM_API_KEY`. |
| `EMBEDDING_BASE_URL` | Optional OpenAI-compatible embedding endpoint override. |
| `EMBEDDING_MODEL` | Default embedding model. |

Additional LLM providers are configured through persisted Settings after
startup: Anthropic, OpenRouter, custom OpenAI-compatible chat endpoints,
DeepSeek international, and Cheaper Inference each have separate API key, base
URL, and model fields.
Custom OpenAI-compatible embeddings use their own provider, API key, base URL,
and model instead of sharing the selected LLM provider.

Example OpenAI override:

```yaml
services:
  grimoire:
    environment:
      - LLM_API_KEY=${OPENAI_API_KEY}
      - LLM_MODEL=gpt-4o-mini
      - EMBEDDING_API_KEY=${OPENAI_API_KEY}
      - EMBEDDING_MODEL=text-embedding-3-small
```

## Local Ollama

If you enable the optional Ollama service in `docker-compose.yml`, configure
Grimoire through Settings or the API after startup:

```sh
curl -X PUT http://127.0.0.1:3210/settings \
  -H "Content-Type: application/json" \
  -d '{
    "ai": {
      "provider": "ollama",
      "ollama": {
        "base_url": "http://ollama:11434",
        "model": "llama3"
      },
      "embeddings": {
        "provider": "ollama",
        "model": "nomic-embed-text"
      }
    }
  }'
```

The commented Ollama port mapping is loopback-only
(`127.0.0.1:11434:11434`) so local tools can still reach Ollama without
exposing it to the network.

## Data and Backups

The `grimoire-data` volume contains the SQLite database, backups, and runtime
data. Prefer the in-app backup/restore flow for portable snapshots.

For emergency volume-level backup:

```sh
docker run --rm \
  -v grimoire-data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/grimoire-data.tar.gz /data
```

For emergency volume-level restore, stop Grimoire first:

```sh
docker compose down
docker run --rm \
  -v grimoire-data:/data \
  -v "$PWD":/backup \
  alpine tar xzf /backup/grimoire-data.tar.gz -C /
docker compose up -d
```

## Health and Logs

```sh
docker compose ps
docker exec grimoire curl -f http://localhost:3210/health
docker logs -f grimoire
```

The container health check calls `http://localhost:3210/health` from inside the
container. From the host, use `http://127.0.0.1:3210/health`.

## Changing the Local Port

Keep the host address bound to `127.0.0.1` when changing ports:

```yaml
services:
  grimoire:
    ports:
      - "127.0.0.1:3211:3210"
```

Then open `http://127.0.0.1:3211`.
The built frontend sends API requests to that same browser origin, including
the host-side port.

Because the browser origin includes the host-side port, also trust that exact
origin when recreating the container:

```sh
CORS_ORIGINS=http://127.0.0.1:3211 docker compose up -d --force-recreate
```

## Remote Access

Grimoire is designed for local-first, single-user use. Integration token auth
does not turn the daemon into a public server because most first-party REST
routes remain tokenless. Public reverse proxy configurations are intentionally
omitted because authentication varies by deployment. If you need remote access,
put the service behind an authenticated tunnel, VPN, or reverse proxy that
enforces authentication before traffic reaches Grimoire. Set `CORS_ORIGINS` to
the exact browser-facing origin so the first-party UI can make writes through
that proxy:

```sh
CORS_ORIGINS=https://grimoire.example.com docker compose up -d --force-recreate
```

The value must include the scheme and any non-default port, and may contain
comma-separated origins. Paths, credentials, and wildcards are rejected.
Changing this variable requires recreating the container. This allowlist is not
authentication; the proxy or VPN must still enforce access control.

Do not use these unsafe port mappings:

```yaml
ports:
  - "3210:3210"
  - "0.0.0.0:3210:3210"
```

## Migrating from v0.5 Docker

The v0.5 image stored data in `/app/data`; 1.x uses `/data`. Migration is
additive and never modifies the old data. Your v0.5 container keeps working on
the `legacy-v0.5` tag until you are satisfied.

1. **Back up the old data** (adjust the volume or path to your v0.5 setup):

   ```sh
   docker compose down   # run in your old v0.5 checkout
   docker run --rm -v <old-data-volume>:/app/data -v "$PWD":/backup alpine \
     tar czf /backup/grimoire-v05-data.tar.gz -C /app data
   ```

   Pin your old setup to `goniszewski/grimoire:legacy-v0.5` if you want to roll
   back later.

2. **Start 1.x with a fresh volume** (new directory or new Compose project):

   ```sh
   docker compose up -d
   ```

3. **Inspect, dry-run, then apply** with the `grimoire` CLI against the
   backup archive. See [migration.md](migration.md) for installing the CLI and
   all options:

   ```sh
   grimoire migrate inspect --archive grimoire-v05-data.tar.gz
   grimoire migrate apply --archive grimoire-v05-data.tar.gz --owner YOUR_USERNAME --dry-run
   grimoire migrate apply --archive grimoire-v05-data.tar.gz --owner YOUR_USERNAME --yes
   ```

   The CLI talks to `http://127.0.0.1:3210` by default, which is the loopback
   port the container publishes. Keep that port bound to `127.0.0.1`.

## Cleanup

```sh
docker compose down

# Deletes all Grimoire Docker data.
docker compose down -v

docker rmi grimoire
```
