import { existsSync, lstatSync, realpathSync, statSync } from "fs";
import { isAbsolute, join, resolve, sep } from "path";
import {
  looksLikeArchiveFilename,
  openLegacyArchive,
} from "./legacy-archive.js";
import { LegacySourceError } from "./legacy-errors.js";
import type { LegacySourcePaths } from "./legacy-types.js";

export { LegacySourceError };

function isPathInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  return (
    resolvedCandidate === resolvedRoot ||
    resolvedCandidate.startsWith(resolvedRoot + sep)
  );
}

export type ResolvedLegacySource = LegacySourcePaths & {
  /** Present when the source was an extracted archive; caller must invoke after use. */
  cleanup?: () => void;
};

function requireAbsoluteExistingPath(label: string, raw: string, kind: "file" | "directory"): string {
  const trimmed = raw.trim();
  if (!isAbsolute(trimmed)) {
    throw new LegacySourceError(`${label} must be an absolute path: ${raw}`);
  }
  const absolute = resolve(trimmed);
  if (!existsSync(absolute)) {
    throw new LegacySourceError(`${label} not found: ${absolute}`);
  }
  const st = statSync(absolute);
  if (kind === "directory" && !st.isDirectory()) {
    throw new LegacySourceError(`${label} must be an existing directory: ${absolute}`);
  }
  if (kind === "file" && !st.isFile()) {
    throw new LegacySourceError(`${label} must be an existing file: ${absolute}`);
  }
  return absolute;
}

/**
 * Resolve a Grimoire v0.5 data directory, db path, or compressed archive.
 *
 * Accepted inputs:
 * - dataDir pointing at the v0.5 `data/` folder (contains db.sqlite + user-uploads/)
 * - dbPath pointing directly at db.sqlite, with optional uploadsDir
 * - archivePath (.zip / .tar / .tar.gz / .tar.bz2 / .tar.xz) containing that layout
 */
export function resolveLegacySourcePaths(input: {
  dataDir?: string;
  dbPath?: string;
  uploadsDir?: string;
  archivePath?: string;
}): ResolvedLegacySource {
  const dataDir = input.dataDir?.trim();
  const dbPathInput = input.dbPath?.trim();
  const uploadsInput = input.uploadsDir?.trim();
  const archiveInput = input.archivePath?.trim();

  const provided = [dataDir, dbPathInput, archiveInput].filter(Boolean);
  if (provided.length > 1) {
    throw new LegacySourceError("Provide only one of dataDir, dbPath, or archivePath");
  }
  if (provided.length === 0) {
    throw new LegacySourceError(
      "Provide dataDir (v0.5 data folder), dbPath (db.sqlite), or archivePath (.zip/.tar.gz/…)"
    );
  }

  if (archiveInput) {
    if (uploadsInput) {
      throw new LegacySourceError(
        "uploadsDir cannot be combined with archivePath; include user-uploads/ inside the archive"
      );
    }
    const absoluteArchive = requireAbsoluteExistingPath("archivePath", archiveInput, "file");
    if (!looksLikeArchiveFilename(absoluteArchive)) {
      throw new LegacySourceError(
        "Unsupported archive format. Supported: .zip, .tar, .tar.gz/.tgz, .tar.bz2/.tbz2, .tar.xz/.txz"
      );
    }
    const opened = openLegacyArchive(absoluteArchive);
    return { ...opened.paths, cleanup: opened.cleanup };
  }

  let dbPath: string;
  let uploadsDir: string | null = null;

  if (dataDir) {
    const absoluteDataDir = requireAbsoluteExistingPath("dataDir", dataDir, "directory");
    dbPath = join(absoluteDataDir, "db.sqlite");
    const defaultUploads = join(absoluteDataDir, "user-uploads");
    uploadsDir = existsSync(defaultUploads) ? defaultUploads : null;
  } else {
    dbPath = requireAbsoluteExistingPath("dbPath", dbPathInput!, "file");
  }

  if (uploadsInput) {
    uploadsDir = requireAbsoluteExistingPath("uploadsDir", uploadsInput, "directory");
  }

  if (!existsSync(dbPath) || !statSync(dbPath).isFile()) {
    throw new LegacySourceError(
      `Grimoire v0.5 database not found at ${dbPath}. Expected data/db.sqlite from a v0.5 install.`
    );
  }

  return { dbPath, uploadsDir };
}

/**
 * Resolve a local upload file under user-uploads, rejecting path traversal
 * and symlink escape (do not follow links out of the uploads tree).
 */
export function resolveLegacyUploadPath(
  uploadsDir: string | null,
  relativePath: string
): string | null {
  if (!uploadsDir || !relativePath.trim()) return null;
  const normalized = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) return null;

  const root = resolve(uploadsDir);
  const absolute = resolve(join(uploadsDir, normalized));
  if (!isPathInsideRoot(root, absolute)) return null;

  let st;
  try {
    st = lstatSync(absolute);
  } catch {
    return null;
  }
  // Reject symlinks so a crafted user-uploads tree cannot redirect reads.
  // Hardlinks whose path resolves under uploads are allowed (common for linked
  // backups); symlink + path-escape checks still apply.
  if (st.isSymbolicLink() || !st.isFile()) return null;

  let realFile: string;
  let realRoot: string;
  try {
    realFile = realpathSync(absolute);
    realRoot = realpathSync(root);
  } catch {
    return null;
  }
  if (!isPathInsideRoot(realRoot, realFile)) return null;
  return absolute;
}
