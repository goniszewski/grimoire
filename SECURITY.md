# Security Policy For Grimoire

## Supported Versions

| Version | Supported |
| --- | --- |
| `1.0.0` | Yes |
| `0.1.0-beta` | No |

## Reporting A Vulnerability

Report security concerns privately to the maintainer contact listed in the
GitHub repository profile. If GitHub private vulnerability reporting is enabled
for the repository, that is also an appropriate channel.

Do not report security vulnerabilities through public GitHub issues.

No project-specific PGP key is currently published. If you need encrypted
coordination, ask the maintainer for a preferred secure channel before sharing
sensitive exploit details.

Please include:

- A description of the vulnerability.
- Steps to reproduce it.
- The affected version or commit.
- The potential impact.
- Any suggested remediation.

## Security Boundary Summary

Grimoire is local-first, single-user, and loopback-first for `1.0.0`.

- Native daemon default: `127.0.0.1:3210`.
- Docker host port default: `127.0.0.1:3210:3210`.
- The first-party browser UI is trusted only from the daemon origin or
  configured loopback development origins.
- General REST routes remain loopback-only and tokenless for first-party local
  use.
- MCP and protected local capture endpoints require managed local integration
  bearer tokens.
- Public-network exposure is not a supported Grimoire mode. Any remote access
  must be protected before requests reach the daemon, for example with an
  authenticated tunnel, VPN, or reverse proxy.

The canonical threat model and release gates for any future non-loopback mode
are documented in [docs/security-boundaries.md](./docs/security-boundaries.md).

## Implemented Controls

### Network Security

- Localhost-only native binding.
- Loopback-only Docker port publishing.
- Unsafe browser requests are accepted only from configured loopback origins.
- Non-loopback `CORS_ORIGINS` entries are ignored by the daemon.
- Private, loopback, link-local, and unspecified hosts are blocked for bookmark
  fetching and update-source handling where route behavior requires public
  targets.
- Request size limits and timeout protection are applied to expensive local
  operations.

### Browser Response Hardening

Static frontend and API responses include conservative browser headers,
including:

- `Content-Security-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`

Scripts are limited to the app origin, object/embed content is blocked, and
other sites cannot frame the UI.

### Input And File Validation

- Public URL validation before content fetching.
- Private-network URL blocking.
- Path traversal protection for backup, restore, verification, encrypted
  package, and release archive operations.
- Parameterized SQLite queries.
- JSON object validation for high-impact routes.
- Safe backup names and daemon-local encrypted package path checks.
- In-process guards that prevent concurrent destructive or expensive backup
  work.

### Data Protection

- SQLite WAL mode for local database consistency.
- Backup checksum verification.
- Restore rollback directory creation before data replacement.
- Settings backup omits secrets and restore preserves current local secrets.
- Encrypted backup package passwords are required per verify/restore operation
  and are not stored.
- Diagnostics omit API keys, URL credentials and query strings, app lock PIN
  hashes, S3 credentials, backup package passwords, bookmark contents, notes,
  and embeddings.
- Logs mask known secret values.

### Release Artifact Verification

- The intended one-command installer verifies the published SHA-256 checksum
  before extraction.
- Detached `.asc` signatures are verified when published or explicitly
  provided.
- The packaged `littleimp update install` flow verifies checksums, verifies
  optional detached signatures, rejects unsafe archive layouts, runs the native
  installer in upgrade mode, and confirms `/health` reports the upgraded
  version.
- The Homebrew formula uses the same release archives and verifies their
  published SHA-256 checksums.

Public one-command, published-artifact, and Homebrew validation must not be
claimed while unauthenticated release URLs return `404`.

## Known Limitations

- Any local process that can reach `127.0.0.1:3210` can call unprotected REST
  routes. This is part of the local-first trust model.
- Grimoire is not designed for multi-user hosts or shared public servers in
  `1.0.0`.
- DNS rebinding is not fully mitigated and is accepted only because the daemon
  is loopback-only.
- Content extraction fetches user-supplied public URLs. Protections reduce
  risk, but users should still avoid bookmarking malicious URLs.
- External AI providers are optional. If configured, provider-bound content and
  API keys are subject to that provider's security model and the security of
  the local machine.

## User Best Practices

1. Keep the daemon bound to `127.0.0.1`.
2. Do not publish Docker as `3210:3210` or `0.0.0.0:3210:3210` unless an
   authenticated tunnel, VPN, or reverse proxy protects the service first.
3. Protect your OS account and avoid untrusted local processes.
4. Use local LLM providers when you do not want content sent to external AI
   services.
5. Verify release archives with checksums and signatures where available.
6. Keep backups and encrypted backup passwords separately.
7. Review imported bookmarks before processing large imports.

## Development Security Guidelines

When contributing:

- Never trust user input.
- Keep GET and HEAD routes read-only.
- Use parameterized queries for database access.
- Validate URLs before fetching.
- Reject private-network targets where a route expects public URLs.
- Avoid logging secrets, bookmark contents, notes, embeddings, or backup
  passwords.
- Keep backup, restore, diagnostics, Settings, MCP, capture, and update routes
  under route-specific security review.

## Future Security Work

These are not shipped in `1.0.0`:

- Optional authentication for future public or multi-user modes.
- Per-client rate limiting for authenticated non-local deployment modes.
- Stronger content-extraction sandboxing.
- Dedicated security audit logging.
- Additional CI vulnerability scanning.
