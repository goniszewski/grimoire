import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { LegacyConflictError } from "./legacy-errors.js";

const LOCK_NAME = "migrate-legacy.apply.lock";

function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockPid(lockPath: string): number | null {
  try {
    const first = readFileSync(lockPath, "utf8").split(/\r?\n/, 1)[0]?.trim() ?? "";
    const pid = Number.parseInt(first, 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Exclusive apply lock under the 1.x dataDir so two daemon/CLI processes cannot
 * mutate the same library at once. Dry-runs must not acquire this lock.
 */
export function acquireLegacyApplyLock(dataDir: string): () => void {
  const lockPath = join(dataDir, LOCK_NAME);

  const tryCreate = (): number | null => {
    try {
      const fd = openSync(lockPath, "wx");
      writeFileSync(fd, `${process.pid}\n${Date.now()}\n`);
      return fd;
    } catch {
      return null;
    }
  };

  let fd = tryCreate();
  if (fd == null) {
    const holder = readLockPid(lockPath);
    if (holder != null && !isPidAlive(holder)) {
      try {
        unlinkSync(lockPath);
      } catch {
        // raced with another cleaner
      }
      fd = tryCreate();
    }
  }

  if (fd == null) {
    throw new LegacyConflictError(
      "A legacy migration apply is already in progress for this library"
    );
  }

  const heldFd = fd;
  return () => {
    try {
      closeSync(heldFd);
    } catch {
      // ignore
    }
    try {
      if (existsSync(lockPath)) unlinkSync(lockPath);
    } catch {
      // ignore
    }
  };
}
