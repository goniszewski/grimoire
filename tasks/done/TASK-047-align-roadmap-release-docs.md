# TASK-047: Align Roadmap, Release, and Product Documentation

**Status:** done
**Priority:** medium
**Phase:** v0-beta hardening
**Area:** documentation, release management

## Description

The documentation no longer presents a single coherent product state. Some roadmap items are marked complete in one section and incomplete in another. MCP and Docker are described as available in README while the roadmap still lists them as out of scope. Package versions are `0.0.0`, while the changelog and API docs describe `0.1.0-beta`.

This task makes README, roadmap, PRD, changelog, security docs, API docs, package versions, and task board agree.

## Current evidence

- `docs/roadmap.md` lists MCP integration, Docker packaging, and category drag-and-drop as out of scope even though corresponding task files are done or README docs exist.
- `docs/roadmap.md` still has user-journey gaps that contradict implemented first-run/degraded-mode work.
- Root and daemon package versions are `0.0.0`, while release docs mention `0.1.0` or beta language.
- `tasks/README.md` had stale rows for already-completed M1-M4 tasks and did not list several completed task files.

## Dependencies / sequencing

- Run this as the final documentation pass after TASK-041 through TASK-046 are either complete or explicitly deferred.
- Do not duplicate detailed implementation docs owned by TASK-041, TASK-042, TASK-044, or TASK-045; this task reconciles the final public narrative.

## Work

1. Define the current release target and version string.
2. Update root `package.json`, `daemon/package.json`, health response expectations, changelog, and docs to use the same version.
3. Reconcile roadmap contradictions around degraded mode, backup/restore readiness, MCP, Docker packaging, and distribution.
4. Update task board status so completed tasks are not still listed as backlog.
5. Split roadmap into current state, release blockers, next release, and future ideas.
6. Update SECURITY.md to match actual Docker/network defaults after TASK-042.
7. Update backup/restore release language after TASK-044 so partial safety work is not described as complete.
8. Update API docs links and source-of-truth wording after TASK-045.
9. Add a short release checklist covering install, Docker, backup/restore, CI, and docs validation.

## Acceptance Criteria

- [x] README, roadmap, PRD, changelog, API docs, and task board agree on shipped features.
- [x] Package versions and documented release version are consistent.
- [x] Roadmap clearly distinguishes release blockers from future ideas.
- [x] Task paths in `tasks/README.md` point to files that actually exist.
- [x] Security documentation matches runtime and Docker defaults.
- [x] Release checklist is documented and referenced from CONTRIBUTING.md or README.
