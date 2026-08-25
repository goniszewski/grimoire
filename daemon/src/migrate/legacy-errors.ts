/** Shared error types for the v0.5 → 1.x migrator (kept separate to avoid circular imports). */

export class LegacySourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacySourceError";
  }
}

export class LegacyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacyAuthError";
  }
}
