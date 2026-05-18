# Little Imp — Personal Knowledge Index

Product Requirements Document (PRD)

Version: v0.6
Status: Living document aligned to the `0.1.0-beta` release target
Author: Robert Goniszewski
Date: May 2026

---

## 1. Overview

Little Imp is a **local-first personal knowledge index** designed for developers who collect large volumes of technical resources.

Instead of functioning as a traditional bookmark manager, Little Imp acts as a **personal search engine for everything a user has saved**.

Users save URLs and the system:

- extracts the page content
- stores the full text locally
- generates a short summary
- generates tags
- creates embeddings
- classifies bookmarks into categories
- detects emerging topics over time

Current product state:

- `0.1.0-beta` is the current release target
- core save, extract, keyword search, semantic search, hybrid search, and review flows exist
- local/S3-compatible backup and restore flows exist with checksum validation, rollback directory creation, and restart-required restore responses
- Docker deployment and Streamable HTTP MCP integration are supported local-first entry points

Core promise:

> **Find anything you've saved instantly. Organization happens automatically.**

---

## 2. Product Goals

Primary goals:

1. Provide **fast retrieval of saved knowledge** through keyword and semantic search.
2. Automatically organize bookmarks with minimal user effort.
3. Operate **entirely local-first**, with optional external AI providers.
4. Support **developer workflows and content types**.
5. Maintain a **lightweight always-available local daemon**.

---

## 3. Target User

Primary persona:

**Developers who regularly save technical content.**

Typical saved content:

- technical blog posts
- documentation pages
- GitHub repositories
- StackOverflow threads
- RFCs and specifications
- tutorials and guides

Typical behavior:

- saving dozens of links weekly
- struggling to rediscover saved content later
- relying on search rather than manual organization

---

## 4. Core Product Principles

### Search-first experience

The primary interface is **search**, not browsing.

Categories and tags exist primarily to:

- improve search relevance
- enable optional browsing
- support clustering

---

### Progressive enrichment

Bookmarks become useful **immediately after saving**, while AI enrichment runs asynchronously.

---

### Local-first architecture

All data is stored locally.

External AI services are optional.

---

### Autonomous organization

The system continuously improves organization using AI and clustering.

---

### Developer-focused extraction

Extraction logic prioritizes developer content types.

---

## 5. Core Features

### Bookmark ingestion

User saves a URL.

Processing pipeline:

```text
URL
 ↓
save bookmark
 ↓
fetch page
 ↓
extract readable content
 ↓
AI enrichment
   summary
   tags
   category
 ↓
embedding generation
 ↓
search index update
```

---

### Progressive pipeline model

Bookmarks progress through states:

saved → fetched → extracted → ai_enriched → indexed

Failures do not block usability.

Example failure behavior:

| Stage | Failure behavior |
| ------ | ---------------- |
| fetch | bookmark saved with URL only |
| extraction | fallback to page title |
| LLM enrichment | retry later |
| embedding | retry later |

Bookmarks are **visible and searchable immediately**.

---

## 6. Search System

Search is the **primary interaction model**.

### Keyword search

Implemented using SQLite FTS5.

Indexed fields:

- title
- summary
- tags
- extracted content

---

### Semantic search

Embeddings enable queries such as:

> vector databases for RAG

even if those exact words do not appear in saved pages.

---

### Search ranking

Hybrid ranking algorithm:

```text
keyword_score = FTS5 BM25  
vector_score = cosine similarity  
recency_score = time decay  
```

Final score:

```text
score =
  keyword_score * 0.6 +
  vector_score * 0.3 +
  recency_score * 0.1
```

Rules:

- keyword matches rank first
- semantic results supplement keyword results
- recent bookmarks receive a small boost

---

### Filters

Search supports filtering by:

- tag
- domain
- category
- date

---

## 7. Content Extraction

Extraction strategies vary by content type.

| Source | Extraction strategy |
| ------ | --------------------- |
| Blog posts | Readability extraction |
| Technical articles | Readability extraction |
| GitHub repositories | README + metadata |
| StackOverflow | question + accepted answer |
| Documentation pages | main page content |
| Fallback | Readability |

Additional implemented extractors:

- PDF
- YouTube transcripts

Future extractors:

- GitHub issues

---

## 8. Bookmark Import

Supported format:

> Netscape Bookmark HTML

This supports imports from:

- Chrome
- Firefox
- Safari
- Edge

Future imports:

- Pocket
- Raindrop
- Pinboard

---

## 9. Autonomous Organization

The AI agent periodically analyzes the library to:

- detect clusters
- propose or create new categories when confidence is high enough
- merge related categories
- detect duplicates

Agent actions follow confidence rules:

```text
confidence ≥ 0.9 → auto apply  
confidence < 0.9 → suggestion
```

Suggestions appear in the **Review Queue**.

---

## 10. Library Evolution Timeline

Structural changes are recorded in a timeline.

Example:

```text
June 2026  
Created category:  
AI → Retrieval Augmented Generation  
```

---

## 11. AI Strategy

LLM tasks:

- summary generation
- tag generation
- category classification
- cluster labeling

These tasks should be **batched into a single LLM call per bookmark** when possible.

---

### Embeddings

Embeddings are used for:

- semantic search
- clustering
- related bookmarks

Initial implementation:

> 1 embedding per bookmark

Chunked embeddings may be introduced later.

---

### Cost considerations

Approximate cost per bookmark:

| Provider | Cost | Latency |
| -------- | ------ | -------- |
| GPT-4o mini | ~$0.002 | ~1-2s |
| GPT-4o | ~$0.02 | ~2-4s |
| Local LLM | $0 | 5-15s |

Users configure providers manually.

---

## 12. Cold Start Behavior

For new libraries (<20 bookmarks):

- organization clustering and auto-apply actions are disabled
- categories may still be created manually or via normal bookmark enrichment
- keyword search always works
- semantic and hybrid search work only when embeddings exist for the relevant bookmarks

Clustering activates when library size exceeds threshold.

---

## 13. System Architecture

Runtime model:

`littleimpd`

Local daemon responsible for:

- API server
- background worker
- scheduler
- ingestion pipeline

UI connects via:

`http://127.0.0.1:3210`

---

### Technology Stack

| Component | Technology |
| --------- | ------------ |
| Runtime | Bun |
| API | Hono |
| Database | SQLite |
| Search | FTS5 |
| Vectors | float32 embeddings stored in SQLite BLOBs (sqlite-vec compatible schema deferred) |
| Frontend | React SPA |
| Installer | Shell script |
| Autostart | LaunchAgent (macOS), systemd (Linux) |

---

## 14. Data Model

Core tables:

- bookmarks
- bookmark_content
- tags
- bookmark_tags
- categories
- embeddings
- jobs
- agent_suggestions
- timeline_events

Relationships:

```text
bookmark 1—1 content  
bookmark 1—many tags  
bookmark 1—1 embedding  
bookmark 1—many suggestions  
```

Embeddings are stored per bookmark.

---

## 15. UI Overview

The UI follows a **search-first design**.

Main layout:

```text
+--------------------------------+
| Search bar                     |
+--------------------------------+

Search results

[Bookmark card]

Title  
Summary  
Tags  
Domain  
Date  

Sidebar:

- categories
- tags
```

Experience resembles:

`Raycast + Notion`

---

## 16. Import / Export / Backup

Import:

Netscape HTML bookmarks

Export:

- JSON
- CSV

Backup and restore:

- portable snapshot directories
- manifest and checksum validation
- non-secret settings export
- custom local destinations, including cloud-synced folders
- scheduled local snapshots with retention
- S3-compatible remote backup targets
- restore with rollback directory creation and daemon restart requirement

### Backup Strategy

Little Imp should treat backup as a separate concern from sync.

Principles:

- backups must be restorable without requiring the original machine
- backup must preserve SQLite data, uploaded metadata, settings, and future schema versions
- backup should be append-only snapshots, not live multi-writer replication
- restore should always create a local copy first, never run directly from a remote mount

Implemented backup model:

1. create a consistent local snapshot
2. write checksums for restorable payload files
3. store a small manifest with app version, schema version, created-at timestamp, and backup format version
4. upload the snapshot to a configured target or copy it to a user-selected folder

Supported backup targets:

- local folder / external disk
- S3-compatible object storage
- cloud-synced folder chosen by the user (for example iCloud Drive, Dropbox, Google Drive)

Deferred backup targets:

- direct multi-provider integrations for every consumer cloud drive
- true multi-device sync of the live database
- CloudKit-specific sync as the primary backup path

Rationale:

- S3-compatible storage gives the best cross-provider abstraction for managed remote backups
- user-selected synced folders give the simplest path to iCloud Drive and similar providers without app-specific integrations
- backup and restore remain understandable because the product always produces the same portable snapshot format

---

## 17. Security

Principles:

- local-first storage
- API bound to localhost
- no telemetry
- optional external AI providers
- remote backup credentials, if configured, stored locally and scoped to backup only

---

## 18. Development Milestones

### v0-alpha

Delivered the save, search, and retrieve loop:

- bookmark ingestion
- HTML bookmark import
- content extraction
- FTS keyword search
- minimal React UI
- daemon installer

### 0.1.0-beta

Current release target. Adds the complete local-first beta surface:

- AI enrichment, embeddings, semantic search, hybrid search, and related bookmarks
- category management, category drag-and-drop, notes, archive, Trash, and read status
- review queue, timeline, organization agent, duplicate detection, and cold-start guard
- Settings UI, first-run/degraded-mode UX, app lock, and runtime settings persistence
- portable backup/restore, scheduled snapshots, custom destinations, and S3-compatible remote backups
- in-app local backup verification without restore
- Docker deployment, MCP integration, packaged backup CLI, source-of-truth API docs, CI, and release checklist

### Next release

Focuses on release operations:

- Homebrew or signed release archive
- one-command installer entry point
- optional encrypted backup artifact
- update flow

### Future

Advanced ecosystem features:

- plugin system
- browser extension
- live multi-device sync
- optional auth/rate limiting for non-local deployment modes
- advanced AI workflows

---

## 19. Success Metrics

Usage metrics:

- bookmarks added
- searches performed
- search success rate

AI quality metrics:

- tag accuracy
- category accuracy
- clustering usefulness

Performance metrics:

- ingestion latency
- search latency

---

## 20. Long-Term Vision

Little Imp evolves from a bookmark manager into a **personal knowledge infrastructure**.

Potential future uses:

- personal knowledge search
- AI assistant context store
- research archive
- agent-accessible knowledge base via MCP
