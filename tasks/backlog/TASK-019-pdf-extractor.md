# TASK-019: PDF Content Extractor

**Status:** backlog
**Priority:** low
**Phase:** future
**Area:** backend / pipeline

## Description

Add PDF as a supported content type in the extraction pipeline. When a URL points to a PDF, download and extract text content.

## Behavior

- Detect PDF by Content-Type header or `.pdf` URL extension
- Download PDF file
- Extract text using `pdf-parse` or similar library
- Store extracted text in `bookmark_content`
- Pass to LLM enrichment pipeline as normal

## Acceptance Criteria

- [ ] PDF detection works by Content-Type and URL extension
- [ ] Text extraction works for text-based PDFs
- [ ] Falls back to URL title for scanned/image PDFs
- [ ] Large PDFs (>10MB) handled with size limit / truncation
- [ ] Extraction status tracked in pipeline status field
