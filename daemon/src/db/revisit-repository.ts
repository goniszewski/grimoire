import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

export type RevisitDecision = "read" | "done" | "skipped" | "postponed" | "trashed";
export type RevisitAction = RevisitDecision;

interface RoundRow {
  id: string;
  item_ids: string;
  decisions: string;
  position: number;
  started_at: string;
  completed_at: string | null;
  last_undo: string | null;
}

interface PreviousState {
  bookmark_id: string;
  position: number;
  read_later: number;
  read_at: string | null;
  is_trashed: number;
  trashed_at: string | null;
  available_after: string | null;
  last_presented_at: string | null;
}

export interface RevisitBookmark {
  id: string;
  url: string;
  title: string | null;
  domain: string;
  description: string | null;
  summary: string | null;
  notes: string | null;
  screenshot_url: string | null;
  created_at: string;
  read_at: string | null;
}

export interface RevisitState {
  total: number;
  eligible: number;
  round: null | {
    id: string;
    size: number;
    position: number;
    completed: boolean;
    decisions: RevisitDecision[];
    can_undo: boolean;
    current: RevisitBookmark | null;
    upcoming: RevisitBookmark[];
  };
}

const ACTIVE = "b.read_later = 1 AND b.is_archived = 0 AND b.is_trashed = 0";
const ELIGIBLE = `${ACTIVE} AND (s.available_after IS NULL OR s.available_after <= ?)`;

export function postponeUntil(now: Date, delay: "day" | "week" | "month"): Date {
  const until = new Date(now);
  if (delay === "day") until.setUTCDate(until.getUTCDate() + 1);
  if (delay === "week") until.setUTCDate(until.getUTCDate() + 7);
  if (delay === "month") {
    const day = until.getUTCDate();
    until.setUTCDate(1);
    until.setUTCMonth(until.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth() + 1, 0)).getUTCDate();
    until.setUTCDate(Math.min(day, lastDay));
  }
  return until;
}

export class RevisitRepository {
  constructor(private readonly db: Database) {}

  private activeRound(): RoundRow | null {
    return this.db.query<RoundRow, []>(
      "SELECT * FROM revisit_round WHERE completed_at IS NULL ORDER BY started_at DESC LIMIT 1"
    ).get();
  }

  private latestRound(): RoundRow | null {
    return this.activeRound() ?? this.db.query<RoundRow, []>(
      "SELECT * FROM revisit_round ORDER BY rowid DESC LIMIT 1"
    ).get();
  }

  private reconcileActiveRound(): void {
    const row = this.activeRound();
    if (!row) return;
    const ids = JSON.parse(row.item_ids) as string[];
    const available = this.db.query<{ id: string }, [string]>(
      `SELECT b.id FROM bookmarks b WHERE b.id = ? AND ${ACTIVE}`
    );
    const remaining = ids.slice(row.position).filter((id) => !!available.get(id));
    if (remaining.length === ids.length - row.position) return;
    const nextIds = [...ids.slice(0, row.position), ...remaining];
    this.db.query(
      "UPDATE revisit_round SET item_ids = ?, completed_at = ? WHERE id = ?"
    ).run(JSON.stringify(nextIds), remaining.length ? null : new Date().toISOString(), row.id);
  }

  state(): RevisitState {
    this.db.transaction(() => this.reconcileActiveRound())();
    const now = new Date().toISOString();
    const total = this.db.query<{ count: number }, []>(
      `SELECT COUNT(*) AS count FROM bookmarks b WHERE ${ACTIVE}`
    ).get()?.count ?? 0;
    const eligible = this.db.query<{ count: number }, [string]>(
      `SELECT COUNT(*) AS count FROM bookmarks b LEFT JOIN revisit_bookmarks s ON s.bookmark_id = b.id WHERE ${ELIGIBLE}`
    ).get(now)?.count ?? 0;
    const row = this.latestRound();
    if (!row) return { total, eligible, round: null };
    const ids = JSON.parse(row.item_ids) as string[];
    const decisions = JSON.parse(row.decisions) as RevisitDecision[];
    const bookmarks = !row.completed_at ? this.db.query<RevisitBookmark, [string, string, string]>(
      `SELECT b.id, b.url, b.title, b.domain, b.description, c.summary, b.notes,
              b.screenshot_url, b.created_at, b.read_at
       FROM bookmarks b LEFT JOIN bookmark_content c ON c.bookmark_id = b.id
       WHERE b.id IN (?, ?, ?)`
    ).all(ids[row.position] ?? "", ids[row.position + 1] ?? "", ids[row.position + 2] ?? "") : [];
    const ordered = ids.slice(row.position, row.position + 3)
      .map((id) => bookmarks.find((bookmark) => bookmark.id === id))
      .filter((bookmark): bookmark is RevisitBookmark => !!bookmark);
    return {
      total, eligible,
      round: {
        id: row.id,
        size: ids.length,
        position: row.position,
        completed: !!row.completed_at,
        decisions,
        can_undo: !!row.last_undo,
        current: ordered[0] ?? null,
        upcoming: ordered.slice(1),
      },
    };
  }

  start(size = 5): RevisitState {
    this.db.transaction(() => {
      this.reconcileActiveRound();
      if (this.activeRound()) return;
      const now = new Date().toISOString();
      // Existing Later flags predate this feature; create state lazily without changing bookmarks.
      this.db.exec(`INSERT OR IGNORE INTO revisit_bookmarks (bookmark_id, later_added_at)
        SELECT id, created_at FROM bookmarks WHERE read_later = 1`);
      this.db.query(
        `INSERT OR IGNORE INTO revisit_pass (bookmark_id)
         SELECT b.id FROM bookmarks b LEFT JOIN revisit_bookmarks s ON s.bookmark_id = b.id
         WHERE ${ELIGIBLE} ORDER BY random()`
      ).run(now);
      let ids = this.pendingIds(size, now);
      if (ids.length === 0) {
        // A pass ends only after every currently eligible item has been offered.
        this.db.exec("DELETE FROM revisit_pass");
        this.db.query(
          `INSERT INTO revisit_pass (bookmark_id)
           SELECT b.id FROM bookmarks b LEFT JOIN revisit_bookmarks s ON s.bookmark_id = b.id
           WHERE ${ELIGIBLE} ORDER BY random()`
        ).run(now);
        ids = this.pendingIds(size, now);
      }
      if (ids.length === 0) return;
      this.db.query(
        "INSERT INTO revisit_round (id, item_ids, started_at) VALUES (?, ?, ?)"
      ).run(randomUUID(), JSON.stringify(ids), now);
      this.db.query("UPDATE revisit_bookmarks SET last_presented_at = ? WHERE bookmark_id = ?")
        .run(now, ids[0]);
    })();
    return this.state();
  }

  private pendingIds(size: number, now: string): string[] {
    return this.db.query<{ bookmark_id: string }, [string, number]>(
      `SELECT p.bookmark_id FROM revisit_pass p
       JOIN bookmarks b ON b.id = p.bookmark_id
       LEFT JOIN revisit_bookmarks s ON s.bookmark_id = b.id
       WHERE p.presented = 0 AND ${ELIGIBLE}
       ORDER BY p.sequence LIMIT ?`
    ).all(now, size).map((row) => row.bookmark_id);
  }

  act(bookmarkId: string, action: RevisitAction, delay: "day" | "week" | "month" = "day"): RevisitState | null {
    const changed = this.db.transaction(() => {
      this.reconcileActiveRound();
      const row = this.activeRound();
      if (!row) return false;
      const ids = JSON.parse(row.item_ids) as string[];
      if (ids[row.position] !== bookmarkId) return false;
      const previous = this.db.query<PreviousState, [number, string]>(
        `SELECT b.id AS bookmark_id, b.read_later, b.read_at, b.is_trashed, b.trashed_at,
                s.available_after, s.last_presented_at, ? AS position
         FROM bookmarks b LEFT JOIN revisit_bookmarks s ON s.bookmark_id = b.id WHERE b.id = ?`
      ).get(row.position, bookmarkId);
      if (!previous) return false;
      const now = new Date();
      if (action === "read") {
        this.db.query("UPDATE bookmarks SET read_at = COALESCE(read_at, ?), read_later = 0 WHERE id = ?")
          .run(now.toISOString(), bookmarkId);
      } else if (action === "done") {
        this.db.query("UPDATE bookmarks SET read_later = 0 WHERE id = ?").run(bookmarkId);
      } else if (action === "trashed") {
        this.db.query("UPDATE bookmarks SET is_trashed = 1, trashed_at = ? WHERE id = ?")
          .run(now.toISOString(), bookmarkId);
      } else if (action === "postponed") {
        const until = postponeUntil(now, delay);
        this.db.query("UPDATE revisit_bookmarks SET available_after = ? WHERE bookmark_id = ?")
          .run(until.toISOString(), bookmarkId);
      }
      this.db.query("UPDATE revisit_bookmarks SET last_presented_at = ? WHERE bookmark_id = ?")
        .run(now.toISOString(), bookmarkId);
      this.db.query("UPDATE revisit_pass SET presented = 1 WHERE bookmark_id = ?").run(bookmarkId);
      const decisions = [...JSON.parse(row.decisions) as RevisitDecision[], action];
      const nextPosition = row.position + 1;
      this.db.query(
        `UPDATE revisit_round SET decisions = ?, position = ?, completed_at = ?, last_undo = ? WHERE id = ?`
      ).run(JSON.stringify(decisions), nextPosition,
        nextPosition === ids.length ? now.toISOString() : null,
        JSON.stringify(previous), row.id);
      if (nextPosition < ids.length) {
        this.db.query("UPDATE revisit_bookmarks SET last_presented_at = ? WHERE bookmark_id = ?")
          .run(now.toISOString(), ids[nextPosition]);
      }
      return true;
    })();
    return changed ? this.state() : null;
  }

  undo(): RevisitState | null {
    const changed = this.db.transaction(() => {
      const row = this.latestRound();
      if (!row?.last_undo) return false;
      const previous = JSON.parse(row.last_undo) as PreviousState;
      this.db.query(
        "UPDATE bookmarks SET read_later = ?, read_at = ?, is_trashed = ?, trashed_at = ? WHERE id = ?"
      ).run(previous.read_later, previous.read_at, previous.is_trashed, previous.trashed_at, previous.bookmark_id);
      this.db.query(
        "UPDATE revisit_bookmarks SET available_after = ?, last_presented_at = ? WHERE bookmark_id = ?"
      ).run(previous.available_after, previous.last_presented_at, previous.bookmark_id);
      this.db.query("UPDATE revisit_pass SET presented = 0 WHERE bookmark_id = ?")
        .run(previous.bookmark_id);
      const decisions = JSON.parse(row.decisions) as RevisitDecision[];
      decisions.pop();
      this.db.query(
        "UPDATE revisit_round SET decisions = ?, position = ?, completed_at = NULL, last_undo = NULL WHERE id = ?"
      ).run(JSON.stringify(decisions), previous.position, row.id);
      return true;
    })();
    return changed ? this.state() : null;
  }
}
