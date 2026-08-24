/** Centralized build-time switch for the static public demo profile. */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export const demoRouterBasename =
  isDemoMode && import.meta.env.BASE_URL !== "/"
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : undefined;

export const DEMO_API_PATH = "/__api";
export const DEMO_INSTALL_URL =
  import.meta.env.VITE_DEMO_INSTALL_URL ?? "https://github.com/goniszewski/grimoire#quick-start";

export function demoApiBase(): string {
  if (typeof location === "undefined") return DEMO_API_PATH;
  return `${location.origin}${DEMO_API_PATH}`;
}
