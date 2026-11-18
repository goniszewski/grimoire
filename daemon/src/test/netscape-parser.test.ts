import { describe, expect, it } from "bun:test";
import { parseNetscapeBookmarks } from "../import/netscape-parser.js";

function largeNetscapeFixture(): string {
  const runtimeRows = Array.from({ length: 45 }, (_, index) => {
    const note = index === 7 ? `\n    <DD>Runtime note ${index} &amp; details` : "";
    return `    <DT><A HREF="https://large.example.com/runtime-${index}" ADD_DATE="${1_700_000_000 + index}" TAGS="runtime,topic-${index % 5}">Runtime ${index} &amp; Docs</A>${note}`;
  }).join("\n");

  const referenceRows = Array.from({ length: 45 }, (_, index) => {
    const absoluteIndex = index + 45;
    return `    <DT><A HREF="https://large.example.com/reference-${index}" ADD_DATE="${1_700_000_000 + absoluteIndex}" TAGS="reference,topic-${absoluteIndex % 5}" DESCRIPTION="Reference note ${index}">Reference ${index}</A>`;
  }).join("\n");

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3>Research</H3>
  <DL><p>
    <DT><H3>Runtime</H3>
    <DL><p>
${runtimeRows}
    </DL><p>
    <DT><H3>References</H3>
    <DL><p>
${referenceRows}
      <DT><A HREF="notaurl" TAGS="broken">Broken row</A>
      <DT><A HREF="http://127.0.0.1/admin" TAGS="private">Private row</A>
    </DL><p>
    <DT><H3>Empty Folder</H3>
    <DL><p>
    </DL><p>
  </DL><p>
</DL><p>`;
}

describe("Netscape bookmark parser", () => {
  it("parses a large nested fixture while preserving folders, notes, tags, and skipped rows", () => {
    const parsed = parseNetscapeBookmarks(largeNetscapeFixture());

    expect(parsed.bookmarks).toHaveLength(90);
    expect(parsed.skipped).toHaveLength(2);
    expect(parsed.folders.map((folder) => folder.path)).toEqual([
      ["Research"],
      ["Research", "Runtime"],
      ["Research", "References"],
      ["Research", "Empty Folder"],
    ]);

    expect(parsed.bookmarks[0]).toMatchObject({
      index: 0,
      url: "https://large.example.com/runtime-0",
      title: "Runtime 0 & Docs",
      addDate: 1_700_000_000,
      tags: ["runtime", "topic-0"],
      notes: null,
      folders: ["Research", "Runtime"],
    });
    expect(parsed.bookmarks[7]).toMatchObject({
      notes: "Runtime note 7 & details",
      folders: ["Research", "Runtime"],
    });
    expect(parsed.bookmarks[45]).toMatchObject({
      url: "https://large.example.com/reference-0",
      notes: "Reference note 0",
      folders: ["Research", "References"],
    });

    expect(parsed.skipped.map((row) => row.reason)).toEqual(["invalid_url", "private_url"]);
    expect(parsed.warnings).toHaveLength(2);
  });

  describe("Shaarli exports", () => {
    // Shaarli (PHP) escapes apostrophes as &#039; and emits PRIVATE/LAST_MODIFIED
    // attributes, comma-separated TAGS, and a <DD> description after each link.
    const SHAARLI_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
It will be read and overwritten.
DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
<DT><A HREF="https://example.com/a?x=1&amp;y=2" ADD_DATE="1600000000" LAST_MODIFIED="1600000009" PRIVATE="0" TAGS="Web Dev,c++,über">Rock &#039;n&#039; Roll &amp; &quot;more&quot;</A>
<DD>Line one
line two with &lt;b&gt; and &#x27;hex&#x27; and &amp;lt;
<DT><A HREF="?abcdef" ADD_DATE="1600000001" PRIVATE="1" TAGS="note">Grocery list</A>
<DD>milk
<DT><A HREF="https://example.com/b" ADD_DATE="1600000003" PRIVATE="1" TAGS="">No description</A>
<DT><A HREF="https://example.com/c" ADD_DATE="1600000004" PRIVATE="0" TAGS="x">Empty description</A>
<DD>
</DL><p>`;

    it("decodes numeric entities and keeps tags, dates, and multi-line notes", () => {
      const parsed = parseNetscapeBookmarks(SHAARLI_EXPORT);

      expect(parsed.bookmarks).toHaveLength(3);
      const [first, second, third] = parsed.bookmarks;
      expect(first?.url).toBe("https://example.com/a?x=1&y=2");
      expect(first?.title).toBe(`Rock 'n' Roll & "more"`);
      expect(first?.addDate).toBe(1_600_000_000);
      expect(first?.tags).toEqual(["web dev", "c++", "über"]);
      expect(first?.notes).toBe("Line one\nline two with <b> and 'hex' and &lt;");
      expect(second?.tags).toEqual([]);
      expect(second?.notes).toBeNull();
      expect(third?.notes).toBeNull();
    });

    it("reports link-less Shaarli notes as skipped rows instead of importing them", () => {
      const parsed = parseNetscapeBookmarks(SHAARLI_EXPORT);

      expect(parsed.skipped).toHaveLength(1);
      expect(parsed.skipped[0]).toMatchObject({ url: "?abcdef", title: "Grocery list", reason: "invalid_url" });
    });

    it("parses a 5000 link export with 1700 distinct tags quickly", () => {
      const rows = Array.from({ length: 5000 }, (_, index) => {
        const tags = `t${index % 1700},t${(index * 7) % 1700}`;
        return `<DT><A HREF="https://big.example.com/${index}" ADD_DATE="${1_600_000_000 + index}" PRIVATE="0" TAGS="${tags}">Title ${index}</A>\n<DD>Description ${index}`;
      }).join("\n");

      const started = performance.now();
      const parsed = parseNetscapeBookmarks(`<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n${rows}\n</DL><p>`);
      const elapsedMs = performance.now() - started;

      expect(parsed.bookmarks).toHaveLength(5000);
      expect(parsed.skipped).toHaveLength(0);
      expect(new Set(parsed.bookmarks.flatMap((row) => row.tags)).size).toBe(1700);
      expect(elapsedMs).toBeLessThan(2000);
    });
  });

  it("decodes entities once and leaves unknown or invalid references untouched", () => {
    const parsed = parseNetscapeBookmarks(
      `<DL><DT><A HREF="https://example.com/e">&amp;lt; &#0; &#xD800; &bogus; &#65;&#x42;</A></DL>`
    );

    expect(parsed.bookmarks[0]?.title).toBe("&lt; &#0; &#xD800; &bogus; AB");
  });
});
