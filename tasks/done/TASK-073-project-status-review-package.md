# TASK-073: Project Status Review Package

**Phase:** MVP readiness
**Priority:** medium
**Status:** done
**Area:** documentation / testing / product planning

## Description

Capture the current project status in reviewable artifacts, add smoke coverage
for the documented MVP business requirements, and keep post-MVP multi-user
planning separate from the `0.1.0-beta` release scope.

## Scope

1. Add post-MVP research for multi-user support, roles, public/private
   environments, and data isolation.
2. Link the multi-user research from the roadmap as future direction, not as a
   beta release requirement.
3. Add a focused Playwright smoke suite for core documented business
   requirements: save, keyword search, import, export, Settings, update checks,
   backup verification, backup creation, and restore.
4. Add a reusable mocked daemon for development-server E2E flows.
5. Update E2E fixtures to match the current multi-provider AI settings shape.

## Acceptance Criteria

- [x] Roadmap identifies multi-user/public-network mode as post-MVP direction
      research.
- [x] Multi-user research documents the current single-user assumptions,
      proposed isolation model, roles, public/private environments, and
      implementation impact.
- [x] Business-requirements smoke tests cover the core flows without needing a
      real daemon or user data.
- [x] E2E settings fixtures include current AI and embedding provider fields.
- [x] Focused Playwright verification passes locally.

## Review Notes

- The mocked daemon smoke suite is not a replacement for installed-artifact
  validation in TASK-070. It is a faster development-server regression suite
  for business-critical UI/API flows.
- The multi-user research intentionally keeps the default product model as
  local-first and single-user for the current MVP release.

## Verification

- `npm run test:e2e -- e2e/business-requirements.spec.ts` passed locally with 3
  Playwright tests.
