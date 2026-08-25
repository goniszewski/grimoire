const DEMO_STORAGE_KEYS = [
  "little-imp-library-view-preferences",
  "littleimp_guided_tour_dismissed",
  "little-imp-lock-hash",
  "little-imp-lock-timeout",
  "little-imp-lock-enabled",
  "degraded_banner_dismissed",
  "littleimp_update_last_check_ms",
  "littleimp_update_dismissed_version",
];

export function clearDemoLocalState(): void {
  for (const key of DEMO_STORAGE_KEYS) {
    globalThis.localStorage?.removeItem(key);
  }
}
