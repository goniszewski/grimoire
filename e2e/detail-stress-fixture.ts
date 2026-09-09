import { makeApiBookmark } from "./api-fixtures";

const longWord = "VeryLongUnbrokenReference".repeat(18);
const image = (width: number, height: number) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ede9fe"/><rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#7c3aed" stroke-width="12"/><text x="32" y="70" font-size="40">TOP / LEFT</text><text x="32" y="${height - 40}" font-size="40">BOTTOM / RIGHT</text></svg>`)}`;
export const stressBookmark = makeApiBookmark({
  id: "detail-stress", title: `Long bookmark ${longWord}`, description: longWord.repeat(2),
  domain: `${"long-domain".repeat(12)}.example.com`, tags: [longWord, "layout"],
  notes: `# Notes\n\n${"Long notes remain readable. ".repeat(60)}\n\n\`\`\`text\n${longWord}\n\`\`\``,
});
export const stressMedia = {
  favicon: { id: "favicon", kind: "favicon" as const, url: image(64, 64), alt: "Favicon", source_url: "https://example.com/image", media_type: "image/svg+xml", size_bytes: 1024, width: 64, height: 64 },
  screenshot: { id: "portrait", kind: "screenshot" as const, url: image(600, 1800), alt: "Portrait reference", source_url: "https://example.com/image", media_type: "image/svg+xml", size_bytes: 1024, width: 600, height: 1800 },
  images: [{ id: "wide", kind: "image" as const, url: image(2400, 400), alt: `Panorama ${longWord}`, source_url: "https://example.com/image", media_type: "image/svg+xml", size_bytes: 1024, width: 2400, height: 400 }],
};
export const stressContent = {
  bookmark_id: stressBookmark.id, markdown: `# Extracted article\n\n${"Readable article paragraph. ".repeat(150)}\n\n\`\`\`text\n${longWord.repeat(2)}\n\`\`\`\n\nEnd of article.`,
  summary: stressBookmark.description, author: longWord, published_at: null, word_count: 700, language: "en", extracted_at: "2026-09-09T10:00:00Z",
};
