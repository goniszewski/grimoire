import { createHash, randomBytes } from "node:crypto";
import { Database } from "bun:sqlite";
import type { IntegrationTokenRow } from "./types.js";

export type PublicIntegrationToken = Omit<IntegrationTokenRow, "token_hash">;

const TOKEN_PREFIX = "limp_it_";
const TOKEN_RANDOM_BYTES = 32;
const DISPLAY_PREFIX_LENGTH = 16;

export interface CreatedIntegrationToken {
  token: string;
  record: PublicIntegrationToken;
}

export function generateIntegrationToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_RANDOM_BYTES).toString("base64url")}`;
}

export function hashIntegrationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function publicToken(row: IntegrationTokenRow): PublicIntegrationToken {
  return {
    id: row.id,
    name: row.name,
    token_prefix: row.token_prefix,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    revoked_at: row.revoked_at,
  };
}

function displayPrefix(token: string): string {
  return token.slice(0, DISPLAY_PREFIX_LENGTH);
}

export class IntegrationTokenRepository {
  constructor(private db: Database) {}

  list(): PublicIntegrationToken[] {
    return this.db
      .query<IntegrationTokenRow, []>(
        `SELECT *
         FROM integration_tokens
         ORDER BY revoked_at IS NOT NULL, created_at DESC, name COLLATE NOCASE`
      )
      .all()
      .map(publicToken);
  }

  findById(id: string): PublicIntegrationToken | null {
    const row =
      this.db
        .query<IntegrationTokenRow, [string]>("SELECT * FROM integration_tokens WHERE id = ?")
        .get(id) ?? null;
    return row ? publicToken(row) : null;
  }

  create(name: string): CreatedIntegrationToken {
    const token = generateIntegrationToken();
    const row = this.db
      .query<IntegrationTokenRow, [string, string, string]>(
        `INSERT INTO integration_tokens (name, token_hash, token_prefix)
         VALUES (?, ?, ?)
         RETURNING *`
      )
      .get(name, hashIntegrationToken(token), displayPrefix(token));

    if (!row) throw new Error("Failed to create integration token");
    return { token, record: publicToken(row) };
  }

  rotate(id: string): CreatedIntegrationToken | null {
    const token = generateIntegrationToken();
    const row =
      this.db
        .query<IntegrationTokenRow, [string, string, string]>(
          `UPDATE integration_tokens
           SET token_hash = ?,
               token_prefix = ?,
               last_used_at = NULL
           WHERE id = ?
             AND revoked_at IS NULL
           RETURNING *`
        )
        .get(hashIntegrationToken(token), displayPrefix(token), id) ?? null;

    return row ? { token, record: publicToken(row) } : null;
  }

  revoke(id: string): boolean {
    const info = this.db.run(
      `UPDATE integration_tokens
       SET revoked_at = COALESCE(revoked_at, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       WHERE id = ?`,
      [id]
    );
    return info.changes > 0;
  }

  verify(token: string): PublicIntegrationToken | null {
    const tokenHash = hashIntegrationToken(token);
    return this.db.transaction(() => {
      const row =
        this.db
          .query<IntegrationTokenRow, [string]>(
            `SELECT *
             FROM integration_tokens
             WHERE token_hash = ?
               AND revoked_at IS NULL`
          )
          .get(tokenHash) ?? null;

      if (!row) return null;

      const updated =
        this.db
          .query<IntegrationTokenRow, [string]>(
            `UPDATE integration_tokens
             SET last_used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
             WHERE id = ?
             RETURNING *`
          )
          .get(row.id) ?? row;

      return publicToken(updated);
    })();
  }
}
