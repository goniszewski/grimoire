# TASK-042: Fix Docker Distribution and Network Safety

**Status:** todo
**Priority:** high
**Phase:** v0-beta hardening
**Area:** Docker, daemon, security, docs

## Description

Docker is documented as a user-facing install path, but the current container setup conflicts with the local-only security model. `docker-compose.yml` publishes `3210:3210`, `npm run docker:run` uses `-p 3210:3210`, and the image sets `HOST=0.0.0.0`, exposing an unauthenticated daemon outside localhost on many Docker setups. The Dockerfile also copies the built frontend into the runtime image, but the daemon app only registers API routes, so the documented `http://localhost:3210` application path is not clearly served by the daemon.

This task makes Docker either a secure local-only single-container app or explicitly documents a safe two-service deployment.

## Current evidence

- `Dockerfile` copies `/app/dist` into the runtime image, but the daemon route set is API-only.
- `docker-compose.yml` publishes `3210:3210` and sets `HOST=0.0.0.0`.
- `package.json` has `docker:run` with `docker run -d -p 3210:3210 ...`.
- `SECURITY.md` says the daemon listens only on `127.0.0.1:3210`.

## Dependencies / sequencing

- Do after TASK-041 or keep AI examples generic until runtime settings are unified.
- Coordinate with TASK-047 for final README, SECURITY.md, and roadmap wording after the Docker behavior is decided.

## Work

1. Decide the production Docker topology:
   - single container serving both REST API and `dist`, or
   - daemon-only container plus a separate static frontend service.
2. If single-container, add static file serving for `dist` with SPA fallback.
3. Change default Compose port publishing to localhost-only: `127.0.0.1:3210:3210`.
4. Change `npm run docker:run` examples and README snippets to publish `127.0.0.1:3210:3210`.
5. Keep container-internal `HOST=0.0.0.0` only when the host port is bound safely.
6. Update CORS defaults or Docker-specific config if the selected frontend topology needs a non-dev origin.
7. Update Docker docs to remove or clearly gate any public reverse-proxy deployment behind authentication.
8. Update AI configuration examples to match the real settings model from TASK-041.
9. Validate the image build and container health check in CI or a documented release checklist.

## Acceptance Criteria

- [ ] `docker compose up -d` starts a healthy Little Imp deployment.
- [ ] `http://127.0.0.1:3210` loads the intended application or docs clearly state the correct frontend URL.
- [ ] The default Compose file does not expose the unauthenticated daemon on non-loopback interfaces.
- [ ] The root `docker:run` script does not expose the unauthenticated daemon on non-loopback interfaces.
- [ ] Docker docs and SECURITY.md agree on the trust boundary.
- [ ] `docker build -t little-imp .` completes in a clean environment.
- [ ] The container health check passes after startup.
