import { describe, expect, it, vi } from "vitest";
import { generateBookmarkletUrl } from "./bookmarklet";

describe("generateBookmarkletUrl", () => {
  it("returns a javascript: URI", () => {
    const url = generateBookmarkletUrl("test-token");
    expect(url.startsWith("javascript:")).toBe(true);
  });

  it("embeds the token via JSON.stringify in the postMessage payload", () => {
    const url = generateBookmarkletUrl("limp_test_token_abc123");
    expect(url).toContain('token:"limp_test_token_abc123"');
  });

  it("opens the default daemon bridge without putting the token in its URL", () => {
    const url = generateBookmarkletUrl("tok");
    expect(url).toContain('window.open("http://127.0.0.1:3210"+"/capture/bookmarklet#nonce="');
    expect(url).toContain(',"grimoire_capture_"+r,"popup,width=420,height=180"');
    expect(url).toContain(',"http://127.0.0.1:3210")');
    expect(url).not.toContain("/capture/bookmarklet?");
    expect(url).not.toContain("token=");
  });

  it("uses a custom daemon URL when provided", () => {
    const url = generateBookmarkletUrl("tok", "http://localhost:9999");
    expect(url).not.toContain("127.0.0.1:3210");
    expect(url).toContain('window.open("http://localhost:9999"+"/capture/bookmarklet#nonce="');
    expect(url).toContain(',"http://localhost:9999")');
  });

  it("escapes quotes and backslashes in tokens safely", () => {
    const token = 'tok"en\\value';
    const url = generateBookmarkletUrl(token);
    expect(url).toContain(JSON.stringify(token));
    expect(url).toContain(`token:${JSON.stringify(token)}`);
  });

  it("produces a valid IIFE wrapper structure", () => {
    const url = generateBookmarkletUrl("tok");
    const script = url.slice("javascript:".length);
    expect(script.startsWith("!function(){")).toBe(true);
    expect(script.endsWith("}();")).toBe(true);
    expect(() => new Function(script)).not.toThrow();
  });

  it("includes the bookmarklet sentinel element id check", () => {
    const url = generateBookmarkletUrl("tok");
    expect(url).toContain("__limp_bm");
  });

  it("constructs a postMessage capture payload", () => {
    const url = generateBookmarkletUrl("my-token");
    expect(url).toContain('type:"grimoire-bookmarklet-request"');
    expect(url).toContain('payload:{url:window.location.href,title:document.title');
    expect(url).not.toContain("iframe");
  });

  it("copes with tokens containing special characters", () => {
    const token = "tok+en/speci@l#chars";
    const url = generateBookmarkletUrl(token);
    expect(url).toContain(`token:${JSON.stringify(token)}`);
  });

  it("copes with daemon URLs containing path segments", () => {
    const daemonUrl = "http://192.168.1.1:8080/path";
    const url = generateBookmarkletUrl("tok", daemonUrl);
    expect(url).toContain(`window.open(${JSON.stringify(daemonUrl)}+"/capture/bookmarklet#nonce="`);
    expect(url).toContain(',"http://192.168.1.1:8080")');
  });

  it("generates distinct outputs for different tokens", () => {
    const url1 = generateBookmarkletUrl("token-a");
    const url2 = generateBookmarkletUrl("token-b");
    expect(url1).not.toBe(url2);
    expect(url1).toContain("token-a");
    expect(url2).toContain("token-b");
  });
});

describe("generated bookmarklet execution", () => {
  it("handshakes with the daemon bridge and only shows confirmed success", () => {
    vi.useFakeTimers();
    const popup = {
      closed: false,
      close: vi.fn(),
      postMessage: vi.fn(),
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const originalTitle = document.title;
    const originalGetSelection = window.getSelection;

    Object.defineProperty(document, "title", { configurable: true, value: "Captured title" });
    Object.defineProperty(window, "getSelection", {
      configurable: true,
      value: () => ({ toString: () => "Selected context" }),
    });

    const dispatchMessage = (data: Record<string, unknown>, origin: string) => {
      const event = new Event("message");
      Object.defineProperties(event, {
        data: { value: data },
        origin: { value: origin },
        source: { value: popup },
      });
      window.dispatchEvent(event);
    };

    try {
      const script = generateBookmarkletUrl("limp_test_token").slice("javascript:".length);
      new Function(script)();

      const [bridgeUrl, windowName] = openSpy.mock.calls[0] as [string, string];
      const nonce = new URL(bridgeUrl).hash.slice("#nonce=".length);
      expect(windowName).toMatch(/^grimoire_capture_/);

      dispatchMessage({ type: "grimoire-bookmarklet-ready", nonce }, "http://127.0.0.1:3210");
      expect(popup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "grimoire-bookmarklet-request",
          nonce,
          token: "limp_test_token",
          payload: {
            url: window.location.href,
            title: "Captured title",
            source: { client: "bookmarklet", selected_text: "Selected context" },
          },
        }),
        "http://127.0.0.1:3210"
      );

      dispatchMessage(
        { type: "grimoire-bookmarklet-result", nonce, ok: true, status: 201, created: true, detail: null },
        "http://malicious.example"
      );
      expect(document.getElementById("__limp_bm")).toHaveTextContent("Saving to Grimoire");

      dispatchMessage(
        { type: "grimoire-bookmarklet-result", nonce, ok: true, status: 201, created: true, detail: null },
        "http://127.0.0.1:3210"
      );
      expect(document.getElementById("__limp_bm")).toHaveTextContent("Saved!");
    } finally {
      openSpy.mockRestore();
      Object.defineProperty(document, "title", { configurable: true, value: originalTitle });
      Object.defineProperty(window, "getSelection", { configurable: true, value: originalGetSelection });
      document.getElementById("__limp_bm")?.remove();
      vi.useRealTimers();
    }
  });
});
