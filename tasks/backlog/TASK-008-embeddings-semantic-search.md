# TASK-008: Embeddings & Semantic Search

**Status:** backlog
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

- [ ] sqlite-vec extension loads at daemon startup
- [ ] Embedding generated after LLM enrichment step
- [ ] Bookmark status updated to `indexed` after embedding stored
- [ ] Semantic search endpoint returns relevant results for conceptual queries
- [ ] Hybrid search mode blends keyword + vector + recency scores
- [ ] Related bookmarks endpoint: `GET /bookmarks/:id/related`
- [ ] Re-embedding job available for library-wide re-processing
