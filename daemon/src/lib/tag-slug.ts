const MAX_TAG_SLUG_LENGTH = 50;

/**
 * Turn an arbitrary tag label from another tool into the tag format the API
 * enforces: lowercase letters, digits, and single hyphens. Returns an empty
 * string when nothing usable is left (for example a tag written only in a
 * non-Latin script).
 *
 *   "Web Dev" → "web-dev",  "über" → "uber",  "c++" → "c-plus-plus",  "C#" → "c-sharp"
 */
export function slugifyTagName(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/(?<=[a-z0-9])\++/g, (run) => " plus".repeat(run.length) + " ")
    .replace(/(?<=[a-z0-9])#/g, " sharp ")
    .replace(/&/g, " and ")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.slice(0, MAX_TAG_SLUG_LENGTH).replace(/-+$/g, "");
}
