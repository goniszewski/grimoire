/**
 * Minimal cron expression utilities.
 *
 * Supports standard 5-part cron: "minute hour dom month dow"
 * Handles exact values and "*". Step expressions (e.g. "* /n") are treated as
 * wildcards for interval purposes.
 *
 * This is intentionally minimal — it covers daily/weekly schedules without
 * pulling in a full cron library.
 */

/**
 * Returns the approximate interval in milliseconds for a cron expression.
 * Used to schedule the backup task with setInterval.
 *
 * Heuristic (smallest implied period):
 * - dow or dom is a fixed value → weekly
 * - hour is a fixed value       → daily
 * - minute is a fixed value     → hourly
 * - all wildcards               → daily (fallback)
 */
export function cronToIntervalMs(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return 24 * 60 * 60_000; // 1 day fallback

  const [minute, hour, dom, , dow] = parts;

  const ONE_HOUR = 60 * 60_000;
  const ONE_DAY = 24 * ONE_HOUR;
  const ONE_WEEK = 7 * ONE_DAY;

  if (isFixed(dow) || isFixed(dom)) return ONE_WEEK;
  if (isFixed(hour)) return ONE_DAY;
  if (isFixed(minute)) return ONE_HOUR;
  return ONE_DAY;
}

/** Returns true if the field represents a single fixed value (not a wildcard or step). */
function isFixed(field: string): boolean {
  return field !== "*" && /^\d+$/.test(field);
}

/**
 * Computes the next Date when a 5-part cron expression will fire, based only
 * on the minute and hour fields (dom/month/dow are not yet evaluated).
 *
 * - If hour is "*", returns null — a fixed next_run_at cannot be determined.
 * - If minute is "*", defaults to :00 of the next matching hour.
 * - Returns null if the expression cannot be parsed.
 */
export function nextCronRunAt(cron: string): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteStr, hourStr] = parts;

  // If both fields are wildcards, we cannot pinpoint a next-run time.
  if (hourStr === "*") return null;

  const hour = parseInt(hourStr, 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;

  // Minute defaults to 0 when the field is a wildcard.
  let minute = 0;
  if (minuteStr !== "*") {
    minute = parseInt(minuteStr, 10);
    if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  }

  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(minute);
  next.setHours(hour);

  // If the computed time is in the past (or equal to now), advance by one day.
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}
