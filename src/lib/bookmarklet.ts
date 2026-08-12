/**
 * Grimoire Bookmarklet URL Generator
 *
 * The bookmarklet source is stored as a minified template string with
 * __TOKEN__ and __DAEMON_URL__ placeholders. At generation time (in the
 * Settings page), these are replaced with the user's integration token and
 * daemon URL, then wrapped in a javascript: URI for the user to drag to
 * their bookmarks bar.
 *
 * The bookmarklet works by:
 * 1. Reading document.location.href, document.title, and selection text
 * 2. Showing an in-page toast overlay ("Saving to Grimoire...")
 * 3. Creating a hidden iframe pointing to GET /capture/bookmarklet (avoids CORS)
 * 4. Updating the toast to "Saved!" after a delay, then removing it
 */

const DEFAULT_DAEMON_URL = "http://127.0.0.1:3210";

/**
 * Minified bookmarklet template.
 * Placeholders: __TOKEN_JSON__, __DAEMON_URL_JSON__
 * Values are injected via JSON.stringify so quotes/backslashes cannot break JS.
 *
 * Keep this small — it's inlined into every bookmarklet generation.
 */
const BOOKMARKLET_TEMPLATE = `!function(){var e=encodeURIComponent(document.location.href),t=encodeURIComponent(document.title),n=window.getSelection()?.toString()||"",o=encodeURIComponent(n);if(document.getElementById("__limp_bm"))return;var r=document.createElement("div");r.id="__limp_bm",r.style.cssText="position:fixed;top:16px;right:16px;z-index:2147483647;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;font:14px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;max-width:360px;word-break:break-word;transition:opacity .3s";var s=document.createElement("span");s.textContent="\\u23F3",r.appendChild(s);var a=document.createElement("span");a.textContent="Saving to Grimoire\\u2026",r.appendChild(a),document.body.appendChild(r);var i=document.createElement("iframe");i.style.cssText="display:none",i.src=__DAEMON_URL_JSON__+"/capture/bookmarklet?url="+e+"&title="+t+"&token="+encodeURIComponent(__TOKEN_JSON__)+(o?"&selection="+o:""),document.body.appendChild(i),setTimeout(function(){var e=document.getElementById("__limp_bm");if(e){s.textContent="\\u2705",a.textContent="Saved!",e.style.background="#16a34a"}},2500),setTimeout(function(){var e=document.getElementById("__limp_bm");if(e){e.style.opacity="0";setTimeout(function(){var e=document.getElementById("__limp_bm");e&&e.remove()},300)}},5e3)}();`;

/**
 * Generate a bookmarklet javascript: URL with the given token embedded.
 */
export function generateBookmarkletUrl(token: string, daemonUrl = DEFAULT_DAEMON_URL): string {
  const minified = BOOKMARKLET_TEMPLATE
    .replace(/__TOKEN_JSON__/g, JSON.stringify(token))
    .replace(/__DAEMON_URL_JSON__/g, JSON.stringify(daemonUrl));
  return `javascript:${minified}`;
}
