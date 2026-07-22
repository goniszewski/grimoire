/**
 * Bind-address policy for the local-first daemon.
 *
 * Native defaults remain loopback-only. Wildcard / non-loopback binds require an
 * explicit opt-in (or a known container layout) and always emit a warning.
 */

import { existsSync } from "fs";
import { isPrivateHost } from "./network.js";

export class BindHostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindHostError";
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isWildcardHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  return host === "0.0.0.0" || host === "::" || host === "*";
}

function envFlagEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isContainerBindContext(env: NodeJS.ProcessEnv = process.env): boolean {
  if (envFlagEnabled(env.LITTLEIMP_IN_CONTAINER)) return true;
  if (env.DATA_DIR === "/data") return true;
  // Only probe /.dockerenv when consulting the live process environment so unit
  // tests can pass an isolated env object without inheriting the host container.
  if (env === process.env) {
    try {
      return existsSync("/.dockerenv");
    } catch {
      return false;
    }
  }
  return false;
}

export function allowNonLoopbackBind(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    envFlagEnabled(env.LITTLEIMP_ALLOW_NON_LOOPBACK_BIND) ||
    envFlagEnabled(env.ALLOW_NON_LOOPBACK_BIND) ||
    isContainerBindContext(env)
  );
}

/**
 * Resolve the hostname passed to Bun.serve.
 * Throws BindHostError when the bind is not permitted.
 */
export function resolveBindHost(
  rawHost: string,
  env: NodeJS.ProcessEnv = process.env
): { host: string; warning: string | null } {
  const host = rawHost.trim() || "127.0.0.1";

  if (isLoopbackHostname(host)) {
    return { host, warning: null };
  }

  const allowed = allowNonLoopbackBind(env);
  if (!allowed) {
    throw new BindHostError(
      `Refusing to bind HOST=${host}. Loopback (127.0.0.1 / ::1) is required unless ` +
        `LITTLEIMP_ALLOW_NON_LOOPBACK_BIND=1 is set, or the process is running in a container. ` +
        `Public-network exposure is not a supported Grimoire mode.`
    );
  }

  const isWildcard = isWildcardHostname(host);
  const looksPrivate = isPrivateHost(host) || isWildcard;
  const warning = isWildcard
    ? `HOST=${host} binds all interfaces inside this process. Safe only when the host/port publish is loopback-restricted (e.g. docker -p 127.0.0.1:3210:3210).`
    : looksPrivate
      ? `HOST=${host} is a non-loopback bind. Ensure firewalling and that only trusted local clients can reach the daemon.`
      : `HOST=${host} is a non-loopback bind. Public exposure of tokenless REST routes is unsupported and dangerous.`;

  return { host, warning };
}
