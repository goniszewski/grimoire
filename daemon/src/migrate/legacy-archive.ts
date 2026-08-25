import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "fs";
import { tmpdir } from "os";
import { basename, extname, join, resolve, sep } from "path";
import { spawnSync } from "child_process";
import { LegacySourceError } from "./legacy-errors.js";
import type { LegacySourcePaths } from "./legacy-types.js";

export type LegacyArchiveFormat =
  | "zip"
  | "tar"
  | "tar.gz"
  | "tar.bz2"
  | "tar.xz";

/** Soft budgets against zip-bombs / pathological archives (checked post-extract). */
const MAX_EXTRACT_FILES = 100_000;
const MAX_EXTRACT_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB
const MAX_ARCHIVE_MEMBERS = 100_000;
/** Shared walk limit for post-extract safety + db.sqlite discovery. */
export const MAX_EXTRACT_TREE_DEPTH = 64;

const ARCHIVE_EXTENSIONS: Array<{ suffix: string; format: LegacyArchiveFormat }> = [
  { suffix: ".tar.gz", format: "tar.gz" },
  { suffix: ".tgz", format: "tar.gz" },
  { suffix: ".tar.bz2", format: "tar.bz2" },
  { suffix: ".tbz2", format: "tar.bz2" },
  { suffix: ".tbz", format: "tar.bz2" },
  { suffix: ".tar.xz", format: "tar.xz" },
  { suffix: ".txz", format: "tar.xz" },
  { suffix: ".tar", format: "tar" },
  { suffix: ".zip", format: "zip" },
];

export function detectLegacyArchiveFormat(path: string): LegacyArchiveFormat | null {
  const lower = path.toLowerCase();
  for (const entry of ARCHIVE_EXTENSIONS) {
    if (lower.endsWith(entry.suffix)) return entry.format;
  }
  return null;
}

export function isLegacyArchivePath(path: string): boolean {
  return detectLegacyArchiveFormat(path) !== null;
}

function runCapture(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error) {
    throw new LegacySourceError(
      `Failed to run ${command} (${result.error.message}). Install ${command} to extract archives.`
    );
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new LegacySourceError(
      `Failed to inspect/extract archive with ${command}${detail ? `: ${detail}` : ""}`
    );
  }
  return result.stdout ?? "";
}

function runExtract(command: string, args: string[]): void {
  runCapture(command, args);
}

function isUnsafeArchiveMember(entry: string): boolean {
  const trimmed = entry.replace(/\0/g, "").trim();
  if (!trimmed || trimmed === "." || trimmed === "./") return false;
  const normalized = trimmed.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) return true;
  if (normalized.split("/").some((part) => part === "..")) return true;
  if (normalized.includes("\0")) return true;
  return false;
}

function memberNameFromZipinfoLine(line: string): string {
  const arrow = line.indexOf(" -> ");
  const body = arrow >= 0 ? line.slice(0, arrow) : line;
  const parts = body.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "unknown";
}

function memberNameFromTarVerboseLine(line: string): string {
  const arrow = line.indexOf(" -> ");
  const body = arrow >= 0 ? line.slice(0, arrow) : line;
  // Strip the fixed metadata prefix; name is the remainder (may contain spaces).
  const match = body.match(
    /^[a-zA-Z-]{10}\s+\d+\s+\S+\s+\S+\s+\d+\s+\S+\s+\d+\s+(?:\d{4}|\d+:\d+)\s+(.*)$/
  );
  return match?.[1]?.trim() || memberNameFromZipinfoLine(body);
}

/** Refuse symlink/hardlink members from `unzip -Z` / zipinfo long listing. */
function assertZipListingHasNoLinks(listing: string): void {
  for (const raw of listing.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("Archive:") || line.startsWith("Zip file size:")) continue;
    if (/^\d+ files?,/.test(line)) continue;
    if (!/^[lh]/.test(line)) continue;
    throw new LegacySourceError(
      `Archive contains a symlink or hardlink (${memberNameFromZipinfoLine(line)}); refusing to extract for safety`
    );
  }
}

/** Refuse symlink/hardlink members from `tar -tvf` listing. */
function assertTarListingHasNoLinks(listing: string): void {
  for (const raw of listing.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!/^[lh]/.test(line)) continue;
    throw new LegacySourceError(
      `Archive contains a symlink or hardlink (${memberNameFromTarVerboseLine(line)}); refusing to extract for safety`
    );
  }
}

/**
 * Reject absolute paths, parent traversal, drive-letter paths, and link members
 * before extraction (zip-slip + symlink write-through protection).
 */
export function assertArchiveMembersSafe(archivePath: string, format: LegacyArchiveFormat): void {
  let listing: string;
  if (format === "zip") {
    assertZipListingHasNoLinks(runCapture("unzip", ["-Z", archivePath]));
    listing = runCapture("unzip", ["-Z1", archivePath]);
  } else {
    assertTarListingHasNoLinks(runCapture("tar", ["-tvf", archivePath]));
    listing = runCapture("tar", ["-tf", archivePath]);
  }

  let memberCount = 0;
  for (const line of listing.split(/\r?\n/)) {
    if (!line.trim()) continue;
    memberCount += 1;
    if (memberCount > MAX_ARCHIVE_MEMBERS) {
      throw new LegacySourceError(
        `Archive lists more than ${MAX_ARCHIVE_MEMBERS} members; refusing to extract`
      );
    }
    if (isUnsafeArchiveMember(line)) {
      throw new LegacySourceError(
        `Archive contains an unsafe path (${line}). Refusing to extract (zip-slip protection).`
      );
    }
  }
}

function isSafeUnderRoot(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  return (
    resolvedCandidate === resolvedRoot ||
    resolvedCandidate.startsWith(resolvedRoot + sep)
  );
}

/**
 * After extraction, reject symlink / hardlink targets and enforce extract budgets.
 * Fail closed: depth overflow or unreadable entries refuse the archive rather than
 * skipping safety checks under that subtree.
 */
export function assertExtractTreeSafe(root: string, maxDepth = MAX_EXTRACT_TREE_DEPTH): void {
  let fileCount = 0;
  let totalBytes = 0;

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) {
      throw new LegacySourceError(
        `Extracted archive exceeds maximum directory depth (${maxDepth}); refusing to extract`
      );
    }
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new LegacySourceError(
        `Cannot read extracted archive directory (${basename(dir)}): ${detail}`
      );
    }
    for (const name of entries) {
      if (name === "." || name === ".." || name.startsWith("._")) continue;
      const full = join(dir, name);
      if (!isSafeUnderRoot(root, full)) {
        throw new LegacySourceError("Extracted archive path escaped the temporary directory");
      }
      let st;
      try {
        st = lstatSync(full);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new LegacySourceError(
          `Cannot inspect extracted archive entry (${name}): ${detail}`
        );
      }
      if (st.isSymbolicLink()) {
        // Refuse all symlinks in extracted archives. Even "in-tree" links are a
        // zip-slip / TOCTOU hazard once extract tools materialize them.
        throw new LegacySourceError(
          `Archive contains a symlink (${name}); refusing to extract for safety`
        );
      }
      if (st.isFile()) {
        if (st.nlink > 1) {
          throw new LegacySourceError(
            `Archive contains a hardlink (${name}); refusing to extract for safety`
          );
        }
        fileCount += 1;
        totalBytes += st.size;
        if (fileCount > MAX_EXTRACT_FILES) {
          throw new LegacySourceError(
            `Archive expands to more than ${MAX_EXTRACT_FILES} files; refusing to extract`
          );
        }
        if (totalBytes > MAX_EXTRACT_BYTES) {
          throw new LegacySourceError(
            `Archive expands beyond ${MAX_EXTRACT_BYTES} bytes; refusing to extract`
          );
        }
      }
      if (st.isDirectory()) walk(full, depth + 1);
    }
  }

  walk(root, 0);
}

export function extractLegacyArchive(archivePath: string, destDir?: string): string {
  const absolute = resolve(archivePath);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new LegacySourceError(`Archive not found: ${absolute}`);
  }

  const format = detectLegacyArchiveFormat(absolute);
  if (!format) {
    throw new LegacySourceError(
      `Unsupported archive format for ${basename(absolute)}. ` +
        "Supported: .zip, .tar, .tar.gz/.tgz, .tar.bz2/.tbz2, .tar.xz/.txz"
    );
  }

  assertArchiveMembersSafe(absolute, format);

  if (destDir) {
    const resolvedDest = resolve(destDir);
    mkdirSync(resolvedDest, { recursive: true });
    const existing = readdirSync(resolvedDest).filter((n) => n !== "." && n !== "..");
    if (existing.length > 0) {
      throw new LegacySourceError(
        "Archive extract destination must be empty (refusing to overwrite existing files)"
      );
    }
  }

  const extractDir =
    destDir ?? mkdtempSync(join(tmpdir(), "grimoire-v05-archive-"));
  mkdirSync(extractDir, { recursive: true });

  try {
    if (format === "zip") {
      runExtract("unzip", ["-qo", absolute, "-d", extractDir]);
    } else if (format === "tar") {
      runExtract("tar", ["-xf", absolute, "-C", extractDir]);
    } else if (format === "tar.gz") {
      runExtract("tar", ["-xzf", absolute, "-C", extractDir]);
    } else if (format === "tar.bz2") {
      runExtract("tar", ["-xjf", absolute, "-C", extractDir]);
    } else {
      runExtract("tar", ["-xJf", absolute, "-C", extractDir]);
    }
    assertExtractTreeSafe(extractDir);
  } catch (err) {
    if (!destDir) cleanupExtractDir(extractDir);
    throw err;
  }

  return extractDir;
}

export function cleanupExtractDir(extractDir: string): void {
  rmSync(extractDir, { recursive: true, force: true });
}

/**
 * Find db.sqlite under an extracted archive.
 * Prefers the shallowest .../data/db.sqlite, then the shallowest any db.sqlite.
 * Walk depth matches assertExtractTreeSafe so a deep real library is not lost to a shallow decoy.
 */
export function findDbSqliteInTree(root: string, maxDepth = MAX_EXTRACT_TREE_DEPTH): string {
  const matches: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) {
      throw new LegacySourceError(
        `Archive tree exceeds maximum directory depth (${maxDepth}) while searching for db.sqlite`
      );
    }
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new LegacySourceError(
        `Cannot read archive directory while searching for db.sqlite (${basename(dir)}): ${detail}`
      );
    }
    for (const name of entries) {
      if (name === "." || name === ".." || name.startsWith("._")) continue;
      const full = join(dir, name);
      if (!isSafeUnderRoot(root, full)) {
        throw new LegacySourceError("Archive path escaped the extract directory while searching for db.sqlite");
      }
      let st;
      try {
        st = lstatSync(full);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new LegacySourceError(
          `Cannot inspect archive entry while searching for db.sqlite (${name}): ${detail}`
        );
      }
      // Do not follow symlinks when discovering db.sqlite.
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        walk(full, depth + 1);
      } else if (st.isFile() && name === "db.sqlite") {
        matches.push(full);
      }
    }
  }

  walk(root, 0);
  if (matches.length === 0) {
    throw new LegacySourceError(
      "Archive does not contain db.sqlite. Pack your v0.5 data/ folder (db.sqlite + user-uploads/)."
    );
  }

  const byDepthThenPath = (a: string, b: string): number =>
    a.split(sep).length - b.split(sep).length || a.localeCompare(b);

  const underData = matches.filter((path) => basename(resolve(path, "..")) === "data");
  const pool = underData.length > 0 ? underData : matches;
  pool.sort(byDepthThenPath);
  const chosen = pool[0];
  if (!isSafeUnderRoot(root, chosen)) {
    throw new LegacySourceError("Resolved db.sqlite escaped the extract directory");
  }
  return chosen;
}

export function resolvePathsFromExtractedArchive(extractDir: string): LegacySourcePaths {
  const dbPath = findDbSqliteInTree(extractDir);
  const dataDir = resolve(dbPath, "..");
  const siblingUploads = join(dataDir, "user-uploads");
  const uploadsDir = existsSync(siblingUploads) && statSync(siblingUploads).isDirectory()
    ? siblingUploads
    : null;
  return { dbPath, uploadsDir };
}

export function openLegacyArchive(archivePath: string): {
  paths: LegacySourcePaths;
  extractDir: string;
  cleanup: () => void;
} {
  const extractDir = extractLegacyArchive(archivePath);
  try {
    const paths = resolvePathsFromExtractedArchive(extractDir);
    return {
      paths,
      extractDir,
      cleanup: () => cleanupExtractDir(extractDir),
    };
  } catch (err) {
    cleanupExtractDir(extractDir);
    throw err;
  }
}

/** True when a path looks like a compressed archive rather than a directory. */
export function looksLikeArchiveFilename(path: string): boolean {
  const base = basename(path).toLowerCase();
  // Avoid treating "db.sqlite" as an archive just because of a dot.
  if (base === "db.sqlite" || extname(base) === ".sqlite") return false;
  return isLegacyArchivePath(path);
}
