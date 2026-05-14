# Little Imp Release Checklist

Release target: `0.1.0-beta`

Use this checklist before tagging or publishing a beta build.

## Install

- Run `cd daemon && ./install.sh` on a clean macOS profile or VM.
- Verify `curl http://127.0.0.1:3210/health` returns `version: "0.1.0-beta"`.
- Verify LaunchAgent or systemd user service starts the daemon after login.
- Run `./install.sh --upgrade` over an existing install and confirm data is preserved.
- Run `./install.sh --uninstall` and confirm application data remains unless `--purge` is used.

## Docker

- Run `docker compose up -d`.
- Confirm the app opens at `http://127.0.0.1:3210`.
- Confirm `docker compose ps` reports the container as healthy.
- Confirm Compose keeps the host port bound to `127.0.0.1:3210:3210`.
- Run `docker compose down` and confirm the named data volume is preserved.

## Backup And Restore

- Create a local backup from Settings or `POST /backup`.
- Verify the snapshot contains `snapshot.db`, `manifest.json`, `checksums.sha256`, and `data/settings.json`.
- Restore the snapshot from Settings or `POST /restore`.
- Confirm restore creates a rollback directory and returns `restart_required: true`.
- Restart the daemon and confirm bookmarks and non-secret settings are restored while local secrets are preserved.

## CI And Quality Gates

- Run `npm run check`.
- Run `npm run test:e2e`.
- Build the Docker image and run the container health check.
- Confirm GitHub Actions is green for lint, type-checks, tests, API docs drift, build, E2E, and Docker validation.

## Documentation

- Run `npm run docs:api:check`.
- Confirm `README.md`, `docs/roadmap.md`, `docs/prd.md`, `CHANGELOG.md`, `SECURITY.md`, and `tasks/README.md` all name `0.1.0-beta` as the current release target.
- Confirm links in `README.md`, `CONTRIBUTING.md`, and `tasks/README.md` resolve to existing files.
- Confirm backup, Docker, MCP, and API source-of-truth docs match the shipped routes and defaults.
