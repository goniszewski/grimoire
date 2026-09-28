import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Exercise orchestration without installing packages or touching host services.
function smoke(fault = "", mode = "local", upgrade = false) {
  const root = mkdtempSync(join(tmpdir(), "grimoire-brew-smoke-"));
  try {
    mkdirSync(join(root, "tap", "Formula"), { recursive: true });
    mkdirSync(join(root, "bin"));
    mkdirSync(join(root, "libexec"));
    writeFileSync(join(root, "libexec", "VERSION"), "1.2.0\n");
    const olderFormula = join(root, "older.rb");
    writeFileSync(olderFormula, "# older formula fixture\n");
    for (const name of ["grimoire", "littleimp", "littleimpd", "bun"]) {
      if (fault === "missing_cli" && name === "grimoire") continue;
      writeFileSync(join(root, "bin", name), name === "bun"
        ? '#!/bin/bash\n[[ "$2" == *Bun.stdin* ]] || exit 0\nbody="$(cat)"\n[[ "$body" == *"$3"* ]]\n'
        : "#!/bin/bash\nexit 0\n", { mode: 0o755 });
    }
    const envFile = join(root, "doubles.sh");
    writeFileSync(envFile, `
lsof() { [[ "$FAULT" == occupied ]]; }
sleep() { :; }
curl() {
  if [[ "$FAULT" == version ]]; then printf '{"status":"ok","version":"1.1.0"}';
  else printf '{"status":"ok","version":"%s"}' "$(cat "$ROOT/libexec/VERSION")"; fi
}
brew() {
  printf '%s\\n' "$*" >> "$ROOT/calls"
  case "$1" in
    tap) return 0 ;;
    list)
      if [[ "$FAULT" == uninstall_noop && -f "$ROOT/installed" ]]; then return 0; fi
      return 1 ;;
    --prefix) printf '%s\\n' "$ROOT" ;;
    --repository) printf '%s/tap\\n' "$ROOT" ;;
    install)
      touch "$ROOT/installed"
      if [[ "$UPGRADE" == true ]]; then printf '1.1.0' > "$ROOT/libexec/VERSION"; fi
      mkdir -p "$ROOT/var/little-imp/logs"
      printf 'config' > "$ROOT/var/little-imp/.env"
      printf 'database' > "$ROOT/var/little-imp/littleimp.db" ;;
    reinstall)
      if [[ "$FAULT" == reinstall ]]; then printf 'clobbered' > "$ROOT/var/little-imp/.env"; fi ;;
    upgrade)
      if [[ "$FAULT" != upgrade_noop ]]; then printf '1.2.0' > "$ROOT/libexec/VERSION"; fi ;;
    services)
      if [[ "$FAULT" == stop && "$2" == stop ]]; then return 1; fi ;;
    uninstall)
      if [[ "$FAULT" == uninstall ]]; then rm -f "$ROOT/var/little-imp/littleimp.db"; fi
      if [[ "$FAULT" == uninstall_failure ]]; then return 1; fi ;;
  esac
  return 0
}
`);
    const result = spawnSync("/bin/bash", ["scripts/homebrew-smoke.sh", mode], {
      encoding: "utf8", timeout: 15000,
      env: { ...process.env, BASH_ENV: envFile, ROOT: root, FAULT: fault, HOMEBREW_TEST_EXPECTED_VERSION: "1.2.0", UPGRADE: String(upgrade), HOMEBREW_TEST_UPGRADE_FROM_FORMULA: upgrade ? olderFormula : "", HOMEBREW_TEST_ARCHIVE_DIR: "", HOMEBREW_TEST_PORT: fault === "invalid_port" ? "0" : "13210" },
    });
    expect(result.error).toBeUndefined();
    return { ...result, calls: readFileSync(join(root, "calls"), { encoding: "utf8", flag: "a+" }) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("Homebrew smoke lifecycle", () => {
  it("uses the existing public repository as the tap and audits online", () => {
    const result = smoke("", "published");
    expect(result.status).toBe(0);
    expect(result.calls).toContain("tap goniszewski/grimoire https://github.com/goniszewski/grimoire.git");
    expect(result.calls.indexOf("trust --formula goniszewski/grimoire/grimoire")).toBeLessThan(
      result.calls.indexOf("tap goniszewski/grimoire https://github.com/goniszewski/grimoire.git")
    );
    expect(result.calls).toContain("audit --formula --strict --online");
    expect(result.calls).toContain("fetch --force --build-from-source goniszewski/grimoire/grimoire");
  });
  it("invokes brew upgrade and requires the target version", () => {
    const result = smoke("", "local", true);
    expect(result.status).toBe(0);
    expect(result.calls).toContain("upgrade grimoire");
    expect(result.calls).not.toContain("reinstall grimoire");
  });
  it("rejects a no-op upgrade", () => {
    const result = smoke("upgrade_noop", "local", true);
    expect(result.status, result.stdout + result.stderr + result.calls).not.toBe(0);
    expect(result.stdout).not.toContain("smoke test passed");
  });
  it("checks reinstall and uninstall before announcing success", () => {
    const result = smoke();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("smoke test passed");
    expect(result.calls).toContain("reinstall grimoire");
    expect(result.calls).toContain("uninstall --force --ignore-dependencies grimoire");
  });
  for (const fault of ["occupied", "version", "reinstall", "uninstall", "uninstall_failure", "stop", "missing_cli", "invalid_port", "uninstall_noop"]) {
    it(`fails without reporting success on ${fault}`, () => {
      const result = smoke(fault);
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain("smoke test passed");
      if (fault === "occupied") expect(result.calls).toBe("");
    });
  }
});
