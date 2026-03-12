/**
 * YouTube content extractor.
 *
 * Extracts video metadata and transcript without requiring an API key:
 *   - Video title + channel via YouTube oEmbed API
 *   - Transcript via YouTube's timedtext / innertube API
 *
 * Falls back gracefully: if transcript is unavailable, returns title/description only.
 *
 * Limits:
 *   - Transcript capped at 500 000 chars to keep memory bounded.
 */

import { ExtractionResult } from "./types.js";
import { log } from "../../logger.js";
import { isPrivateHost } from "../../lib/network.js";

const TIMEOUT_MS = 15_000;
const MAX_TRANSCRIPT_CHARS = 500_000;
/** Cap on raw response bytes for YouTube API calls (guard against OOM). */
const MAX_API_RESPONSE_BYTES = 2_000_000; // 2 MB
const MAX_TRANSCRIPT_RESPONSE_BYTES = 5_000_000; // 5 MB

/** Allowed hostnames for transcript XML downloads. */
const ALLOWED_TRANSCRIPT_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "video.google.com",
]);
const ALLOWED_TRANSCRIPT_HOST_SUFFIX = ".googlevideo.com";

interface OEmbedResponse {
  title: string;
  author_name: string;
  thumbnail_url?: string;
}

interface TimedTextTrack {
  baseUrl: string;
  name?: { simpleText?: string };
  languageCode?: string;
  kind?: string;
}

interface InnertubeResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: TimedTextTrack[];
    };
  };
  videoDetails?: {
    publishDate?: string;
    uploadDate?: string;
    description?: { simpleText?: string };
  };
}

/** Parse video ID from youtube.com/watch?v= or youtu.be/ URLs. */
export function parseYouTubeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id || null;
    }
    if (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "m.youtube.com"
    ) {
      const v = u.searchParams.get("v");
      if (v) return v;
      // Handle /embed/<id> and /shorts/<id>
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") return parts[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOEmbed(videoId: string): Promise<OEmbedResponse | null> {
  const embedUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(embedUrl)}&format=json`;
  try {
    const res = await fetchWithTimeout(oembedUrl);
    if (!res.ok) return null;
    return (await res.json()) as OEmbedResponse;
  } catch {
    return null;
  }
}

/**
 * Fetch transcript track list via YouTube's innertube API.
 * Returns the list of caption tracks (if any).
 */
async function fetchCaptionTracks(videoId: string): Promise<TimedTextTrack[]> {
  const url = "https://www.youtube.com/youtubei/v1/player";
  const body = JSON.stringify({
    videoId,
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20240101",
      },
    },
  });

  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; LittleImp/0.0; +https://github.com/goniszewski/little-imp)",
      },
      body,
    });
    if (!res.ok) return [];

    const text = await res.text();
    if (text.length > MAX_API_RESPONSE_BYTES) {
      log.warn("YouTube: innertube response too large, skipping", { bytes: text.length });
      return [];
    }

    const data = JSON.parse(text) as InnertubeResponse;
    return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  } catch {
    return [];
  }
}

/**
 * Validate that a transcript URL is safe to fetch:
 *   - Must be a valid URL with https protocol
 *   - Host must be a known YouTube/Google CDN domain
 *   - Host must not be a private/internal address
 */
function isAllowedTranscriptUrl(rawUrl: unknown): rawUrl is string {
  if (typeof rawUrl !== "string" || !rawUrl) return false;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    if (isPrivateHost(u.hostname)) return false;
    if (
      !ALLOWED_TRANSCRIPT_HOSTS.has(u.hostname) &&
      !u.hostname.endsWith(ALLOWED_TRANSCRIPT_HOST_SUFFIX)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Download and parse a timed-text XML transcript from YouTube.
 * Returns plain text with timestamps stripped.
 */
async function fetchTranscriptText(trackUrl: string): Promise<string | null> {
  if (!isAllowedTranscriptUrl(trackUrl)) {
    log.warn("YouTube: transcript URL failed safety check, skipping", { trackUrl });
    return null;
  }

  try {
    const res = await fetchWithTimeout(trackUrl);
    if (!res.ok) return null;
    let xml = await res.text();
    if (xml.length > MAX_TRANSCRIPT_RESPONSE_BYTES) {
      log.warn("YouTube: transcript response too large, truncating", { bytes: xml.length });
      xml = xml.slice(0, MAX_TRANSCRIPT_RESPONSE_BYTES);
    }

    // Extract text content from <text> elements, decode HTML entities.
    const segments: string[] = [];
    const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const decoded = m[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\n/g, " ")
        .trim();
      if (decoded) segments.push(decoded);
    }
    return segments.join(" ") || null;
  } catch {
    return null;
  }
}

/** Pick preferred caption track: manual English first, then any manual, then auto-generated. */
function pickBestTrack(tracks: TimedTextTrack[]): TimedTextTrack | null {
  if (tracks.length === 0) return null;

  const manual = tracks.filter((t) => t.kind !== "asr");
  const auto = tracks.filter((t) => t.kind === "asr");

  const enManual = manual.find((t) => t.languageCode?.startsWith("en"));
  if (enManual) return enManual;

  const enAuto = auto.find((t) => t.languageCode?.startsWith("en"));
  if (enAuto) return enAuto;

  return manual[0] ?? auto[0] ?? null;
}

export async function extractFromYouTube(url: string): Promise<ExtractionResult> {
  const videoId = parseYouTubeUrl(url);
  if (!videoId) throw new Error(`Not a valid YouTube URL: ${url}`);

  // Fetch oEmbed metadata (title, channel) — no API key required
  const oembed = await fetchOEmbed(videoId);
  const title = oembed?.title ?? null;
  const author = oembed?.author_name ?? null;

  // Attempt transcript extraction
  let transcript: string | null = null;
  let language: string | null = null;

  const tracks = await fetchCaptionTracks(videoId);
  const track = pickBestTrack(tracks);

  if (track) {
    log.info("YouTube: fetching transcript", { videoId, lang: track.languageCode });
    const raw = await fetchTranscriptText(track.baseUrl);
    if (raw) {
      transcript = raw.length > MAX_TRANSCRIPT_CHARS ? raw.slice(0, MAX_TRANSCRIPT_CHARS) : raw;
      language = track.languageCode ?? null;
      log.info("YouTube: transcript fetched", {
        videoId,
        chars: transcript.length,
        language,
      });
    }
  } else {
    log.info("YouTube: no caption tracks available, falling back to title only", { videoId });
  }

  const safeTitle = (title ?? "Untitled").replace(/[\r\n]+/g, " ").trim();
  const safeAuthor = (author ?? "Unknown").replace(/[\r\n]+/g, " ").trim();

  const markdown = transcript
    ? `# ${safeTitle}\n\n**Channel:** ${safeAuthor}\n\n${transcript}`
    : title ?? null;

  const wordCount = markdown ? markdown.split(/\s+/).filter(Boolean).length : null;

  return {
    title,
    markdown,
    rawHtml: null,
    author,
    publishedAt: null,
    wordCount,
    language,
  };
}
