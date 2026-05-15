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
- Pass to LLM enrichment (summarize transcript)

## Acceptance Criteria

- [ ] YouTube URL detection covers youtube.com and youtu.be formats
- [ ] Video title + channel fetched without API key
- [ ] Transcript extracted when available
- [ ] Graceful fallback to video title if transcript unavailable
- [ ] Summary generated from transcript (may need chunking for long videos)
