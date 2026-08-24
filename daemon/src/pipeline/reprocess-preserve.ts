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

  const hasImportedProvenance = Boolean(
    db
      .query<{ ok: number }, [string]>(
        `SELECT 1 AS ok FROM bookmark_provenance
         WHERE bookmark_id = ? AND source = 'legacy-v05'
         LIMIT 1`
      )
      .get(bookmarkId)
  );
  if (hasImportedProvenance) return true;

  // Keep recognizing legacy media as provenance for rows created before the
  // bookmark_provenance marker was added.
  return Boolean(
    db
      .query<{ ok: number }, [string]>(
        `SELECT 1 AS ok FROM bookmark_media
         WHERE bookmark_id = ? AND source_url LIKE 'legacy://%'
         LIMIT 1`
      )
      .get(bookmarkId)
  );
}
