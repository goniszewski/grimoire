# TASK-059: Signed Release Archive Packaging

**Phase:** MVP readiness
**Priority:** high
**Status:** todo
**Area:** distribution / release engineering

## Description

Produce installable release archives so users can install Little Imp without
cloning the repository. The archive should contain the daemon, packaged CLI,
built frontend, installer assets, version metadata, checksums, and a signature
or signature-ready manifest.

## Scope

1. Define the release archive layout for macOS and Linux.
2. Add a repeatable packaging script for release artifacts.
3. Include the production frontend bundle produced by `npm run build`.
4. Include the daemon files needed by `daemon/install.sh`.
5. Include the packaged `littleimp` CLI entry point.
6. Generate SHA-256 checksums for each artifact.
7. Add artifact signing or a documented signature hook suitable for local and CI
   release use.
8. Update release documentation to describe the artifact format.

## Acceptance Criteria

- [ ] A local command creates versioned release archive artifacts from a clean
      checkout.
- [ ] Archives include the built frontend, daemon runtime files, installer, CLI,
      platform files, and version metadata.
- [ ] A checksum file is generated for every archive.
- [ ] The release process supports signing or has a documented signing step that
      can be enforced before publication.
- [ ] Packaging output is covered by focused tests or a deterministic validation
      script.

## Dependencies

- Should follow TASK-058 so release artifacts are based on verified MVP state.

## Notes

- This is the primary task for closing the roadmap gap called "install without
  cloning the repository."
- Avoid introducing auto-update installation here; that belongs to TASK-061.
