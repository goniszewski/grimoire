/**
 * Grimoire Bookmarklet URL Generator
 *
 * The generated bookmarklet runs in the page's context, so restrictive host
 * page CSPs can block subresource requests. It opens a short-lived top-level
 * Grimoire bridge instead. The bridge receives the capture payload and token
 * through postMessage, then performs the authenticated same-origin POST to
 * /capture and returns the confirmed result.
 */

const DEFAULT_DAEMON_URL = "http://127.0.0.1:3210";

/**
 * Self-contained bookmarklet template.
 *
 * Placeholders are injected via JSON.stringify so quotes and backslashes in
 * tokens or URLs cannot break the generated javascript: URI. The token is
 * sent only in the postMessage payload; it is never part of a request URL.
 */
const BOOKMARKLET_TEMPLATE = `!function(){var e=document.location.href,t=document.title,n=(window.getSelection()?.toString()||"").slice(0,1e4);if(document.getElementById("__limp_bm"))return;var o=document.createElement("div");o.id="__limp_bm",o.style.cssText="position:fixed;top:16px;right:16px;z-index:2147483647;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;font:14px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;max-width:360px;word-break:break-word;transition:opacity .3s";var i=document.createElement("span");i.textContent="\\u23F3",o.appendChild(i);var a=document.createElement("span");a.textContent="Saving to Grimoire\\u2026",o.appendChild(a),document.body.appendChild(o);var r=Date.now().toString(36)+"_"+Math.random().toString(36).slice(2),s=null,c=null,d=null,l=!1;function u(e,t,n){if(l)return;l=!0,c&&clearTimeout(c),d&&clearInterval(d),window.removeEventListener("message",f),s&&s.close(),i.textContent=e,a.textContent=t,o.style.background=n,setTimeout(function(){o.style.opacity="0",setTimeout(function(){o.remove()},300)},5e3)}function p(e){u("\\u26A0",e,"#dc2626")}function f(e){if(e.source!==s||e.origin!==__DAEMON_ORIGIN_JSON__)return;var t=e.data;if(!t||t.nonce!==r)return;if(t.type==="grimoire-bookmarklet-ready"){try{s.postMessage({type:"grimoire-bookmarklet-request",nonce:r,token:__TOKEN_JSON__,payload:{url:window.location.href,title:document.title,source:{client:"bookmarklet",selected_text:n||null}}},__DAEMON_ORIGIN_JSON__)}catch(e){p("Grimoire capture could not start")}return}if(t.type!=="grimoire-bookmarklet-result")return;c&&clearTimeout(c);if(t.ok){u("\\u2705",t.created===!1?"Already saved":"Saved!",t.created===!1?"#2563eb":"#16a34a");return}var o=typeof t.detail==="string"?t.detail.slice(0,180):"",i=t.status===401?"Bookmarklet token expired or revoked":t.status===409?o||"This page is already saved":t.status===422?o||"This page cannot be saved":t.status===0?"The Grimoire daemon could not be reached":"Grimoire could not save this page";p(i)}window.addEventListener("message",f);try{s=window.open(__DAEMON_URL_JSON__+"/capture/bookmarklet#nonce="+encodeURIComponent(r),"grimoire_capture_"+r,"popup,width=420,height=180")}catch(e){p("Grimoire capture could not start")}if(!s){p("Allow the Grimoire capture window to open");return}c=setTimeout(function(){p("Grimoire capture timed out")},1e4),d=setInterval(function(){s&&s.closed&&!l&&p("Capture window closed before Grimoire confirmed the save")},250)}();`;

/**
 * Generate a bookmarklet javascript: URI with the given token embedded.
 */
export function generateBookmarkletUrl(token: string, daemonUrl = DEFAULT_DAEMON_URL): string {
  let daemonOrigin = daemonUrl;
  try {
    daemonOrigin = new URL(daemonUrl).origin;
  } catch {
    // Preserve the previous permissive generator behavior for custom values;
    // the bridge will surface a useful failure if the browser cannot open it.
  }

  const replacements: Record<string, string> = {
    __TOKEN_JSON__: JSON.stringify(token),
    __DAEMON_URL_JSON__: JSON.stringify(daemonUrl),
    __DAEMON_ORIGIN_JSON__: JSON.stringify(daemonOrigin),
  };
  const minified = BOOKMARKLET_TEMPLATE.replace(
    /__TOKEN_JSON__|__DAEMON_URL_JSON__|__DAEMON_ORIGIN_JSON__/g,
    (placeholder) => replacements[placeholder]
  );
  return `javascript:${minified}`;
}
