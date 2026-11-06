import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("release signing", () => {
  it("signs only archives listed in the current manifest", () => {
    const root = mkdtempSync(join(tmpdir(), "grimoire-signing-"));
    const releaseDir = join(root, "release");
    const scriptsDir = join(root, "scripts");
    const binDir = join(root, "bin");
    mkdirSync(releaseDir);
    mkdirSync(scriptsDir);
    mkdirSync(binDir);
    copyFileSync(join(process.cwd(), "scripts/sign-release-artifacts.sh"), join(scriptsDir, "sign-release-artifacts.sh"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.3.1" }));
    const archives = ["grimoire-1.3.1-macos.tar.gz", "grimoire-1.3.1-linux.tar.gz"];
    writeFileSync(join(releaseDir, "release-manifest.json"), JSON.stringify({
      version: "1.3.1",
      artifacts: archives.map((archive, index) => ({ platform: index === 0 ? "macos" : "linux", archive })),
    }));
    for (const archive of archives) writeFileSync(join(releaseDir, archive), "current archive\n");
    const staleArchive = "little-imp-1.3.0-linux.tar.gz";
    writeFileSync(join(releaseDir, staleArchive), "old archive\n");
    const marker = join(root, "signed.txt");
    writeFileSync(join(binDir, "gpg"), `#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  --list-keys) exit 0 ;;
  --batch)
    for ((i=1; i<=$#; i++)); do
      if [[ "\${!i}" == "--output" ]]; then
        next=$((i+1)); touch "\${!next}"
      fi
    done
    printf '%s\\n' "\${!#}" >> "$SIGN_MARKER"
    ;;
  --verify) exit 0 ;;
  --armor) printf 'test key\\n' ;;
  --fingerprint) printf 'pub test\\n ABCD\\n' ;;
esac
`, { mode: 0o755 });
    writeFileSync(join(binDir, "npm"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
    const result = spawnSync("bash", [join(scriptsDir, "sign-release-artifacts.sh"), "TESTKEY"], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}`, SIGN_MARKER: marker },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(marker, "utf8").trim().split("\n").map((path) => path.split("/").pop()))
      .toEqual(archives);
    expect(existsSync(join(releaseDir, `${staleArchive}.asc`))).toBe(false);
  });
});
