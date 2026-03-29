# Docker Deployment Guide

This guide covers deploying Little Imp using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 1.29+ (or Docker Desktop)
- At least 2GB RAM available
- 1GB disk space for the image

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/goniszewski/little-imp.git
   cd little-imp
   ```

2. **Start with Docker Compose:**

   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   Open your browser to `http://localhost:3210`

### Using Docker Directly

1. **Build the image:**

   ```bash
   docker build -t little-imp .
   ```

2. **Run the container:**

   ```bash
   docker run -d \
     -p 3210:3210 \
     -v little-imp-data:/data \
     --name little-imp \
     little-imp
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Host to bind the daemon to |
| `PORT` | `3210` | Port to listen on |
| `DATA_DIR` | `/data` | Directory for SQLite database and files |
| `NODE_ENV` | `production` | Environment mode |
| `LOG_FORMAT` | `json` | Log format (json/pretty) |
| `LLM_PROVIDER` | - | AI provider (ollama/openai) |
| `LLM_API_KEY` | - | API key for AI provider |
| `LLM_MODEL` | - | AI model to use |
| `EMBEDDING_PROVIDER` | - | Embedding provider |
| `EMBEDDING_API_KEY` | - | API key for embeddings |

### Docker Compose with AI Integration

```yaml
version: '3.8'

services:
  little-imp:
    build: .
    ports:
      - "3210:3210"
    volumes:
      - little-imp-data:/data
    environment:
      - LLM_PROVIDER=ollama
      - LLM_MODEL=llama2
      - EMBEDDING_PROVIDER=ollama
      - EMBEDDING_MODEL=nomic-embed-text
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama

volumes:
  little-imp-data:
  ollama-data:
```

## Advanced Usage

### Custom Configuration

Create a `docker-compose.override.yml` file:

```yaml
version: '3.8'

services:
  little-imp:
    environment:
      - LLM_PROVIDER=openai
      - LLM_API_KEY=${OPENAI_API_KEY}
      - LLM_MODEL=gpt-3.5-turbo
      - EMBEDDING_PROVIDER=openai
      - EMBEDDING_API_KEY=${OPENAI_API_KEY}
      - EMBEDDING_MODEL=text-embedding-ada-002
```

### Persistent Storage

The Docker setup uses named volumes for data persistence:

- `little-imp-data`: Contains SQLite database and user data
- `ollama-data`: Contains AI models (if using Ollama)

To backup your data:

```bash
# Backup volume
docker run --rm -v little-imp-data:/data -v $(pwd):/backup alpine tar czf /backup/little-imp-backup.tar.gz /data

# Restore volume
docker run --rm -v little-imp-data:/data -v $(pwd):/backup alpine tar xzf /backup/little-imp-backup.tar.gz -C /
```

### Network Configuration

For production deployments, consider:

```yaml
version: '3.8'

services:
  little-imp:
    build: .
    ports:
      - "127.0.0.1:3210:3210"  # Localhost only
    networks:
      - little-imp-network
    environment:
      - HOST=0.0.0.0
      - PORT=3210

networks:
  little-imp-network:
    driver: bridge
    internal: false
```

## Development with Docker

### Hot Reload Development

For development with hot reload:

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  little-imp-dev:
    build:
      context: .
      target: builder
    ports:
      - "3210:3210"
      - "5173:5173"  # Vite dev server
    volumes:
      - .:/app
      - /app/node_modules
      - /app/daemon/node_modules
    environment:
      - NODE_ENV=development
      - LOG_FORMAT=pretty
    command: ["sh", "-c", "npm run dev & cd daemon && bun run dev"]
```

Run with:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Monitoring and Health

### Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker ps

# Manual health check
docker exec little-imp curl -f http://localhost:3210/health
```

### Logs

```bash
# View logs
docker logs little-imp

# Follow logs
docker logs -f little-imp

# View daemon logs only
docker exec little-imp tail -f /data/logs/daemon.log
```

## Troubleshooting

### Common Issues

1. **Port already in use:**

   ```bash
   # Change port in docker-compose.yml
   ports:
     - "3211:3210"  # Map to different host port
   ```

2. **Permission denied:**

   ```bash
   # Ensure data directory has correct permissions
   docker exec little-imp chown -R littleimp:littleimp /data
   ```

3. **AI features not working:**

   ```bash
   # Check AI service connectivity
   docker exec little-imp curl -f http://ollama:11434/api/tags
   ```

### Debug Mode

```bash
# Run with debug logging
docker run -d \
  -p 3210:3210 \
  -v little-imp-data:/data \
  -e LOG_LEVEL=debug \
  --name little-imp \
  little-imp
```

## Production Deployment

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name little-imp.example.com;
    
    location / {
        proxy_pass http://localhost:3210;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL/TLS with Let's Encrypt

Use Docker Compose with nginx-proxy:

```yaml
version: '3.8'

services:
  little-imp:
    build: .
    environment:
      - VIRTUAL_HOST=little-imp.example.com
      - LETSENCRYPT_HOST=little-imp.example.com
      - LETSENCRYPT_EMAIL=admin@example.com
    volumes:
      - little-imp-data:/data

  nginx-proxy:
    image: nginxproxy/nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - conf:/etc/nginx/conf.d
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
      - certs:/etc/nginx/certs
      - /var/run/docker.sock:/tmp/docker.sock:ro

  letsencrypt:
    image: nginxproxy/acme-companion
    volumes:
      - certs:/etc/nginx/certs
      - html:/usr/share/nginx/html
      - vhost:/etc/nginx/vhost.d
      - /var/run/docker.sock:/var/run/docker.sock:ro

volumes:
  little-imp-data:
  conf:
  vhost:
  html:
  certs:
```

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove images
docker rmi little-imp

# Remove everything
docker system prune -a
```

## Security Considerations

- **Run as non-root user** (already configured in Dockerfile)
- **Use environment variables** for sensitive configuration
- **Regular security updates** of base images
- **Network isolation** in production
- **Volume encryption** for sensitive data
- **Access logging** and monitoring

## Performance Tuning

### Resource Limits

```yaml
services:
  little-imp:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### Caching

For production deployments, consider adding:

- Redis for caching (if implementing caching layer)
- CDN for static assets
- Database connection pooling

## Support

For Docker-specific issues:

1. Check container logs: `docker logs little-imp`
2. Verify health status: `docker ps`
3. Test connectivity: `curl http://localhost:3210/health`
4. Review configuration in docker-compose.yml
5. Check GitHub issues for known problems

For general Little Imp support, see the main documentation.
