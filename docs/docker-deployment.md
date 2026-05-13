# Docker Deployment Guide

This guide covers the supported Docker path for Little Imp: one local-only
container that serves both the React frontend and the daemon API on port 3210.

Little Imp has no authentication layer. Do not publish the daemon on a public
interface unless you put it behind authentication, a VPN, or another trusted
access control layer.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2 (`docker compose`)
- At least 2 GB RAM available
- 1 GB disk space for the image and local data

## Quick Start

```sh
git clone https://github.com/goniszewski/little-imp.git
cd little-imp
docker compose up -d
```

Open `http://127.0.0.1:3210`.

The default Compose file publishes `127.0.0.1:3210:3210`, so the container is
reachable from the host machine only. Inside the container, the daemon still
uses `HOST=0.0.0.0` so Docker can forward the loopback-bound host port into the
container.

## Docker Directly

```sh
docker build -t little-imp .
docker run -d \
  -p 127.0.0.1:3210:3210 \
  -v little-imp-data:/data \
  --name little-imp \
  little-imp
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

Example OpenAI override:

```yaml
services:
  little-imp:
    environment:
      - LLM_API_KEY=${OPENAI_API_KEY}
      - LLM_MODEL=gpt-4o-mini
      - EMBEDDING_API_KEY=${OPENAI_API_KEY}
      - EMBEDDING_MODEL=text-embedding-3-small
```

## Local Ollama

If you enable the optional Ollama service in `docker-compose.yml`, configure
Little Imp through Settings or the API after startup:

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

The `little-imp-data` volume contains the SQLite database, backups, and runtime
data. Prefer the in-app backup/restore flow for portable snapshots.

For emergency volume-level backup:

```sh
docker run --rm \
  -v little-imp-data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/little-imp-data.tar.gz /data
```

For emergency volume-level restore, stop Little Imp first:

```sh
docker compose down
docker run --rm \
  -v little-imp-data:/data \
  -v "$PWD":/backup \
  alpine tar xzf /backup/little-imp-data.tar.gz -C /
docker compose up -d
```

## Health and Logs

```sh
docker compose ps
docker exec little-imp curl -f http://localhost:3210/health
docker logs -f little-imp
```

The container health check calls `http://localhost:3210/health` from inside the
container. From the host, use `http://127.0.0.1:3210/health`.

## Changing the Local Port

Keep the host address bound to `127.0.0.1` when changing ports:

```yaml
services:
  little-imp:
    ports:
      - "127.0.0.1:3211:3210"
```

Then open `http://127.0.0.1:3211`.

## Remote Access

Little Imp is designed for local-first, single-user use and does not authenticate
API requests. Public reverse proxy examples are intentionally omitted. If you
need remote access, put the service behind an authenticated tunnel, VPN, or
reverse proxy that enforces authentication before traffic reaches Little Imp.

Do not use these unsafe port mappings:

```yaml
ports:
  - "3210:3210"
  - "0.0.0.0:3210:3210"
```

## Cleanup

```sh
docker compose down

# Deletes all Little Imp Docker data.
docker compose down -v

docker rmi little-imp
```
