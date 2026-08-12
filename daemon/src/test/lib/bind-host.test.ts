import { describe, expect, it } from "bun:test";
import {
  allowNonLoopbackBind,
  isContainerBindContext,
  resolveBindHost,
  BindHostError,
} from "../../lib/bind-host.js";

describe("resolveBindHost", () => {
  it("allows loopback hosts without warning", () => {
    expect(resolveBindHost("127.0.0.1", {})).toEqual({ host: "127.0.0.1", warning: null });
    expect(resolveBindHost("localhost", {})).toEqual({ host: "localhost", warning: null });
  });

  it("rejects non-loopback hosts without an explicit opt-in", () => {
    expect(() => resolveBindHost("0.0.0.0", {})).toThrow(BindHostError);
    expect(() => resolveBindHost("192.168.1.10", {})).toThrow(/LITTLEIMP_ALLOW_NON_LOOPBACK_BIND/);
  });

  it("allows wildcard binds in container context with a warning", () => {
    const resolved = resolveBindHost("0.0.0.0", { DATA_DIR: "/data" });
    expect(resolved.host).toBe("0.0.0.0");
    expect(resolved.warning).toContain("loopback-restricted");
  });

  it("allows non-loopback when LITTLEIMP_ALLOW_NON_LOOPBACK_BIND=1", () => {
    const resolved = resolveBindHost("0.0.0.0", { LITTLEIMP_ALLOW_NON_LOOPBACK_BIND: "1" });
    expect(resolved.host).toBe("0.0.0.0");
    expect(resolved.warning).toBeTruthy();
  });

  it("detects container context", () => {
    expect(isContainerBindContext({ DATA_DIR: "/data" })).toBe(true);
    expect(isContainerBindContext({ LITTLEIMP_IN_CONTAINER: "1" })).toBe(true);
    expect(allowNonLoopbackBind({ ALLOW_NON_LOOPBACK_BIND: "true" })).toBe(true);
  });
});
