# Security Policy for Little Imp

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.0-beta | :white_check_mark: |
| Other pre-release or development builds | :x: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by emailing security concerns to the maintainer at the email address in the repository profile.

**Please do not report security vulnerabilities through public GitHub issues.**

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested remediation

## Security Considerations

### Local-First Design

Little Imp is designed as a local-first application that runs entirely on the user's machine. This design provides several security benefits:

- **No external dependencies**: All data processing happens locally
- **No cloud storage**: Bookmarks and content are stored in a local SQLite database
- **Network isolation**: The native daemon listens on `127.0.0.1:3210`
  (localhost). Docker publishes the daemon as `127.0.0.1:3210:3210` by
  default; the container-internal `HOST=0.0.0.0` is only used so Docker can
  forward that loopback-bound host port into the container.

The canonical threat model and future public-network release gates are
documented in [docs/security-boundaries.md](./docs/security-boundaries.md).

### Implemented Security Measures

#### Input Validation

- URL validation before fetching content
- Private IP address blocking (RFC 1918)
- Path traversal protection in file operations
- SQL injection prevention through parameterized queries
- Content-Type validation for fetched resources

#### Network Security

- Localhost-only native binding (`127.0.0.1:3210`)
- Loopback-only Docker port publishing (`127.0.0.1:3210:3210`)
- Browser requests with an `Origin` header are accepted only from configured
  loopback origins, including the daemon's own `127.0.0.1:3210` origin and the
  default local development origins
- Non-loopback `CORS_ORIGINS` entries are ignored by the daemon; public access
  must be protected before traffic reaches Little Imp
- Private network address blocking
- Request size limits for import and selected JSON-heavy local operations
- Request timeout protection (20 seconds)

#### Browser Response Hardening

- Static frontend and API responses include conservative browser headers:
  `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and
  `Cross-Origin-Resource-Policy`
- The CSP allows the shipped SPA from the daemon origin, localhost/127.0.0.1
  daemon/API connections, HTTPS images for favicons, and the existing Google
  font hosts
- IPv6 loopback origins remain accepted by origin checks, but CSP connect
  sources use browser-accepted localhost and 127.0.0.1 source forms
- Scripts are limited to the app origin, object/embed content is blocked, and
  other sites cannot frame the UI

#### Data Protection

- SQLite database with WAL mode for consistency
- Backup checksum validation
- Backup settings export omits secrets; restore preserves current local secrets
- Encrypted backup package passwords are required per verify/restore operation and are not stored
- In-app encrypted package verify/restore is limited to daemon-local package paths under the configured backup directory
- Diagnostics omit API keys, URL credentials and query strings, app lock PIN hashes, S3 credentials, backup package passwords, bookmark contents, notes, and embeddings
- Safe file operations with proper error handling
- No sensitive data in logs (API keys are masked)
- Declared request body sizes are rejected before parsing on expensive local
  operations such as import, backup verification, encrypted package handling,
  restore, and library reprocessing
- Backup, restore, verification, and encrypted-package routes validate JSON
  object bodies and restrict user-supplied backup names and package paths to
  safe local forms
- Backup and restore operations use an in-process guard to prevent concurrent
  destructive or expensive backup work

#### Release Artifact Verification

- The recommended one-command installer downloads the published release archive
  for the current platform and verifies the matching SHA-256 checksum before
  extraction.
- Detached `.asc` signatures are verified when they are published or explicitly
  provided. If no signature is available, the installer reports checksum-only
  verification instead of implying a signature check happened.
- Manual release archive installs document checksum verification before running
  the native installer.
- The Homebrew formula consumes the same release archives and verifies their
  published SHA-256 checksums.
- The packaged `littleimp update install` flow verifies checksums, verifies
  optional detached signatures, rejects unsafe archive paths, and confirms the
  daemon health endpoint reports the upgraded version.

### Potential Security Risks

#### Local Access

Since Little Imp runs locally without authentication, any process on the user's machine can potentially access the API. This is by design for a local-first application but users should be aware of this limitation.

Public-network exposure is not a supported mode for the current release or the
current Grimoire parity batch. Any future mode that binds beyond loopback must
complete the gates in [docs/security-boundaries.md](./docs/security-boundaries.md)
before implementation or release.

#### Docker Networking

The Docker image serves the frontend and API from one container. Keep Docker
port publishing bound to `127.0.0.1`; do not use `3210:3210` or
`0.0.0.0:3210:3210` unless an authenticated tunnel, VPN, or reverse proxy
protects the service before requests reach Little Imp.

#### Content Fetching

The content extraction pipeline fetches URLs provided by users. While we implement several protections, users should be cautious about bookmarking malicious URLs.

#### AI Integration

When using external AI providers, API keys are stored locally. Users should ensure their machine is secure and consider using local LLM providers when possible.

### Security Best Practices for Users

1. **Keep your system updated** with the latest security patches
2. **Use local LLM providers** when possible to avoid sharing data externally
3. **Secure your machine** with appropriate access controls
4. **Review imported bookmarks** before processing
5. **Use the release installer, Homebrew formula, or manual archive checksum
   verification** instead of running unverified files
6. **Regular backups** to protect against data loss

### Development Security Guidelines

When contributing to Little Imp:

1. **Never trust user input** - always validate and sanitize
2. **Use parameterized queries** for all database operations
3. **Validate all URLs** before fetching content
4. **Implement proper error handling** that doesn't expose sensitive information
5. **Follow the principle of least privilege** in file operations
6. **Test security edge cases** in your contributions

### Security Audit Checklist

#### Network Security

- [x] Localhost-only native binding
- [x] Loopback-only Docker port publishing
- [x] Loopback-only browser origin handling for unsafe API requests
- [x] Private IP blocking
- [x] Request timeouts
- [x] Content size limits
- [x] Content-Type validation
- [x] Browser security response headers
- [x] Content Security Policy

#### Input Validation

- [x] URL validation
- [x] Path traversal protection
- [x] SQL injection prevention
- [x] Parameter validation
- [x] File type restrictions

#### Data Protection

- [x] Database integrity
- [x] Backup validation
- [x] Safe file operations
- [x] Log security (no sensitive data)
- [x] Environment variable validation

#### Error Handling

- [x] Graceful error responses
- [x] No sensitive data exposure
- [x] Proper error logging
- [x] Resource cleanup
- [x] Transaction rollback

## Known Limitations

1. **Local access only**: No authentication mechanism (by design)
2. **Single-user system**: Not designed for multi-user environments
3. **Local file system access**: Requires file system permissions for backups
4. **Network requests**: Content fetching could potentially be exploited

## Future Security Enhancements

Consider implementing:

1. **Optional authentication** for multi-user scenarios
2. **Per-client rate limiting** for authenticated non-local deployment modes
3. **Sandboxing** for content extraction
4. **Audit logging** for security events
5. **Vulnerability scanning** in CI/CD pipeline

## Contact

For security-related questions or to report vulnerabilities, please contact the maintainer through the appropriate channels listed in the repository.
