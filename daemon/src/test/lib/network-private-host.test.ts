import { describe, expect, it } from "bun:test";
import { isPrivateHost, resolvesToPrivateAddress } from "../../lib/network.js";
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

describe("isPrivateHost reserved ranges", () => {
  it("blocks non-routable IPv4 ranges beyond RFC 1918", () => {
    for (const host of [
      "0.0.0.0",
      "0.1.2.3",
      "100.64.0.1",
      "100.127.255.255",
      "192.0.0.1",
      "192.0.2.1",
      "198.18.0.1",
      "198.19.255.255",
      "198.51.100.7",
      "203.0.113.9",
      "224.0.0.1",
      "240.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isPrivateHost(host)).toBe(true);
    }
  });

  it("keeps neighbouring public IPv4 addresses reachable", () => {
    for (const host of ["100.63.255.255", "100.128.0.1", "172.15.0.1", "172.32.0.1", "198.17.0.1", "198.20.0.1", "1.1.1.1"]) {
      expect(isPrivateHost(host)).toBe(false);
    }
  });

  it("blocks IPv6 forms that embed private IPv4 addresses", () => {
    expect(isPrivateHost("64:ff9b::7f00:1")).toBe(true); // NAT64 -> 127.0.0.1
    expect(isPrivateHost("64:ff9b::a9fe:a9fe")).toBe(true); // NAT64 -> 169.254.169.254
    expect(isPrivateHost("2002:7f00:1::")).toBe(true); // 6to4 -> 127.0.0.1
    expect(isPrivateHost("2002:a9fe:a9fe::")).toBe(true); // 6to4 -> 169.254.169.254
    expect(isPrivateHost("64:ff9b::808:808")).toBe(false); // NAT64 -> 8.8.8.8
    expect(isPrivateHost("2002:808:808::")).toBe(false); // 6to4 -> 8.8.8.8
  });

  it("blocks other reserved IPv6 ranges", () => {
    for (const host of ["::", "::1", "fe80::1", "fec0::1", "fd00::1", "fc00::1", "ff02::1", "2001:db8::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2", "64:ff9b:1::1"]) {
      expect(isPrivateHost(host)).toBe(true);
    }
    expect(isPrivateHost("2606:4700:4700::1111")).toBe(false);
  });

  it("blocks internal-only hostnames", () => {
    for (const host of [
      "foo.localhost",
      "printer.local",
      "metadata.google.internal",
      "router.home.arpa",
      "instance-data",
      "myhost",
    ]) {
      expect(isPrivateHost(host)).toBe(true);
    }
  });

  it("does not treat public names that look like IP prefixes as private", () => {
    expect(isPrivateHost("10.example.com")).toBe(false);
    expect(isPrivateHost("192.168.example.com")).toBe(false);
    expect(isPrivateHost("example.co.uk")).toBe(false);
  });
});

describe("resolvesToPrivateAddress", () => {
  const resolver = (map: Record<string, string[]>) => async (host: string) => {
    if (!(host in map)) throw new Error("ENOTFOUND");
    return map[host];
  };

  it("rejects public names that resolve to private addresses", async () => {
    const r = resolver({ "rebind.example.com": ["93.184.216.34", "127.0.0.1"], "meta.example.com": ["::ffff:a9fe:a9fe"] });
    expect(await resolvesToPrivateAddress("rebind.example.com", r)).toBe(true);
    expect(await resolvesToPrivateAddress("meta.example.com", r)).toBe(true);
  });

  it("allows names that resolve only to public addresses", async () => {
    const r = resolver({ "example.com": ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"] });
    expect(await resolvesToPrivateAddress("example.com", r)).toBe(false);
  });

  it("classifies IP literals and internal names without a lookup", async () => {
    const r = async () => {
      throw new Error("resolver must not be called");
    };
    expect(await resolvesToPrivateAddress("127.0.0.1", r)).toBe(true);
    expect(await resolvesToPrivateAddress("[::1]", r)).toBe(true);
    expect(await resolvesToPrivateAddress("8.8.8.8", r)).toBe(false);
    expect(await resolvesToPrivateAddress("foo.localhost", r)).toBe(true);
  });

  it("does not block on lookup failure", async () => {
    expect(await resolvesToPrivateAddress("nxdomain.example.com", resolver({}))).toBe(false);
  });

  it("abandons a stalled lookup when the signal aborts", async () => {
    const controller = new AbortController();
    const stalled = () => new Promise<string[]>(() => {});
    const pending = resolvesToPrivateAddress("slow.example.com", stalled, controller.signal);
    controller.abort(new Error("timed out"));
    await expect(pending).rejects.toThrow("timed out");
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("already aborted"));
    await expect(
      resolvesToPrivateAddress("slow.example.com", async () => ["93.184.216.34"], controller.signal)
    ).rejects.toThrow("already aborted");
  });
});
