import {
  inspectLegacyBackup,
  openLegacyV05Database,
  LegacySourceError,
} from "./legacy-reader.js";
import {
  findLegacyOwner,
  verifyLegacyOwnerPassword,
  LegacyAuthError,
} from "./legacy-auth.js";
import { normalizeLegacyLibrary } from "./legacy-normalize.js";
import { applyLegacyLibrary, type LegacyApplyDeps } from "./legacy-apply.js";
import type {
  LegacyApplySummary,
  LegacyInspectResult,
  NormalizedLegacyLibrary,
} from "./legacy-types.js";

export {
  LegacySourceError,
  LegacyAuthError,
  inspectLegacyBackup,
  openLegacyV05Database,
  findLegacyOwner,
  verifyLegacyOwnerPassword,
  normalizeLegacyLibrary,
  applyLegacyLibrary,
};

export type LegacyMigrateOptions = {
  dataDir?: string;
  dbPath?: string;
  uploadsDir?: string;
  archivePath?: string;
  owner?: string;
  password?: string;
  /** When true, password verification is required even for single-user databases. */
  requirePassword?: boolean;
};

export function inspectLegacyV05Source(
  options: Pick<LegacyMigrateOptions, "dataDir" | "dbPath" | "uploadsDir" | "archivePath">
): LegacyInspectResult {
  const contents = openLegacyV05Database(options);
  try {
    return inspectLegacyBackup(contents);
  } finally {
    contents.cleanup?.();
  }
}

export async function prepareLegacyLibrary(
  options: LegacyMigrateOptions
): Promise<{ library: NormalizedLegacyLibrary; cleanup?: () => void }> {
  const contents = openLegacyV05Database(options);
  try {
    const owner = findLegacyOwner(contents, options.owner);
    const password = options.password;
    const hasPassword = typeof password === "string" && password.length > 0;
    if (options.requirePassword || hasPassword) {
      await verifyLegacyOwnerPassword(owner, password ?? "");
    }
    const library = normalizeLegacyLibrary(contents, owner);
    return { library, cleanup: contents.cleanup };
  } catch (err) {
    contents.cleanup?.();
    throw err;
  }
}

export async function migrateLegacyV05Source(
  options: LegacyMigrateOptions,
  deps: LegacyApplyDeps
): Promise<LegacyApplySummary> {
  const { library, cleanup } = await prepareLegacyLibrary(options);
  try {
    return await applyLegacyLibrary(library, deps);
  } finally {
    cleanup?.();
  }
}
