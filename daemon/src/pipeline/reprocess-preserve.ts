import type { Database } from "bun:sqlite";

/**
 * Decide whether Retry/reprocess should keep migrated/imported content.
 * Default Retry (replaceAiFields=false) must not clobber legacy libraries;
 * explicit replace_ai_fields=true still allows a full refresh.
 */
export function shouldPreserveExistingOnReprocess(
  db: Database,
  bookmarkId: string,
  replaceAiFields: boolean | undefined
): boolean {
  if (replaceAiFields === true) return false;

  const hasLegacyMedia = Boolean(
    db
      .query<{ ok: number }, [string]>(
        `SELECT 1 AS ok FROM bookmark_media
         WHERE bookmark_id = ? AND source_url LIKE 'legacy://%'
         LIMIT 1`
      )
      .get(bookmarkId)
  );
  if (hasLegacyMedia) return true;

  const hasStoredContent = Boolean(
    db
      .query<{ ok: number }, [string]>(
        `SELECT 1 AS ok FROM bookmark_content
         WHERE bookmark_id = ?
           AND (
             (raw_html IS NOT NULL AND length(raw_html) > 0)
             OR (markdown IS NOT NULL AND length(markdown) > 0)
             OR (author IS NOT NULL AND length(trim(author)) > 0)
             OR (published_at IS NOT NULL AND length(trim(published_at)) > 0)
           )
         LIMIT 1`
      )
      .get(bookmarkId)
  );
  if (hasStoredContent) return true;

  // Description-only migrations (no HTML/uploads) still need protection.
  return Boolean(
    db
      .query<{ ok: number }, [string]>(
        `SELECT 1 AS ok FROM bookmarks
         WHERE id = ?
           AND description IS NOT NULL
           AND length(trim(description)) > 0
         LIMIT 1`
      )
      .get(bookmarkId)
  );
}
