/**
 * Grimoire Bookmarklet Source
 *
 * This is the source for the bookmarklet that gets injected into a javascript: URL.
 * At generation time, __TOKEN__ is replaced with the user's integration token and
 * __DAEMON_URL__ is replaced with the daemon base URL (default http://127.0.0.1:3210).
 *
 * The bookmarklet runs in the context of any webpage the user visits.
 * It reads the page URL/title/selected text, sends them to the local daemon
 * via a hidden iframe (to avoid CORS issues), and shows an in-page toast overlay.
 *
 * This file is NOT imported by the app — it is served as raw JS text
 * and embedded into a javascript: URI by the Settings page.
 */

// These placeholders are replaced at token-generation time in the Settings page
const TOKEN: string = "__TOKEN__";
const DAEMON_URL: string = "__DAEMON_URL__";

(function () {
  // ── Read page metadata ──────────────────────────────────────────────
  const url = encodeURIComponent(document.location.href);
  const title = encodeURIComponent(document.title);
  const selection = window.getSelection()?.toString() || "";
  const selEncoded = encodeURIComponent(selection);

  // ── Only run once per page ──────────────────────────────────────────
  if ((document.getElementById("__limp_bm") as HTMLElement | null) !== null) {
    return;
  }

  // ── Create toast overlay ────────────────────────────────────────────
  const toast = document.createElement("div");
  toast.id = "__limp_bm";
  toast.setAttribute(
    "style",
    "position:fixed;top:16px;right:16px;z-index:2147483647;" +
      "background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;" +
      "font:14px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;" +
      "box-shadow:0 4px 16px rgba(0,0,0,0.25);" +
      "display:flex;align-items:center;gap:8px;" +
      "max-width:360px;word-break:break-word;" +
      "transition:opacity 0.3s"
  );

  const spinner = document.createElement("span");
  spinner.textContent = "\u23F3"; // hourglass
  toast.appendChild(spinner);

  const label = document.createElement("span");
  label.textContent = "Saving to Grimoire\u2026";
  toast.appendChild(label);

  document.body.appendChild(toast);

  // ── Submit via hidden iframe (avoids CORS) ──────────────────────────
  const iframe = document.createElement("iframe");
  iframe.setAttribute("style", "display:none");
  const src =
    DAEMON_URL +
    "/capture/bookmarklet?url=" +
    url +
    "&title=" +
    title +
    "&token=" +
    encodeURIComponent(TOKEN) +
    (selEncoded ? "&selection=" + selEncoded : "");
  iframe.setAttribute("src", src);
  document.body.appendChild(iframe);

  // ── Update toast after a short delay ────────────────────────────────
  setTimeout(function () {
    const el = document.getElementById("__limp_bm");
    if (el) {
      spinner.textContent = "\u2705"; // check mark
      label.textContent = "Saved!";
      el.style.background = "#16a34a";
    }
  }, 2500);

  // ── Remove toast after a longer delay ───────────────────────────────
  setTimeout(function () {
    const el = document.getElementById("__limp_bm");
    if (el) {
      el.style.opacity = "0";
      setTimeout(function () {
        const el2 = document.getElementById("__limp_bm");
        if (el2) el2.remove();
      }, 300);
    }
  }, 5000);
})();
