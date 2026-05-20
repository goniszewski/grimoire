# TASK-020: YouTube Transcript Extractor

**Status:** done
**Priority:** low
**Phase:** future
**Area:** backend / pipeline

## Description

Add YouTube as a supported content type. Extract video transcript for indexing and enrichment.

## Behavior

- Detect YouTube URLs (youtube.com/watch, youtu.be)
- Fetch video title and channel via YouTube oEmbed API (no API key needed)
- Extract transcript via YouTube's timedtext API or `youtubei.js`
- Store transcript as extracted content
- Pass transcript content to the normal LLM enrichment stage when an LLM
  provider is configured.

## Acceptance Criteria

- [x] YouTube URL detection covers youtube.com and youtu.be formats
- [x] Video title + channel fetched without API key
- [x] Transcript extracted when available
- [x] Graceful fallback to video title if transcript unavailable
- [x] Transcript content feeds the normal summary/enrichment stage when an LLM
      provider is configured.
