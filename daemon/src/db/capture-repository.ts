import { Database } from "bun:sqlite";

export interface BookmarkCaptureMetadataRow {
  bookmark_id: string;
  source_client: string | null;
  source_url: string | null;
  referrer_url: string | null;
  selected_text: string | null;
  captured_at: string;
  updated_at: string;
}

export interface CaptureMetadataInput {
  source_client?: string | null;
  source_url?: string | null;
  referrer_url?: string | null;
  selected_text?: string | null;
}

export class CaptureRepository {
  constructor(private db: Database) {}

  findByBookmarkId(bookmarkId: string): BookmarkCaptureMetadataRow | null {
    return (
      this.db
        .query<BookmarkCaptureMetadataRow, [string]>(
          "SELECT * FROM bookmark_capture_metadata WHERE bookmark_id = ?"
        )
        .get(bookmarkId) ?? null
    );
  }

  upsert(bookmarkId: string, input: CaptureMetadataInput): BookmarkCaptureMetadataRow | null {
    const sourceClient = input.source_client ?? null;
    const sourceUrl = input.source_url ?? null;
    const referrerUrl = input.referrer_url ?? null;
    const selectedText = input.selected_text ?? null;

    if (!sourceClient && !sourceUrl && !referrerUrl && !selectedText) {
      return null;
    }

    return (
      this.db
        .query<
          BookmarkCaptureMetadataRow,
          [string, string | null, string | null, string | null, string | null]
        >(
          `INSERT INTO bookmark_capture_metadata (
             bookmark_id, source_client, source_url, referrer_url, selected_text
           )
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(bookmark_id) DO UPDATE SET
             source_client = excluded.source_client,
             source_url = excluded.source_url,
             referrer_url = excluded.referrer_url,
             selected_text = excluded.selected_text
           RETURNING *`
        )
        .get(bookmarkId, sourceClient, sourceUrl, referrerUrl, selectedText) ?? null
    );
  }
}
