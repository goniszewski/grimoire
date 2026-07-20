import { version as APP_VERSION } from "../../package.json";
import { isPrivateHost } from "../lib/network.js";

export const DEFAULT_UPDATE_SOURCE = "https://api.github.com/repos/goniszewski/grimoire/releases";

export type UpdateChannel = "stable" | "beta";

export type GitHubRelease = {
  tag_name?: unknown;
  name?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  html_url?: unknown;
};

export type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

export type UpdateRelease = {
  version: string;
  tag: string;
  name: string;
  prerelease: boolean;
  published_at: string;
  url: string;
};

export type UpdateCheckResult = {
  current_version: string;
  update_available: boolean;
  source: string;
  channel: UpdateChannel;
  latest: UpdateRelease | null;
};

export class UpdateCheckError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "UpdateCheckError";
  }
}

export function defaultUpdateChannel(currentVersion = APP_VERSION): UpdateChannel {
  return currentVersion.includes("-") ? "beta" : "stable";
}

export function parseUpdateChannel(value: string | null | undefined, currentVersion = APP_VERSION): UpdateChannel {
  if (!value) return defaultUpdateChannel(currentVersion);
  if (value === "stable" || value === "beta") return value;
  throw new UpdateCheckError("channel must be stable or beta.", 422);
}

export function resolveUpdateSource(
  source: string | null | undefined,
  options: { allowPrivateHosts?: boolean } = {}
): string {
  const resolved = source?.trim() ? source.trim() : DEFAULT_UPDATE_SOURCE;
  let url: URL;
  try {
    url = new URL(resolved);
  } catch {
    throw new UpdateCheckError("source must be a valid http or https URL.", 422);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UpdateCheckError("source must be a valid http or https URL.", 422);
  }

  if (!options.allowPrivateHosts && isPrivateHost(url.hostname)) {
    throw new UpdateCheckError("source must not target a private or loopback host.", 422);
  }

  return resolved;
}

function displayUpdateSource(source: string): string {
  try {
    const url = new URL(source);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "configured update source";
  }
}

function redactUpdateErrorMessage(err: unknown, source: string): string {
  let message = err instanceof Error && err.message ? err.message : String(err);
  const safeSource = displayUpdateSource(source);
  const sensitiveValues = new Set<string>([source]);

  try {
    const url = new URL(source);
    sensitiveValues.add(url.toString());
    if (url.username) sensitiveValues.add(url.username);
    if (url.password) sensitiveValues.add(url.password);
    if (url.search) sensitiveValues.add(url.search);
    if (url.hash) sensitiveValues.add(url.hash);
  } catch {
    // Invalid sources are rejected before fetch; keep a conservative fallback.
  }

  const sortedSensitiveValues = [...sensitiveValues]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const sensitive of sortedSensitiveValues) {
    const replacement = sensitive === source ? safeSource : "[redacted]";
    message = message.split(sensitive).join(replacement);
  }

  return message.trim() || "fetch failed";
}

export function parseVersion(raw: string): ParsedVersion | null {
  const normalized = raw.trim().replace(/^v/i, "").split("+", 1)[0];
  const match = normalized.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?$/
  );
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const prerelease = match[4] ?? "";
  return {
    major,
    minor,
    patch,
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const leftPart = left[i];
    const rightPart = right[i];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);
    const leftIsNumber = Number.isInteger(leftNumber);
    const rightIsNumber = Number.isInteger(rightNumber);
    if (leftIsNumber && rightIsNumber) return Math.sign(leftNumber - rightNumber);
    if (leftIsNumber) return -1;
    if (rightIsNumber) return 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

export function compareVersions(leftRaw: string, rightRaw: string): number {
  const left = parseVersion(leftRaw);
  const right = parseVersion(rightRaw);
  if (!left || !right) return 0;
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return Math.sign(left[key] - right[key]);
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function normalizeRelease(release: GitHubRelease): UpdateRelease | null {
  if (release.draft === true) return null;
  if (typeof release.tag_name !== "string") return null;
  const version = release.tag_name.trim().replace(/^v/i, "");
  if (!parseVersion(version)) return null;
  return {
    version,
    tag: release.tag_name,
    name: typeof release.name === "string" && release.name.trim() ? release.name : release.tag_name,
    prerelease: release.prerelease === true,
    published_at: typeof release.published_at === "string" ? release.published_at : "",
    url: typeof release.html_url === "string" ? release.html_url : "",
  };
}

function releaseMatchesChannel(release: UpdateRelease, channel: UpdateChannel): boolean {
  return channel === "beta" || !release.prerelease;
}

export function findLatestCompatibleRelease(
  releases: GitHubRelease[],
  channel: UpdateChannel
): UpdateRelease | null {
  return releases
    .map(normalizeRelease)
    .filter((release): release is UpdateRelease => Boolean(release))
    .filter((release) => releaseMatchesChannel(release, channel))
    .sort((left, right) => compareVersions(right.version, left.version))[0] ?? null;
}

export async function fetchUpdateReleases(
  fetchImpl: typeof fetch,
  source: string,
  currentVersion = APP_VERSION
): Promise<GitHubRelease[]> {
  let res: Response;
  try {
    res = await fetchImpl(source, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": `littleimp-update-check/${currentVersion}`,
      },
    });
  } catch (err) {
    throw new UpdateCheckError(
      `Could not check updates at ${displayUpdateSource(source)}: ${redactUpdateErrorMessage(err, source)}`
    );
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new UpdateCheckError(`Update source returned non-JSON response with status ${res.status}`);
    }
  }

  if (!res.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Update check failed with status ${res.status}`;
    throw new UpdateCheckError(`Update source ${displayUpdateSource(source)} returned ${res.status}: ${message}`);
  }

  if (!Array.isArray(payload)) {
    throw new UpdateCheckError("Update source returned an unexpected response.");
  }

  return payload as GitHubRelease[];
}

export async function checkForUpdates(options: {
  source?: string;
  channel?: UpdateChannel;
  fetchImpl?: typeof fetch;
  currentVersion?: string;
  allowPrivateHosts?: boolean;
} = {}): Promise<UpdateCheckResult> {
  const currentVersion = options.currentVersion ?? APP_VERSION;
  const source = resolveUpdateSource(options.source, { allowPrivateHosts: options.allowPrivateHosts });
  const channel = options.channel ?? defaultUpdateChannel(currentVersion);
  const releases = await fetchUpdateReleases(options.fetchImpl ?? fetch, source, currentVersion);
  const latest = findLatestCompatibleRelease(releases, channel);

  return {
    current_version: currentVersion,
    update_available: latest ? compareVersions(latest.version, currentVersion) > 0 : false,
    source,
    channel,
    latest,
  };
}
