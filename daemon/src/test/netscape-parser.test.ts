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
});
