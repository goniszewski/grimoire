export interface ExtractionResult {
  title: string | null;
  markdown: string | null;
  rawHtml: string | null;
  author: string | null;
  publishedAt: string | null; // ISO-8601 or null
  wordCount: number | null;
  language: string | null;
}
