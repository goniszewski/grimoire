import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ApiBookmark } from "@/lib/api";
import { findActiveBookmarkByUrl, parseShareLinkParams, SHARE_LINK_PATH, type SharePrefill } from "@/lib/share-link";

interface UseShareLinkOptions {
  /** False while the app is locked or in demo mode; the link is then ignored (and cleared). */
  enabled: boolean;
  onAdd: (prefill: SharePrefill | null) => void;
  onEditExisting: (bookmark: ApiBookmark) => void;
}

/**
 * Consumes `/add?url=&title=&note=&tags=`: strips the params from the address
 * bar immediately, then opens the add dialog prefilled, or the existing
 * bookmark for that URL in edit mode.
 */
export function useShareLink({ enabled, onAdd, onEditExisting }: UseShareLinkOptions): void {
  const location = useLocation();
  const navigate = useNavigate();
  const handlers = useRef({ onAdd, onEditExisting });
  handlers.current = { onAdd, onEditExisting };

  const isShareLink = location.pathname === SHARE_LINK_PATH;
  const search = location.search;

  useEffect(() => {
    if (!isShareLink || !enabled) return;
    const prefill = parseShareLinkParams(new URLSearchParams(search));
    navigate("/", { replace: true });

    void (async () => {
      if (prefill?.url) {
        try {
          const existing = await findActiveBookmarkByUrl(prefill.url);
          if (existing) {
            handlers.current.onEditExisting(existing);
            return;
          }
        } catch {
          // Lookup failed (daemon unreachable?): fall through to the prefilled add dialog.
        }
      }
      handlers.current.onAdd(prefill);
    })();
  }, [isShareLink, enabled, search, navigate]);
}
