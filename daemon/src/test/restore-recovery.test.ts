import { describe, expect, it } from "bun:test";
import { localHealthUrl, restartCommandForPlatform, rollbackInstructions } from "../restore-recovery.js";

describe("restore recovery helpers", () => {
  it("builds reachable local health URLs for wildcard and IPv6 hosts", () => {
    expect(localHealthUrl("0.0.0.0", 3210)).toBe("http://127.0.0.1:3210/health");
    expect(localHealthUrl("::", 3210)).toBe("http://127.0.0.1:3210/health");
    expect(localHealthUrl("::1", 3210)).toBe("http://[::1]:3210/health");
  });

  it("returns platform restart guidance without shelling out", () => {
    expect(restartCommandForPlatform("darwin")).toContain("launchctl");
    expect(restartCommandForPlatform("linux")).toContain("systemctl --user restart littleimpd");
    expect(restartCommandForPlatform("freebsd")).toContain("platform service manager");
  });

  it("includes the exact rollback database path and restart command", () => {
    const instructions = rollbackInstructions(
      "/tmp/restore-rollbacks/pre-restore",
      "/Users/example/.local/share/littleimp/littleimp.db",
      "systemctl --user restart littleimpd"
    ).join("\n");

    expect(instructions).toContain("/tmp/restore-rollbacks/pre-restore/littleimp.db");
    expect(instructions).toContain("/Users/example/.local/share/littleimp/littleimp.db");
    expect(instructions).toContain("systemctl --user restart littleimpd");
  });
});
