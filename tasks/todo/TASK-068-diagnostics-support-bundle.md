# TASK-068: Diagnostics and Support Bundle

**Phase:** MVP readiness
**Priority:** medium
**Status:** todo
**Area:** operations / support / frontend / CLI

## Description

Add local diagnostics that help users and maintainers understand installation,
daemon, provider, backup, and search health without exposing secrets. This is
especially important once users install from release artifacts instead of a
developer checkout.

## Scope

1. Define a redacted diagnostics payload with version, platform, install mode,
   data paths, config paths, daemon health, queue depth, provider status, backup
   destination status, and recent log locations.
2. Add a daemon diagnostics endpoint or CLI command that returns the redacted
   payload.
3. Add a Settings diagnostics panel with copy/export behavior.
4. Ensure API keys, PIN hashes, S3 secrets, backup passwords, and other secrets
   never appear in diagnostics.
5. Add tests for redaction and expected status fields.
6. Document how to generate diagnostics for support.

## Acceptance Criteria

- [ ] Users can generate diagnostics from the CLI or Settings.
- [ ] Diagnostics include enough context to troubleshoot install, health,
      provider, backup, and queue issues.
- [ ] Secrets are redacted in tests and implementation.
- [ ] Diagnostics output is deterministic enough for support and issue reports.
- [ ] Documentation explains what is included and what is intentionally omitted.

## Notes

- This task should not add telemetry. Diagnostics are generated locally and only
  shared if the user chooses to share them.
