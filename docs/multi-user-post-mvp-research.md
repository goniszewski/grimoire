# Multi-User And Environment Isolation Research

Version: draft-v1
Status: Post-MVP direction research
Author: Robert Goniszewski
Date: May 2026

---

## 1. Purpose

This document captures post-MVP research for adding multi-user support to Grimoire.

The goal is not to change the `1.0.0` release scope. The current product remains a local-first, single-user knowledge index. Multi-user support is a larger product and architecture direction that should be evaluated after the MVP release is stable.

The requested capabilities are:

- roles: `admin`, `user`, and `read-only user`
- users can be assigned to more than one environment
- admins can manage other users
- environments can be public or private
- public environments still require an account for editing
- `read-only user` remains read-only even in public environments
- users with access to different repositories or environments must not be able to leak data to each other
- related product, API, data, backup, and operational changes required by those rules

---

## 2. Executive Summary

Multi-user support is a platform shift for Grimoire.

The current implementation assumes one local owner. The daemon exposes a
loopback-bound API where first-party REST remains tokenless, local integration
tokens protect MCP and validate presented REST bearer tokens, and all data still
belongs to one SQLite database, one local settings file, and one global search,
embedding, job, suggestion, backup, and MCP context.

The safest post-MVP direction is:

1. Keep the local-first single-user product as the default mode.
2. Add a separate multi-user mode after MVP.
3. Use a control database for users, sessions, environments, memberships, and audit metadata.
4. Store each environment's library in a separate SQLite database.
5. Route every environment-scoped API, job, search, embedding lookup, backup, and MCP request through an authenticated environment context.

This costs more than adding `environment_id` columns everywhere, but it gives a stronger isolation boundary and lowers the risk of a missed SQL predicate leaking another environment's bookmarks, extracted content, notes, embeddings, tags, suggestions, or backups.

Estimated implementation size:

| Scope | Estimated effort |
|---|---:|
| Research spike and architecture proof | 1-2 weeks |
| Minimal shared-database MVP | 6-9 weeks |
| Recommended per-environment database design | 9-13 weeks |
| Public-network hosted mode with hardening | 14-20+ weeks |

The recommended post-MVP planning baseline is 10-14 weeks for one senior engineer to build a credible, tested multi-user mode without hosted SaaS account recovery and billing concerns.

---

## 3. Current Architecture Assessment

### 3.1 Runtime Model

Grimoire currently has two runtime parts:

- React SPA frontend
- Bun and Hono daemon, `littleimpd`

The daemon owns:

- storage
- REST API routes
- background jobs
- content extraction
- AI enrichment
- embeddings
- search
- organization suggestions
- backup and restore
- MCP endpoint
- static frontend serving in production

Relevant current files:

- `daemon/src/server.ts`
- `daemon/src/index.ts`
- `daemon/src/db/database.ts`
- `daemon/src/db/migrations/0001_initial.sql`
- `daemon/src/settings.ts`
- `daemon/src/routes/*.ts`
- `daemon/src/mcp/server.ts`
- `src/lib/api.ts`
- `src/App.tsx`

### 3.2 Authentication State

The current single-user daemon has a scoped local integration-token layer for
MCP and presented REST bearer tokens. It does not have multi-user sessions,
accounts, roles, or route-level authorization.

Current Docker documentation explicitly warns:

- Grimoire's integration tokens do not make the daemon a public server.
- The daemon should not be published on a public interface.
- Remote access should be handled by an authenticated tunnel, VPN, or reverse proxy before traffic reaches Grimoire.

The Hono app still has no request principal, session lookup, role check, or
multi-user authorization middleware.

### 3.3 Data Model State

The main SQLite schema is global.

Core global tables include:

- `bookmarks`
- `bookmark_content`
- `tags`
- `bookmark_tags`
- `categories`
- `jobs`
- `agent_suggestions`
- `timeline_events`
- `embeddings`
- `bookmarks_fts`

None of those tables currently have a user, account, tenant, repository, or environment key.

Examples of global assumptions:

- `bookmarks.url` is globally unique.
- `tags.name` is globally unique.
- category names are unique within a parent, globally.
- FTS contains all indexed bookmarks.
- semantic search loads all embeddings for a model.
- the organization agent analyzes all active bookmarks.
- backup snapshots copy the whole database.

### 3.4 Settings And Secrets

Runtime settings are stored in one JSON config file:

`~/.config/littleimp/config.json`

That file can contain API provider settings, S3 backup credentials, app lock state, and backup schedule settings. In a multi-user model, these settings need clear ownership:

- global server settings
- per-environment settings
- per-user preferences
- write-only secrets
- backup credentials

Leaving settings global would let one environment's admins affect another environment's AI provider, embeddings provider, and backup behavior.

### 3.5 Background Work

The queue stores jobs in the same database and uses JSON payloads. Ingest jobs currently identify a bookmark by id and URL. The pipeline then reads and writes global bookmark rows, global content rows, global tags, global embeddings, and global FTS rows.

Multi-user mode must make jobs environment-scoped. A worker must know which environment database to open before processing a bookmark. Failed or retried jobs must not be visible across environments.

### 3.6 MCP Exposure

The MCP endpoint exposes bookmark search, reading, listing, creation, and category listing. It currently operates on the same global repositories as the REST API.

In multi-user mode, MCP must be treated like another API client:

- authenticated
- scoped to an environment
- role checked
- unable to search or retrieve bookmarks outside the selected environment

---

## 4. Requirement Interpretation

### 4.1 Users

A user is an account that can authenticate to the daemon or deployed service.

Baseline fields:

| Field | Notes |
|---|---|
| `id` | Stable internal id |
| `email` or `username` | Login identifier |
| `display_name` | UI label |
| `password_hash` | If local password auth is used |
| `status` | Active, disabled, invited, or pending |
| `created_at` | Audit and management |
| `updated_at` | Audit and management |

The first multi-user bootstrap flow should create the first admin account.

### 4.2 Environments

An environment is an isolated Grimoire library.

It should contain:

- bookmarks
- extracted content
- categories
- tags
- notes
- trash/archive state
- search indexes
- embeddings
- suggestions
- timeline
- import/export state
- environment-level settings
- environment-level backups

It may map to a team, project, repository, or knowledge base. The UI copy can use "environment" until the product chooses a more user-facing name.

### 4.3 Roles

The requested roles are:

- `admin`
- `user`
- `read-only user`

Recommended interpretation:

Roles are environment membership roles, not only global account roles.

| Role | Private environment | Public environment |
|---|---|---|
| `admin` | Read, write, manage environment users and settings | Same |
| `user` | Read and write environment content | Same |
| `read-only user` | Read environment content only | Read environment content only |
| Authenticated non-member | No access | Read public environment content only |

This keeps the role model close to the request while supporting users assigned to multiple environments with different permissions in each one.

Open product decision:

- Should there also be a platform-level `admin` who can create environments and recover locked environments?

The practical answer is probably yes, but it should be modeled separately from environment membership. Otherwise "admin can manage other users" becomes ambiguous when a user is admin in one environment but not another.

### 4.4 Public And Private Environments

Private environment:

- only assigned members can read
- only `admin` and `user` can write
- only `admin` can manage membership and settings

Public environment:

- any authenticated account can read
- anonymous users still cannot access by default
- editing still requires assigned `admin` or `user`
- assigned `read-only user` cannot edit
- environment admins can still assign explicit read-only users, for example to make access visible in management UI

Anonymous public read access should be deferred. It adds search indexing, scraping, rate limiting, abuse, privacy, and sharing concerns that are outside the stated requirement.

---

## 5. Isolation Design Options

### Option A: Shared SQLite Database With `environment_id`

Add `environment_id` to every environment-scoped table, then update every query to filter by environment.

Example scope:

- `bookmarks.environment_id`
- `categories.environment_id`
- `tags.environment_id`
- `jobs.environment_id`
- `agent_suggestions.environment_id`
- `timeline_events.environment_id`
- `bookmarks_fts.environment_id` or separate FTS tables
- composite uniqueness, such as `(environment_id, url)`

Advantages:

- fewer database files
- easier cross-environment admin reporting
- simpler backup of the full server
- one migration stream

Disadvantages:

- every query must include the correct environment predicate
- FTS and semantic search must be carefully filtered
- a missed predicate can leak data
- backups and restores become harder to scope safely
- category and tag uniqueness rules must all become composite
- tests must cover every endpoint and repository method for cross-environment leakage

This is the fastest credible implementation, but it is not the safest match for the requested data separation requirement.

### Option B: Control Database Plus Separate SQLite Database Per Environment

Use one control database for identity and environment metadata. Store each environment's library in its own SQLite database file.

Control database:

- users
- credentials
- sessions
- environments
- environment memberships
- invitations
- audit events

Environment database:

- current Grimoire library schema
- environment-local settings
- environment-local jobs
- environment-local FTS
- environment-local embeddings
- environment-local backups

Advantages:

- strong practical isolation between libraries
- lower risk of SQL predicate mistakes leaking another environment
- current repository code can be adapted by changing database selection rather than rewriting every table immediately
- per-environment backup and restore maps cleanly to current snapshot model
- search, embeddings, suggestions, and timeline are naturally environment-local
- easier future export/delete of one environment

Disadvantages:

- more database lifecycle management
- migrations must run per environment database
- background workers need environment-aware DB handles
- global admin reporting needs fan-out or summaries
- care is needed around connection caching and cleanup

This is the recommended direction.

### Option C: Separate Daemon Per Environment

Run one daemon instance per environment and put an auth/router layer in front.

Advantages:

- strongest isolation at runtime
- minimal changes to existing daemon internals
- each daemon keeps current single-user assumptions

Disadvantages:

- operationally heavy
- harder desktop install story
- more ports, processes, logs, backups, and updates
- difficult user switching
- awkward for users assigned to many environments

This may be useful for enterprise or self-hosted isolation later, but it is likely too heavy for the first post-MVP implementation.

### Option D: Hosted Multi-Tenant Service With PostgreSQL

Move multi-user mode to a hosted service with PostgreSQL, row-level security, object storage, queues, and a separate auth provider.

Advantages:

- better fit for public-network SaaS
- mature hosted auth and session options
- stronger operational tooling
- easier concurrent writes and central analytics

Disadvantages:

- large departure from local-first SQLite daemon model
- significantly more infrastructure
- sync/offline semantics become a new product problem
- data residency and privacy scope grows

This should be considered only if the product direction changes from local-first desktop/self-hosted to hosted collaboration.

---

## 6. Recommended Direction

Use Option B: control database plus separate SQLite database per environment.

### 6.1 Target Architecture

```text
Frontend
  |
  | login/session
  v
littleimpd
  |
  | control DB
  | - users
  | - sessions
  | - environments
  | - memberships
  | - audit events
  |
  | selected environment
  v
environment DB
  - bookmarks
  - bookmark_content
  - categories
  - tags
  - FTS
  - embeddings
  - jobs
  - suggestions
  - timeline
  - settings
  - backups
```

### 6.2 Request Context

Every protected route should resolve:

- authenticated user
- selected environment
- membership role, if any
- public/private environment visibility
- effective permission

Recommended route shape:

```text
POST /auth/login
POST /auth/logout
GET  /me

GET  /environments
POST /environments
GET  /environments/:environmentId
PUT  /environments/:environmentId

GET  /environments/:environmentId/bookmarks
POST /environments/:environmentId/bookmarks
GET  /environments/:environmentId/search
GET  /environments/:environmentId/categories
...
```

An alternative is to keep the existing paths and pass `X-LittleImp-Environment`, but path-scoped environment APIs are easier to reason about, test, document, cache, and audit.

### 6.3 Permission Model

Use route-level permission groups:

| Permission | Allows |
|---|---|
| `read` | list, search, get bookmark, read categories/tags/domains/timeline |
| `write_content` | create/update/archive/delete/restore bookmarks, import, tag/category edits |
| `manage_environment` | rename environment, visibility, settings, backup/restore |
| `manage_members` | invite, assign roles, remove users |
| `admin_system` | create environments, disable users, recover ownership |

Map requested roles to permissions:

| Role | Permissions |
|---|---|
| `admin` | `read`, `write_content`, `manage_environment`, `manage_members` |
| `user` | `read`, `write_content` |
| `read-only user` | `read` |
| public authenticated non-member | `read` only when environment is public |

### 6.4 Data Layout

Recommended filesystem layout:

```text
<DATA_DIR>/
  control.db
  environments/
    <environment_id>/
      littleimp.db
      backups/
      config.json
      logs/
```

The existing `littleimp.db` can remain the single-user default. Multi-user mode can create the new layout and migrate the default local library into the first environment.

### 6.5 Control Database Draft Schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'invited')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  database_path TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE environment_memberships (
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'read_only')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (environment_id, user_id)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  environment_id TEXT REFERENCES environments(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
```

The naming can expose "read-only user" in the UI while using `read_only` internally.

### 6.6 Environment Database Schema

The first implementation should keep the existing environment data schema close to the current single-user schema. Because each environment has its own database, tables do not need `environment_id` columns.

Changes still needed:

- remove assumptions that `Config.DATA_DIR/littleimp.db` is the only database
- make migrations runnable for any environment database path
- make repository constructors receive the selected environment DB
- make job workers environment-aware
- move settings from one global JSON file into environment-local settings or clearly split global and environment settings

---

## 7. API And Frontend Changes

### 7.1 Backend API

Required API groups:

- auth: login, logout, current user
- users: list, create/invite, disable, update profile
- environments: list accessible environments, create, update visibility
- memberships: list, assign, change role, remove
- environment-scoped existing APIs: bookmarks, search, categories, tags, domains, timeline, suggestions, import, export, settings, backup, updates where applicable, MCP

Existing API contract generation must be updated so `daemon/src/api/contract.ts`, `API.md`, and `docs/api-contract.json` remain the source-of-truth flow.

### 7.2 Frontend

Required UI changes:

- login screen
- session persistence and logout
- environment switcher
- accessible environment list
- admin user management page
- environment settings page
- role-aware disabled actions and hidden admin-only controls
- public/private visibility control
- clearer empty states for public read-only access
- query cache keys include environment id

The existing app routes can stay mostly the same after an environment is selected, but the data layer must include the selected environment in every request.

### 7.3 Read-Only UI Behavior

For `read-only user` and public non-member readers:

- hide or disable add bookmark
- hide or disable import
- hide or disable edit fields
- hide or disable archive/trash/permanent delete
- hide or disable category/tag management
- hide or disable suggestion accept/reject if it mutates data
- allow search, filters, detail reading, export only if product decides exports are read operations

Export requires a specific product decision. It is technically read-only, but it can leak a complete environment. For public environments, export should probably be restricted to explicit members at first.

---

## 8. Backup, Restore, And Settings Implications

### 8.1 Backups

Current backup snapshots assume a single local database. In multi-user mode:

- each environment should have its own backup list
- backup creation should require `manage_environment`
- restore should require `manage_environment`
- restore should affect only the selected environment database
- remote backup destinations should be environment-local or system-admin controlled
- backup package names should include environment identity in metadata, not necessarily in filenames

Control database backups are a separate concern. Losing the control database means losing users, sessions, memberships, and environment metadata even if environment databases remain intact.

Recommended backup model:

- environment admins can back up and restore their environment library
- platform admins can back up the control database
- restore of an environment never mutates other environment databases

### 8.2 Settings

Settings should be split:

| Scope | Examples |
|---|---|
| System | host, port, CORS, session config, global update source |
| Environment | AI provider, embedding provider, S3 backup target, backup schedule |
| User | theme, UI preferences, selected environment |

The current app lock feature should be revisited. In single-user mode it is a local privacy lock. In multi-user mode, authenticated sessions replace most of that need.

---

## 9. Security Model

### 9.1 Security Goals

Multi-user mode must prevent:

- unauthenticated API access
- users reading private environments they are not assigned to
- users writing to public environments without membership
- read-only users mutating data
- cross-environment bookmark ID lookup
- cross-environment search leakage
- cross-environment related bookmark leakage
- cross-environment suggestion or timeline leakage
- backup list, restore, export, or MCP access outside allowed environments
- settings or secrets leakage across environments

### 9.2 Main Risk: IDOR

The main web security risk is insecure direct object reference.

Examples:

- user A guesses bookmark id from environment B
- user A calls `GET /environments/a/bookmarks/<id-from-b>`
- user A calls `PUT /bookmarks/<id>` on an old global endpoint
- user A searches public environment and gets private environment snippets
- user A uses MCP `get_bookmark` with another environment's bookmark id

Per-environment databases reduce this risk because the wrong database does not contain the target row. API tests still need to prove it.

### 9.3 Session Security

Baseline local password auth should include:

- strong password hashing through a modern password hashing function
- opaque random session tokens
- only hashed session tokens stored server-side
- secure cookie mode when served over HTTPS
- CSRF protection if cookie auth is used for unsafe methods
- session expiry
- logout invalidation
- account disable invalidates sessions

For public-network deployments, also add:

- rate limiting on login and write endpoints
- request body size limits
- security headers
- TLS termination guidance
- audit logging for admin actions
- backup and export audit events

### 9.4 Public Environment Safety

Public environments should initially mean "readable by authenticated users" rather than internet-public.

Reasons:

- extracted content may include copyrighted or sensitive text
- search snippets can reveal content
- export can copy a whole library
- MCP clients can automate data extraction
- anonymous public access creates scraping and abuse concerns

---

## 10. Testing Strategy

Multi-user support needs test coverage beyond normal route success cases.

### 10.1 Authorization Matrix Tests

For each environment-scoped endpoint, test:

- unauthenticated user
- authenticated non-member on private environment
- authenticated non-member on public environment
- `read-only user`
- `user`
- `admin`
- disabled account

### 10.2 Cross-Environment Leak Tests

For every object type, create data in two environments and verify:

- list endpoints return only allowed environment data
- direct id lookup cannot fetch the other environment's object
- mutation endpoints cannot modify the other environment's object
- search cannot return other environment snippets
- semantic and hybrid search cannot return other environment embeddings
- related bookmarks cannot cross environment boundaries
- suggestions and timeline cannot cross environment boundaries
- import/export/backup/restore cannot cross environment boundaries
- MCP tools cannot cross environment boundaries

### 10.3 Migration Tests

Test:

- existing single-user database migrates into the first environment
- environment database migrations run independently
- a new environment starts with an empty migrated schema
- backup/restore of one environment does not affect another

### 10.4 Frontend Tests

Test:

- environment switcher invalidates data correctly
- query keys include environment id
- read-only users cannot trigger write controls
- public non-members can read public environments but cannot edit
- admin pages are hidden or blocked for non-admins

---

## 11. Implementation Roadmap

### Phase 0: Post-MVP Discovery Spike

Estimated effort: 1-2 weeks

Deliverables:

- decide whether multi-user mode remains local/self-hosted or becomes hosted
- decide per-environment database vs shared database
- decide auth provider strategy
- produce an implementation plan and API migration strategy
- prototype request context and one protected route

Recommended spike output:

- architecture decision record
- rough schema migration plan
- threat model
- route authorization matrix
- test fixture strategy

### Phase 1: Auth And Control Plane

Estimated effort: 2-3 weeks

Deliverables:

- control database
- user table
- password credentials or chosen auth integration
- sessions
- bootstrap first admin
- `/auth/login`, `/auth/logout`, `/me`
- request auth middleware
- user management APIs
- integration tests for auth/session lifecycle

### Phase 2: Environment Model

Estimated effort: 2-3 weeks

Deliverables:

- environments table
- memberships table
- environment creation
- environment list for current user
- selected environment context
- environment database creation
- migration runner for environment databases
- first environment migration from existing single-user database

### Phase 3: Scope Existing Domain APIs

Estimated effort: 3-4 weeks

Deliverables:

- bookmarks, trash, archive, search, related bookmarks
- categories, tags, domains
- import/export
- suggestions and timeline
- settings split
- API contract update
- cross-environment leak tests

### Phase 4: Background Jobs And Automation

Estimated effort: 2-3 weeks

Deliverables:

- environment-aware queue
- environment-aware pipeline
- environment-local FTS updates
- environment-local embeddings
- organization agent runs per environment
- retry and recovery behavior per environment

### Phase 5: Frontend

Estimated effort: 2-3 weeks

Deliverables:

- login/logout
- environment switcher
- user management page
- environment settings page
- public/private controls
- role-aware UI
- query cache isolation by environment id

### Phase 6: Backups, MCP, And Hardening

Estimated effort: 2-4 weeks

Deliverables:

- environment-local backup/restore
- control database backup policy
- authenticated and scoped MCP
- audit events
- rate limiting for public-network mode
- deployment documentation updates
- security regression tests

---

## 12. Open Decisions

| Question | Default recommendation |
|---|---|
| Is multi-user local/self-hosted or hosted SaaS? | Start local/self-hosted. Revisit hosted after validation. |
| Are roles global or per environment? | Per environment, with a separate platform admin capability. |
| Can authenticated non-members read public environments? | Yes, read-only. |
| Can anonymous users read public environments? | No for first implementation. |
| Can read-only users export a public/private environment? | Restrict export to explicit members at first. |
| Are AI and backup settings global or per environment? | Per environment. |
| Should each environment have its own SQLite DB? | Yes, recommended. |
| Should one search query span multiple environments? | No for first implementation. |
| Should admins manage all users globally or only environment members? | Environment admins manage memberships; platform admins manage users globally. |
| How should old single-user installs upgrade? | Create first admin and migrate existing DB into a default private environment. |

---

## 13. Post-MVP Recommendation

Treat multi-user support as a post-MVP product direction, not a beta release blocker.

Recommended next action after MVP:

1. Create a dedicated architecture spike task.
2. Decide whether the product is still local-first/self-hosted in multi-user mode.
3. Prototype the control database plus per-environment database layout.
4. Protect one vertical slice end to end:
   - login
   - environment list
   - one private environment
   - one public environment
   - bookmark list/search
   - one write endpoint
   - read-only denial
   - cross-environment leak tests
5. Only after that prototype, commit to a full implementation plan.

The key technical principle is simple: every operation must run with an explicit authenticated user and an explicit environment context. If a request has no valid environment context, it should not be able to touch library data.
