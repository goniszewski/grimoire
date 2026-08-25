import { describe, expect, it } from "bun:test";
import { isPrivateHost } from "../../lib/network.js";
import { parsePublicHttpUrl } from "../../lib/public-url.js";

describe("isPrivateHost", () => {
  it("detects common private and loopback hosts", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("example.com")).toBe(false);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
  });

  it("treats localhost with trailing FQDN dots as private", () => {
    expect(isPrivateHost("localhost.")).toBe(true);
    expect(isPrivateHost("LOCALHOST.")).toBe(true);
    expect(isPrivateHost("localhost..")).toBe(true);
    expect(isPrivateHost("LocalHost")).toBe(true);
  });

  it("treats IPv4-mapped IPv6 private addresses as private", () => {
    expect(isPrivateHost("::ffff:192.168.1.1")).toBe(true);
    expect(isPrivateHost("::ffff:c0a8:101")).toBe(true);
    expect(isPrivateHost("[::ffff:127.0.0.1]")).toBe(true);
    expect(isPrivateHost("[::ffff:7f00:1]")).toBe(true);
    expect(isPrivateHost("::ffff:a9fe:a9fe")).toBe(true); // 169.254.169.254
    expect(isPrivateHost("::ffff:a00:1")).toBe(true); // 10.0.0.1
  });

  it("treats IPv4-compatible IPv6 private addresses as private", () => {
    expect(isPrivateHost("::7f00:1")).toBe(true); // 127.0.0.1
    expect(isPrivateHost("::c0a8:101")).toBe(true); // 192.168.1.1
  });

  it("does not treat public IPv4-mapped addresses as private", () => {
    expect(isPrivateHost("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateHost("::ffff:808:808")).toBe(false); // 8.8.8.8
  });
});

describe("parsePublicHttpUrl IPv4-mapped", () => {
  it("rejects private IPv4-mapped bookmark URLs", () => {
    const mapped = parsePublicHttpUrl("http://[::ffff:192.168.1.1]/");
    expect(mapped.ok).toBe(false);
    if (!mapped.ok) expect(mapped.reason).toBe("private");

    const hex = parsePublicHttpUrl("http://[::ffff:c0a8:101]/");
    expect(hex.ok).toBe(false);
    if (!hex.ok) expect(hex.reason).toBe("private");
  });

  it("rejects localhost with a trailing FQDN dot", () => {
    const parsed = parsePublicHttpUrl("http://localhost./admin");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toBe("private");
  });
});
