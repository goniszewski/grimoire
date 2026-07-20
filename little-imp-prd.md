# Little Imp — Personal Knowledge Index

Product Requirements Document (PRD)

Version: v0.4  
Status: Pre-implementation  
Author: Robert Goniszewski  
Date: March 2026

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

Future extractors:

- PDF
- GitHub issues
- YouTube transcripts

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
- create new subcategories
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

- clustering disabled
- categories created manually or by AI
- search uses only keyword results

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
| Runtime | Node.js or Bun |
| API | Hono |
| Database | SQLite |
| Search | FTS5 |
| Vectors | sqlite-vec |
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

Embeddings stored per bookmark.

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

Database location is documented for manual backups.

Future:

- automated periodic backup

---

## 17. Security

Principles:

- local-first storage
- API bound to localhost
- no telemetry
- optional external AI providers

---

## 18. Development Milestones

### v0-alpha

Goal: validate **save → search → retrieve** workflow.

Features:

- bookmark ingestion
- HTML bookmark import
- content extraction
- FTS keyword search
- minimal React UI
- daemon installer

No AI.

---

### v0-beta

Adds AI enrichment:

- summary generation
- tag generation
- embeddings
- semantic search
- category suggestion

---

### v0.2

Adds autonomous organization:

- clustering
- review queue
- timeline
- duplicate detection

---

### v1

Advanced ecosystem features:

- plugin system
- browser extension
- MCP integration
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
