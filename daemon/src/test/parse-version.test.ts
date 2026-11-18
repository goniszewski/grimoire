import { describe, expect, test } from "bun:test";
import { parseVersion } from "../update/service";

describe("parseVersion", () => {
  test("parses plain, v-prefixed and build-metadata versions", () => {
    expect(parseVersion("1.4.0")).toEqual({ major: 1, minor: 4, patch: 0, prerelease: [] });
    expect(parseVersion("v1.4.0+build.5")?.minor).toBe(4);
  });

  test("parses prerelease identifiers", () => {
    expect(parseVersion("1.5.0-beta.2")?.prerelease).toEqual(["beta", "2"]);
    expect(parseVersion("1.5.0-rc-1.0")?.prerelease).toEqual(["rc-1", "0"]);
  });

  test("rejects malformed versions", () => {
    for (const bad of ["1.4", "01.4.0", "1.4.0-", "1.4.0-.", "1.4.0-a..b", "1.4.0-01", "1.4.0-a_b", "latest"]) {
      expect(parseVersion(bad)).toBeNull();
    }
  });

  test("rejects oversized input quickly instead of backtracking", () => {
    const started = performance.now();
    expect(parseVersion(`1.0.0-${"a".repeat(50_000)}!`)).toBeNull();
    expect(performance.now() - started).toBeLessThan(50);
  });
});
