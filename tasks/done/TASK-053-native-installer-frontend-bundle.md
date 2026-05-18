# TASK-053: Native Installer Frontend Bundle Install

**Phase:** next release distribution polish
**Priority:** medium
**Status:** done

## Summary

Make the native installer install the built frontend bundle into the same
application data directory served by the daemon, so a native install can expose
both the REST API and browser UI from `http://127.0.0.1:3210`.

## Current Evidence

- The daemon already serves static frontend files from `DATA_DIR/dist` in native
  installs because `daemon/src/server.ts` falls back to `../../dist` relative to
  the installed daemon source directory.
- The installer previously copied daemon files and installed daemon
  dependencies, but did not build or install the frontend bundle.
- README installation and data-location docs did not list the installed
  frontend bundle path.

## Work

1. Add installer support for building the frontend from source and installing
   the generated `dist` files into `~/.local/share/littleimp/dist`.
2. Support release-style installs that provide a prebuilt `dist/index.html`
   without requiring frontend source files.
3. Mirror frontend files during install or upgrade, including the fallback path
   for systems without `rsync`.
4. Remove stale installed frontend files when no frontend source or bundle is
   available, preventing the daemon from serving an old UI.
5. Update installer success output and README install/data-location docs.
6. Add daemon integration coverage for source-built, prebuilt, missing-bundle,
   and no-`rsync` installer paths.

## Acceptance Criteria

- [x] Native installer builds the frontend when source files are present.
- [x] Native installer installs a prebuilt frontend bundle without rebuilding.
- [x] Installed frontend files land under `~/.local/share/littleimp/dist`.
- [x] No-`rsync` installs remove stale assets before copying the new bundle.
- [x] Missing frontend source/bundle clears stale installed UI files and reports
      the UI as not installed.
- [x] README documents frontend install and upgrade behavior.
- [x] Focused installer regression tests cover the critical install paths.

## Completion Notes

- Added `install_frontend_files()` to `daemon/install.sh`.
- Added `daemon/src/test/integration/installer-static-frontend.test.ts`.
- Updated README install, upgrade, and data-location sections.
- Verified with focused installer tests, shell syntax check, TypeScript check,
  whitespace check, and the full `npm run check` project gate.
