import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
} from "fs";
import { tmpdir } from "os";
import { basename, dirname, extname, join, resolve, sep } from "path";
import { spawnSync } from "child_process";
import { LegacySourceError } from "./legacy-errors.js";
import type { LegacySourcePaths } from "./legacy-types.js";

export type LegacyArchiveFormat =
  | "zip"
  | "tar"
  | "tar.gz"
  | "tar.bz2"
  | "tar.xz";

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

/**
 * Reject absolute paths, parent traversal, and drive-letter paths before extraction (zip-slip).
 */
export function assertArchiveMembersSafe(archivePath: string, format: LegacyArchiveFormat): void {
  let listing: string;
  if (format === "zip") {
    // Info-ZIP: zipinfo-style one-path-per-line listing.
    listing = runCapture("unzip", ["-Z1", archivePath]);
  } else {
    listing = runCapture("tar", ["-tf", archivePath]);
  }

  for (const line of listing.split(/\r?\n/)) {
    if (!line.trim()) continue;
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
 * After extraction, reject symlink / link targets that escape the extract directory.
 */
export function assertExtractTreeSafe(root: string, maxDepth = 8): void {
  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
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
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) {
        let target: string;
        try {
          target = readlinkSync(full);
        } catch {
          throw new LegacySourceError(`Archive contains an unreadable symlink: ${name}`);
        }
        const resolvedTarget = resolve(dirname(full), target);
        if (!isSafeUnderRoot(root, resolvedTarget)) {
          throw new LegacySourceError(
            `Archive symlink escapes extract directory (${name} → ${target})`
          );
        }
        continue;
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
 * Prefers .../data/db.sqlite, then any db.sqlite within a bounded walk.
 */
export function findDbSqliteInTree(root: string, maxDepth = 6): string {
  const matches: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "." || name === ".." || name.startsWith("._")) continue;
      const full = join(dir, name);
      if (!isSafeUnderRoot(root, full)) continue;
      let st;
      try {
        st = lstatSync(full);
      } catch {
        continue;
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

  const preferred = matches.find((path) => {
    const parent = basename(resolve(path, ".."));
    return parent === "data";
  });
  // Prefer shallowest match if no data/ parent.
  matches.sort((a, b) => a.split(sep).length - b.split(sep).length || a.localeCompare(b));
  const chosen = preferred ?? matches[0];
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
