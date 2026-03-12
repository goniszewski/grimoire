# TASK-019: PDF Content Extractor

**Status:** done
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

- [x] PDF detection works by Content-Type and URL extension
- [x] Text extraction works for text-based PDFs
- [x] Falls back to URL title for scanned/image PDFs
- [x] Large PDFs (>10MB) handled with size limit / truncation
- [x] Extraction status tracked in pipeline status field
