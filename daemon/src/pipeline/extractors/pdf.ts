/**
 * PDF content extractor.
 *
 * Uses pdf-parse to extract plain text from PDF files.
 * Falls back to URL-derived title for scanned/image-only PDFs.
 *
 * Limits:
 *   - Input capped at 10 MB (enforced by fetcher before we receive it).
 *   - Extracted text truncated to 500 000 chars to keep memory bounded.
 */

import { ExtractionResult } from "./types.js";
import { log } from "../../logger.js";

const MAX_TEXT_CHARS = 500_000;

// pdf-parse v2 exports a class; use require so Bun resolves the CJS bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: object) => {
    getText(): Promise<{ text: string; total: number }>;
    getInfo(): Promise<{ info: { Title?: string; Author?: string; CreationDate?: string } }>;
  };
};

export async function extractFromPdf(
  bytes: Uint8Array,
  fallbackTitle: string | null
): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: bytes });

  // Run sequentially: pdfjs-dist transfers the Uint8Array to its worker thread on first
  // load, so parallel calls on the same parser instance risk a detached-buffer race.
  type PdfInfo = { Title?: string; Author?: string; CreationDate?: string };

  const infoResult = await parser.getInfo().catch(() => ({ info: {} as PdfInfo }));
  const textResult = await parser.getText().catch(() => null);

  const info: PdfInfo = infoResult.info ?? {};

  // Derive title: PDF metadata → fallback provided by caller.
  const title: string | null =
    (typeof info.Title === "string" && info.Title.trim()) || fallbackTitle || null;

  const author: string | null =
    (typeof info.Author === "string" && info.Author.trim()) || null;

  // Parse ISO-8601 from PDF CreationDate (format: "D:YYYYMMDDHHmmSSOHH'mm'")
  let publishedAt: string | null = null;
  if (typeof info.CreationDate === "string") {
    const raw = info.CreationDate.replace(/^D:/, "").slice(0, 8); // YYYYmmdd
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    if (year && month && day) {
      const candidate = `${year}-${month}-${day}T00:00:00Z`;
      if (!isNaN(Date.parse(candidate))) {
        publishedAt = candidate;
      }
    }
  }

  if (!textResult || !textResult.text.trim()) {
    log.warn("PDF text extraction yielded no text (likely scanned/image PDF)", {
      pages: textResult?.total,
    });
    return {
      title,
      markdown: title ?? null,
      rawHtml: null,
      author,
      publishedAt,
      wordCount: null,
      language: null,
    };
  }

  let text = textResult.text;
  if (text.length > MAX_TEXT_CHARS) {
    log.warn("PDF text truncated", { original: text.length, limit: MAX_TEXT_CHARS });
    text = text.slice(0, MAX_TEXT_CHARS);
  }

  // Normalise whitespace: collapse runs of blank lines to a single blank line.
  const markdown = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  return {
    title,
    markdown,
    rawHtml: null,
    author,
    publishedAt,
    wordCount,
    language: null, // pdf-parse doesn't detect language
  };
}
