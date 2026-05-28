# TASK-008: Embeddings & Semantic Search

**Status:** done
**Priority:** medium
**Phase:** v0-beta
**Area:** backend / ai / search

## Description

Generate and store vector embeddings per bookmark, and implement semantic search using sqlite-vec cosine similarity.

## Embedding Strategy

- 1 embedding per bookmark (initial implementation)
- Input: concatenation of title + summary + tags
- Stored in `embeddings` table via sqlite-vec

## Supported Embedding Providers

- OpenAI `text-embedding-3-small` (default, cloud)
- Local: Ollama with embedding models (e.g. `nomic-embed-text`)

## Semantic Search

- `GET /search?q=<query>&mode=semantic` or `mode=hybrid`
- Encode query using same embedding model
- cosine similarity against bookmark embeddings
- Returns ranked results

## Hybrid Ranking Formula

```
score = keyword_score * 0.6 + vector_score * 0.3 + recency_score * 0.1
```

Where:
- `keyword_score` = FTS5 BM25 (normalized 0-1)
- `vector_score` = cosine similarity (0-1)
- `recency_score` = time decay function

## Acceptance Criteria

- [~] sqlite-vec extension loads at daemon startup (Bun 1.3.x does not support dynamic SQLite extensions; vectors stored as float32 BLOB — forward-compatible with vec0 when Bun adds support)
- [x] Embedding generated after LLM enrichment step
- [x] Bookmark status updated to `indexed` after embedding stored
- [x] Semantic search endpoint returns relevant results for conceptual queries
- [x] Hybrid search mode blends keyword + vector + recency scores
- [x] Related bookmarks endpoint: `GET /bookmarks/:id/related`
- [x] Re-embedding job available for library-wide re-processing

## Follow-up Closure Note

Library-wide re-embedding shipped in TASK-064 through durable reprocess and
embedding-only jobs for provider changes and library-wide recovery.
