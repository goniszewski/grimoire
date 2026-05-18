import { describe, it, expect } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  BackupPackageError,
  createEncryptedBackupPackage,
  extractEncryptedBackupPackage,
} from "../backup/package.js";
import { verifyBackupDirectory } from "../backup/verification.js";

async function sha256File(path: string): Promise<string> {
  const data = await Bun.file(path).arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeValidBackupDir(): Promise<string> {
  const dir = join(tmpdir(), `littleimp-package-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, "data"), { recursive: true });
  writeFileSync(join(dir, "snapshot.db"), "sqlite data");
  writeFileSync(join(dir, "data", "settings.json"), JSON.stringify({ backup: true }));

  const snapshotHash = await sha256File(join(dir, "snapshot.db"));
  const settingsHash = await sha256File(join(dir, "data", "settings.json"));
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        backup_format_version: 1,
        app_version: "0.1.0-beta",
        created_at: "2026-05-15T12:00:00.000Z",
        db_size_bytes: 11,
        bookmark_count: 3,
        database: { filename: "snapshot.db", schema_version: "0009", size_bytes: 11 },
        settings: {
          included: true,
          filename: "data/settings.json",
          secrets_policy: "secrets omitted; current local secrets are preserved on restore",
        },
        checksum_algorithm: "sha256",
        included_files: ["snapshot.db", "data/settings.json"],
        compatibility: { min_app_version: "0.1.0-beta", restore_supported: true },
      },
      null,
      2
    )
  );
  writeFileSync(
    join(dir, "checksums.sha256"),
    `${snapshotHash}  snapshot.db\n${settingsHash}  data/settings.json\n`
  );
  return dir;
}

describe("encrypted backup packages", () => {
  it("encrypts a verified snapshot directory and extracts it back to a valid backup", async () => {
    const sourceDir = await makeValidBackupDir();
    const packagePath = join(tmpdir(), `littleimp-package-${Date.now()}.enc`);
    const outputDir = join(tmpdir(), `littleimp-package-output-${Date.now()}`);
    try {
      const result = await createEncryptedBackupPackage({
        sourceDir,
        outputPath: packagePath,
        password: "correct horse battery staple",
      });

      expect(result.path).toBe(packagePath);
      expect(result.size_bytes).toBeGreaterThan(0);
      expect(existsSync(packagePath)).toBeTrue();
      expect(readFileSync(packagePath, "utf8")).not.toContain("sqlite data");

      await extractEncryptedBackupPackage({
        packagePath,
        outputDir,
        password: "correct horse battery staple",
      });

      const verification = await verifyBackupDirectory(outputDir);
      expect(verification.verified_files).toEqual(["snapshot.db", "data/settings.json"]);
      expect(verification.bookmark_count).toBe(3);
    } finally {
      rmSync(sourceDir, { recursive: true, force: true });
      rmSync(packagePath, { force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("rejects the wrong password without writing extracted files", async () => {
    const sourceDir = await makeValidBackupDir();
    const packagePath = join(tmpdir(), `littleimp-package-${Date.now()}.enc`);
    const outputDir = join(tmpdir(), `littleimp-package-output-${Date.now()}`);
    try {
      await createEncryptedBackupPackage({
        sourceDir,
        outputPath: packagePath,
        password: "correct-password",
      });

      await expect(
        extractEncryptedBackupPackage({
          packagePath,
          outputDir,
          password: "wrong-password",
        })
      ).rejects.toThrow(BackupPackageError);
      expect(existsSync(join(outputDir, "snapshot.db"))).toBeFalse();
    } finally {
      rmSync(sourceDir, { recursive: true, force: true });
      rmSync(packagePath, { force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("refuses to write the encrypted package inside the source snapshot directory", async () => {
    const sourceDir = await makeValidBackupDir();
    const originalSnapshot = readFileSync(join(sourceDir, "snapshot.db"), "utf8");
    try {
      await expect(
        createEncryptedBackupPackage({
          sourceDir,
          outputPath: join(sourceDir, "snapshot.db"),
          password: "correct-password",
        })
      ).rejects.toThrow("outside the source backup directory");

      expect(readFileSync(join(sourceDir, "snapshot.db"), "utf8")).toBe(originalSnapshot);
      await expect(verifyBackupDirectory(sourceDir)).resolves.toMatchObject({ ok: true });
    } finally {
      rmSync(sourceDir, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite an existing encrypted package output file", async () => {
    const sourceDir = await makeValidBackupDir();
    const packagePath = join(tmpdir(), `littleimp-package-${Date.now()}.enc`);
    try {
      writeFileSync(packagePath, "existing package");

      await expect(
        createEncryptedBackupPackage({
          sourceDir,
          outputPath: packagePath,
          password: "correct-password",
        })
      ).rejects.toThrow("already exists");
      expect(readFileSync(packagePath, "utf8")).toBe("existing package");
    } finally {
      rmSync(sourceDir, { recursive: true, force: true });
      rmSync(packagePath, { force: true });
    }
  });

  it("refuses to extract into a non-empty output directory", async () => {
    const sourceDir = await makeValidBackupDir();
    const packagePath = join(tmpdir(), `littleimp-package-${Date.now()}.enc`);
    const outputDir = join(tmpdir(), `littleimp-package-output-${Date.now()}`);
    try {
      await createEncryptedBackupPackage({
        sourceDir,
        outputPath: packagePath,
        password: "correct-password",
      });
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, "snapshot.db"), "existing data");

      await expect(
        extractEncryptedBackupPackage({
          packagePath,
          outputDir,
          password: "correct-password",
        })
      ).rejects.toThrow("Output directory must be empty");
      expect(readFileSync(join(outputDir, "snapshot.db"), "utf8")).toBe("existing data");
    } finally {
      rmSync(sourceDir, { recursive: true, force: true });
      rmSync(packagePath, { force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("requires a non-empty password", async () => {
    const sourceDir = await makeValidBackupDir();
    const packagePath = join(tmpdir(), `littleimp-package-${Date.now()}.enc`);
    try {
      await expect(
        createEncryptedBackupPackage({
          sourceDir,
          outputPath: packagePath,
          password: "",
        })
      ).rejects.toThrow("Password is required");
    } finally {
      rmSync(sourceDir, { recursive: true, force: true });
      rmSync(packagePath, { force: true });
    }
  });
});
