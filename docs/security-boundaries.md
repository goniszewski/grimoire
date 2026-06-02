# Daemon Network Exposure Security Boundaries

Date: 2026-05-31
Status: current Grimoire parity boundary
Task: TASK-087

This document defines the security boundary for Little Imp's local daemon and
local integration clients. It records the current loopback-only threat model,
the minimum controls required for local integrations, and the release gates
that must be satisfied before any future public-network mode can be considered.

Little Imp remains local-first, single-user, and loopback-first for the current
Grimoire parity batch. This document does not approve LAN, public internet,
multi-user, or hosted server deployment.

## Security Posture

The supported default posture is:

- Native daemon bind address: `127.0.0.1:3210`.
- Docker host port publishing: `127.0.0.1:3210:3210`.
- First-party browser UI: trusted only from the daemon origin or configured
  loopback development origins.
- Local clients: explicit same-machine tools such as the packaged CLI, MCP
  clients, and user-authored scripts.
- Data ownership: a single local user profile and a local SQLite database under
  the configured `DATA_DIR`.

The daemon now has a scoped authentication layer for explicit local integration
surfaces such as MCP and protected local bookmark capture. The first-party
loopback browser app remains tokenless inside the local origin boundary.
General REST routes are still loopback-only, and tokenless for first-party use,
but presented `Authorization` headers are validated as integration bearer
tokens. Any process on the same machine that can reach the loopback port remains
in the local trust model unless a route is explicitly protected by integration
token middleware.

## In Scope

These clients are in scope for the current parity batch:

- The first-party React app served by the daemon or by local Vite dev origins.
- The packaged `littleimp` CLI talking to the local daemon.
- MCP clients intentionally configured by the user against `/mcp`.
- Local capture clients intentionally configured by the user against
  protected `/capture`.
- Local scripts or tools explicitly pointed at `http://127.0.0.1:3210`.

These controls are in scope:

- Keeping loopback binding as the default secure mode.
- Conservative browser origin and CORS handling.
- Bearer-token authentication for local non-browser integration clients.
- Secret redaction in Settings, diagnostics, logs, and backups.
- Explicit user setup for integrations that receive tokens.
- Release checklist gates that block accidental public exposure.

## Out Of Scope

The current parity batch does not include:

- Binding the native daemon to `0.0.0.0`, a LAN address, or a public interface.
- Public reverse-proxy examples that pass requests directly to Little Imp.
- Multi-user accounts, sessions, admin roles, or per-user data partitions.
- Packaged browser-extension or bookmarklet clients and compatibility smoke
  tests.
- Grimoire-compatible endpoint aliases.
- Public MCP, backup, diagnostics, update, or Settings endpoints.

If a user needs remote access today, an authenticated tunnel, VPN, or reverse
proxy must enforce access control before traffic reaches Little Imp. That is an
operator-owned wrapper, not a Little Imp public-server mode.

## Assets And Trust Boundaries

| Boundary | Assets | Current trust assumption | Required controls |
| --- | --- | --- | --- |
| Browser UI to daemon | Bookmarks, notes, categories, tags, settings, backups | First-party loopback browser origins are trusted | Unsafe browser requests require an allowed loopback `Origin`; non-loopback configured CORS origins are ignored |
| Local non-browser clients to daemon | API, MCP, and protected capture operations | Explicit same-machine clients are intended; untrusted local processes remain part of the loopback trust model | `/mcp` and `/capture` require managed bearer tokens; general REST routes remain loopback-only unless separately protected |
| Daemon to SQLite | Bookmark library, content, embeddings, jobs, timeline, settings references | Local daemon owns the database | SQLite remains under `DATA_DIR`; migrations preserve user data |
| Daemon to filesystem | Backups, logs, settings, restore rollbacks | Local user controls filesystem permissions | Path traversal checks, safe backup names, checksum verification, rollback directories |
| Daemon to fetched bookmark URLs | Extracted content and metadata | User-supplied public URLs can be hostile | Private and loopback host blocking, request timeouts, response size and content-type limits |
| Daemon to AI providers | Extracted content, summaries, tags, embeddings, API keys | Providers are optional user configuration | Keys stay local and redacted; no provider is required for core use |
| Daemon to S3-compatible backups | Backup snapshots, non-secret settings | Optional user-managed remote destination | Local snapshot first, settings secrets omitted, S3 credentials redacted |
| Daemon to update source | Release metadata | Default public GitHub source or user-provided source | Daemon update checks reject private and loopback source hosts; installs verify checksums and signatures where available |

## Current Threat Model

### Local process access

Any local process that can reach `127.0.0.1:3210` can call unprotected daemon
REST routes. Protected integration surfaces, including `/mcp` and `/capture`,
require managed bearer tokens, but general loopback process trust remains part of the
local-first threat model. On multi-user machines, local access can include
processes outside the active desktop session if the host allows them to connect
to loopback. Users should protect their OS account, avoid untrusted local
processes, and not expose the daemon socket to other machines.

### Malicious websites

A malicious public website may try to send browser requests to the local
daemon. The daemon rejects unsafe browser requests from non-loopback origins,
and CORS only reflects allowed loopback origins. GET and HEAD routes must remain
read-only and must not perform state-changing operations.

### Public-network exposure

Public-network exposure is not approved. If Little Imp is reachable from other
machines without an authenticated wrapper, tokenless REST routes and sensitive
route families such as MCP, diagnostics, backup, restore, update, and Settings
become remote attack surface.

### Server-side request forgery

Bookmark ingestion, import, and update-source handling must not let user input
target local services or private networks. Current network helpers block
syntactic private, loopback, link-local, and unspecified hosts. DNS rebinding is
not fully mitigated and is accepted only because the daemon is local-only.

### Local file access

Backup and restore operations interact with local files and are high-impact.
Routes validate JSON object bodies, backup names, checksum paths, package paths,
and destination settings. Restore verifies manifest/checksum data, creates a
rollback directory, replaces local data, and requires daemon restart.

### Secret disclosure

Secrets include AI API keys, embedding keys, app lock PIN hashes, S3 access
keys, backup package passwords, URL credentials/query strings, bookmark
contents, personal notes, and embedding vectors. Settings responses, portable
settings backups, diagnostics, and logs must continue to redact or omit them.

## Route Family Requirements

| Route family | Current boundary | Future public-network requirement |
| --- | --- | --- |
| Health | May expose status and version on loopback | Public mode may expose only minimal health through an authenticated or intentionally public endpoint |
| Bookmarks, search, categories, tags, timeline, suggestions | Loopback-only local library operations | Require authentication, authorization semantics, origin policy, rate limits, and audit expectations |
| Import and reprocess | Loopback-only expensive local operations with body limits | Require authentication, stricter quotas, private-host protections, and explicit user confirmation for expensive work |
| Backup and restore | Loopback-only high-impact data operations with checksum, path, and concurrency guards | Require strong auth, reauthentication or confirmation, CSRF protection, least-privilege file access, and reviewed remote restore behavior |
| Diagnostics | Loopback-only local support payload with redaction | Require authentication and user-visible export controls; must not expose contents, notes, vectors, or secrets |
| Settings | Loopback-only runtime configuration; API keys are write-only/redacted | Require authentication, authorization, CSRF protection, and secret-handling review |
| MCP | Loopback-only local integration endpoint protected by managed bearer tokens | Public MCP requires a separate security design |
| Updates | Read-only daemon check rejects private/loopback sources; CLI install verifies artifacts | Public mode must preserve source restrictions, artifact verification, explicit user control, and rollback guidance |

## Local Integration Controls

TASK-102 implements the bearer-token baseline for MCP. TASK-106 adds the
browser origin and CORS policy for local integration clients:

- Bearer tokens are for explicit local non-browser integration clients. They
  are currently required by `/mcp` and may be presented to regular REST routes
  for validation without becoming mandatory for the first-party app.
- Token setup must be deliberate and visible to the user.
- Tokens must be stored locally as hashes, redacted from list output,
  diagnostics, logs, and settings output, rotatable, and revocable.
- First-party loopback browser behavior may remain tokenless only while the
  daemon stays loopback-bound and unsafe browser writes remain origin-checked.
- CORS allowlists stay loopback-only unless a future public-network design is
  approved. `CORS_ORIGINS` may add local browser clients such as
  `http://localhost:5173` or `http://127.0.0.1:4321`, but non-loopback entries
  are ignored even if configured.
- Browser requests without an `Origin` header are treated as non-browser local
  client traffic and do not receive CORS reflection.
- Unsafe browser writes and CORS preflights from rejected origins return `403`
  without reflecting `Access-Control-Allow-Origin`.
- Non-browser clients should not depend on browser CORS for security.
- If cookie or session auth is ever added, CSRF protection becomes mandatory for
  unsafe methods.

## Public-Network Release Gates

Before any Little Imp mode can bind beyond loopback or document direct public
network use, all of these gates must be complete:

1. A product decision explicitly approves the non-loopback mode and names its
   supported audience.
2. This threat model is updated for remote attackers, cross-user isolation, and
   operational ownership.
3. Authentication is implemented for REST and MCP traffic that can read or
   mutate user data.
4. Authorization and data scoping are defined if more than one user or profile
   can exist.
5. CORS and browser origin policy are reviewed for the new deployment shape.
6. CSRF protections are added for any browser-authenticated unsafe method.
7. Backup, restore, diagnostics, Settings, MCP, and update routes receive
   route-specific security review.
8. Secrets, logs, diagnostics, and portable backups are rechecked for remote
   disclosure risks.
9. Rate limits, request body limits, and expensive-operation quotas are defined.
10. TLS, reverse proxy, tunnel, or VPN assumptions are documented.
11. Automated tests cover rejected unauthenticated access, rejected origins,
    protected sensitive routes, and safe error responses.
12. Release notes and the release checklist explicitly state the supported
    exposure mode and validation evidence.

If any gate is incomplete, release planning must treat public exposure as
blocked.

## Implementation References

- Default bind host and CORS configuration: `daemon/src/config.ts`.
- Daemon startup bind: `daemon/src/index.ts`.
- Origin checks, CORS reflection, browser hardening headers, and body limits:
  `daemon/src/server.ts`.
- Private and loopback host detection: `daemon/src/lib/network.ts`.
- Diagnostics redaction: `daemon/src/routes/diagnostics.ts` and
  `docs/diagnostics.md`.
- Backup/restore safeguards: `daemon/src/routes/backup.ts` and
  `docs/backup-design.md`.
- MCP route: `daemon/src/routes/mcp.ts`.
- Update source restrictions: `daemon/src/update/service.ts` and
  `docs/update-system.md`.
- Docker loopback deployment guidance: `docs/docker-deployment.md`.
- Security regression tests: `daemon/src/test/integration/security-hardening.test.ts`,
  `daemon/src/test/integration/diagnostics.test.ts`, and
  `daemon/src/test/integration/updates.test.ts`.
