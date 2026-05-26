# Little Imp Update System Design

## Overview

This document proposes a comprehensive update system for Little Imp that balances the local-first philosophy with the need for security updates and feature improvements.

## Current Implementation

The Settings page can run a manual update availability check through the daemon.
The daemon includes a read-only `GET /updates/check` endpoint, and the packaged
`littleimp` CLI includes a manual `littleimp update check` command. The checks
read GitHub Releases-compatible JSON from the default GitHub Releases API or an
operator-provided source, filter by `stable` or `beta` channel, ignore malformed
release tags, and report whether a newer semver release exists. The daemon API
rejects private and loopback source hosts to preserve the local network safety
posture; the user-invoked CLI can still target explicit local mirrors in
controlled offline environments. `update check` remains read-only and never
downloads or installs updates.

The packaged CLI also supports explicit manual native upgrades through
`littleimp update install` and the alias `littleimp update upgrade`. A user can
install the latest compatible release discovered by the update source, select a
specific version to download from a release artifact base URL, or point to a
local archive with matching `.sha256` and optional `.asc` files. The CLI verifies
the archive checksum, derives artifact download URLs from GitHub-compatible
release `html_url` values when possible, verifies a detached signature when
provided or published, extracts only safe release archive layouts, runs the packaged
`daemon/install.sh --upgrade`, and then verifies `/health` reports the upgraded
version. On failure after installer execution, the CLI prints rollback guidance
that directs the user to rerun the previous verified release installer with
`--upgrade`; local data, settings, backups, and logs remain under
`~/.local/share/littleimp`.

## Design Principles

1. **User Control**: Updates are never automatic - users explicitly choose when to update
2. **Local-First**: Update checks can be disabled entirely for air-gapped environments
3. **Security-Focused**: Critical security updates are clearly marked and easily identifiable
4. **Rollback Support**: Users can revert to previous versions if issues arise
5. **Minimal Disruption**: Updates preserve all user data and configurations

## Update Channels

### Release Channels

- **Stable**: Production-ready releases (recommended for most users)
- **Beta**: Pre-release versions for testing new features
- **Nightly**: Bleeding-edge builds for developers

### Update Types

1. **Security Updates** 🔒
   - Highest priority
   - Clearly marked in UI
   - One-click installation
   - Minimal user disruption

2. **Feature Updates** ✨
   - New functionality
   - User-facing improvements
   - Optional installation

3. **Bug Fixes** 🐛
   - Stability improvements
   - Performance optimizations
   - Optional but recommended

## Update Check Process

### Check Frequency

- Default: Weekly checks (configurable)
- Security updates: Immediate notification
- Can be disabled entirely

### Update Sources

- **Primary**: GitHub Releases API
- **Mirror**: Alternative CDN for redundancy
- **Local**: Air-gapped update packages

## Implementation Architecture

### Components

1. **Update Service** (`daemon/src/update/service.ts`)
   - Checks for available updates
   - Shares release parsing and version comparison between the daemon API and CLI
   - Keeps channel filtering and semver-compatible release selection shared

2. **Update API** (`daemon/src/routes/updates.ts`)
   - Read-only update availability check
   - Status reporting
   - Does not download or install release artifacts

3. **Update UI** (Frontend components)
   - Update notifications
   - Progress indicators
   - Version management interface

4. **Update CLI** (`daemon/src/cli.ts`, `daemon/src/update/upgrade.ts`)
   - Read-only `update check`
   - Explicit `update install` / `update upgrade` for manual packaged native upgrades
   - Scriptable downloads, local archive upgrades, checksum/signature verification, restart health checks, and rollback guidance

### Update Package Format

```json
{
  "version": "1.2.0",
  "channel": "stable",
  "type": "feature",
  "releaseDate": "2026-04-01T00:00:00Z",
  "criticality": "medium",
  "changelog": {
    "added": ["New feature X", "Feature Y"],
    "fixed": ["Bug Z", "Issue W"],
    "security": ["CVE-2026-1234"]
  },
  "downloads": {
    "macos": {
      "x64": "https://.../little-imp-1.2.0-macos-x64.tar.gz",
      "arm64": "https://.../little-imp-1.2.0-macos-arm64.tar.gz"
    },
    "linux": {
      "x64": "https://.../little-imp-1.2.0-linux-x64.tar.gz",
      "arm64": "https://.../little-imp-1.2.0-linux-arm64.tar.gz"
    }
  },
  "checksums": {
    "sha256": {
      "macos-x64": "abc123...",
      "macos-arm64": "def456...",
      "linux-x64": "ghi789...",
      "linux-arm64": "jkl012..."
    }
  },
  "rollbackAvailable": true,
  "previousVersion": "1.1.0"
}
```

## Update Process Flow

### 1. Check for Updates

```
User → Settings → Check for Updates
        ↓
Update Service → GitHub API → Update Available?
        ↓ Yes
UI Notification → User Decision
```

### 2. Download Update

```
User → littleimp update install
        ↓
CLI → Download Archive + Checksum + Optional Signature
        ↓
Verify Checksum + Signature → Extract Safe Archive
```

### 3. Install Update

```
Verified Archive → daemon/install.sh --upgrade
        ↓
Stop Daemon → Replace Application Files
        ↓
Reinstall Dependencies → Start Daemon
        ↓
Verify /health Version → Print Success or Rollback Guidance
```

## User Interface

### Update Notifications

- **System tray notifications** for available updates
- **In-app banner** for critical security updates
- **Settings page** for comprehensive update management

### Update Settings

- **Check frequency**: Daily, Weekly, Monthly, Manual only
- **Channel selection**: Stable, Beta, Nightly
- **Auto-download**: Enable/disable automatic downloads
- **Update notifications**: Enable/disable notifications
- **Rollback**: Revert to previous version

## Security Considerations

### Package Verification

- **Cryptographic signatures** for all update packages
- **Checksum verification** for integrity
- **Certificate pinning** for HTTPS connections
- **Supply chain security** for dependencies

### Sandboxed Updates

- **Isolated installation** process
- **Backup creation** before updates
- **Rollback capability** for failed updates
- **Permission restrictions** for update operations

## Rollback System

### Automatic Rollback

- Triggers on installation failure
- Preserves user data during rollback
- Restores previous working version
- Generates rollback report

### Manual Rollback

- User-initiated by rerunning the previous release's verified installer with `--upgrade`
- Data, settings, backups, and logs remain in `~/.local/share/littleimp`
- CLI failures after installer execution print the rollback command strategy and log locations
- Full version history and one-command rollback remain future scope

## Air-Gapped Support

### Offline Updates

- **Manual package download** from website
- **USB/Network share** distribution
- **Local update server** for organizations
- **Update package verification** without internet

### Update Package Creation

- **Export current installation** as update package
- **Distribute via secure channels**
- **Import and install** on target systems
- **Verify package integrity** locally

## Update CLI Commands

```bash
# Check for updates
littleimp update check

# Check a specific release channel
littleimp update check --channel stable

# Install the latest compatible release found by the configured source
littleimp update install

# Download and install a specific release version
littleimp update install --version 1.2.0

# Download from an alternate artifact base URL
littleimp update install --version 1.2.0 \
  --release-base-url https://updates.example.com/little-imp/v1.2.0

# Install from a local archive, checksum, and optional detached signature
littleimp update install \
  --archive ./little-imp-1.2.0-macos.tar.gz \
  --checksum ./little-imp-1.2.0-macos.tar.gz.sha256 \
  --signature ./little-imp-1.2.0-macos.tar.gz.asc
```

## Implementation Timeline

### Phase 1: Basic Update System (v1.1)

- [x] Manual CLI update check
- [x] Daemon update check service
- [x] Manual in-app update check
- [x] Manual packaged CLI download and verification
- [ ] Basic UI notifications
- [x] Explicit CLI install/upgrade command

### Phase 2: Enhanced Features (v1.2)

- [ ] Rollback system
- [ ] Update scheduling
- [ ] Channel management
- [ ] Air-gapped support

### Phase 3: Advanced Features (v1.3)

- [ ] Delta updates (incremental)
- [ ] Update analytics
- [ ] Advanced rollback
- [ ] Enterprise features

## Configuration

### Environment Variables

```bash
# Update service configuration
UPDATE_CHECK_ENABLED=true
UPDATE_CHECK_FREQUENCY=weekly
UPDATE_CHANNEL=stable
UPDATE_AUTO_DOWNLOAD=false
UPDATE_NOTIFICATIONS=true

# Update sources
UPDATE_PRIMARY_SOURCE=https://api.github.com/repos/goniszewski/little-imp/releases
UPDATE_MIRROR_SOURCE=https://cdn.example.com/little-imp/releases

# Security
UPDATE_VERIFY_SIGNATURES=true
UPDATE_CERTIFICATE_PINNING=true
```

### Configuration File

```json
{
  "updates": {
    "enabled": true,
    "checkFrequency": "weekly",
    "channel": "stable",
    "autoDownload": false,
    "notifications": true,
    "sources": {
      "primary": "https://api.github.com/repos/goniszewski/little-imp/releases",
      "mirror": "https://cdn.example.com/little-imp/releases"
    },
    "security": {
      "verifySignatures": true,
      "certificatePinning": true,
      "allowedChannels": ["stable", "beta"]
    }
  }
}
```

## Migration Path

### From Current Version

1. **Integrate with settings** system
2. **Add UI components** incrementally
3. **Add download and verification** after release artifacts, checksums, and signatures are defined
4. **Maintain backward compatibility**
5. **Provide migration tools** for existing installations

### Backward Compatibility

- **Optional update system** - can be disabled entirely
- **Preserve existing behavior** for users who don't want updates
- **Maintain local-first philosophy** - updates enhance rather than replace local functionality
- **No forced updates** - user control remains paramount

This update system design maintains Little Imp's core philosophy while providing the security and feature improvements users expect from modern applications.
