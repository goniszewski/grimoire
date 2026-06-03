import { useState, useEffect, useRef } from "react";
import { DAEMON_URL } from "@/lib/api";

const STORAGE_KEY_LAST_CHECK = "littleimp_update_last_check_ms";
const STORAGE_KEY_DISMISSED_VERSION = "littleimp_update_dismissed_version";
const DEBOUNCE_MS = 6 * 60 * 60 * 1000; // 6 hours

/** The shape of an update check result — mirrors the daemon contract without deep generics. */
export interface UpdateCheckResult {
  current_version: string;
  update_available: boolean;
  source: string;
  channel: string;
  latest: {
    version: string;
    tag: string;
    name: string;
    prerelease: boolean;
    published_at: string;
    url: string;
  } | null;
}

interface UseUpdateCheckResult {
  /** The update check result, or null if not yet fetched / errored. */
  result: UpdateCheckResult | null;
  /** True while the initial check is in flight. */
  loading: boolean;
  /** True if the check completed and an update is available AND not dismissed. */
  showBanner: boolean;
  /** Dismiss the current available update (persists the version). */
  dismiss: () => void;
}

export function useUpdateCheck(): UseUpdateCheckResult {
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_DISMISSED_VERSION);
    } catch {
      return null;
    }
  });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;

    // Check debounce: skip if we checked within the last 6 hours
    try {
      const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
      if (lastCheck) {
        const elapsed = Date.now() - Number(lastCheck);
        if (elapsed < DEBOUNCE_MS) {
          setLoading(false);
          fetchedRef.current = true;
          return;
        }
      }
    } catch {
      // localStorage unavailable — proceed with the check
    }

    setLoading(true);
    fetch(`${DAEMON_URL}/updates/check`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ data: UpdateCheckResult }>;
      })
      .then((json) => {
        setResult(json.data ?? null);
        try {
          localStorage.setItem(STORAGE_KEY_LAST_CHECK, String(Date.now()));
        } catch {
          // non-critical
        }
      })
      .catch(() => {
        // Daemon unreachable or error — silently ignore, never show banner
        setResult(null);
      })
      .finally(() => {
        setLoading(false);
        fetchedRef.current = true;
      });
  }, []);

  const updateAvailable = result?.update_available === true;
  const latestTag = result?.latest?.tag ?? null;
  const dismissedForThisVersion =
    dismissedVersion !== null && latestTag !== null && dismissedVersion === latestTag;

  const showBanner = updateAvailable && !dismissedForThisVersion;

  const dismiss = () => {
    if (latestTag) {
      try {
        localStorage.setItem(STORAGE_KEY_DISMISSED_VERSION, latestTag);
      } catch {
        // non-critical
      }
      setDismissedVersion(latestTag);
    }
  };

  return { result, loading, showBanner, dismiss };
}
