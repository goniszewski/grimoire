/**
 * Build FTS summary text from description + content summary without dropping either.
 * Used by pipeline index and legacy migrate content upserts.
 */
export function combineFtsSummary(
  description: string | null | undefined,
  summary: string | null | undefined
): string {
  const desc = description?.trim() ?? "";
  const sum = summary?.trim() ?? "";
  if (!desc) return sum;
  if (!sum) return desc;
  if (sum.includes(desc)) return sum;
  if (desc.includes(sum)) return desc;
  return `${desc} ${sum}`;
}
