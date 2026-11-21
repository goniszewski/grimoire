/**
 * Apple Shortcuts generator for the "Send to Grimoire" Share Sheet shortcut.
 *
 * Builds a Shortcuts workflow (property list) that receives URLs / Safari web
 * pages from the Share Sheet and POSTs them to Grimoire's authenticated
 * `POST /capture` endpoint. iOS and macOS only import *signed* shortcut files,
 * so on macOS the result is signed locally with the `shortcuts sign` CLI.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const SHORTCUT_FILENAME = "SendToGrimoire.shortcut";
const SIGN_TIMEOUT_MS = 30_000;

type PlistValue = string | number | boolean | PlistValue[] | { [key: string]: PlistValue };

export interface ShortcutOptions {
  /** Daemon origin reachable from the device that runs the shortcut, e.g. https://mac.tailnet.ts.net */
  serverUrl: string;
  /** Full integration bearer token embedded in the shortcut. */
  token: string;
  /** Optional root category new bookmarks are filed under. */
  category?: string;
}

// ─── Plist serialization ──────────────────────────────────────────────────────

// Characters XML 1.0 cannot represent; a plist containing them fails to parse.
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function serializeValue(value: PlistValue, indent: string): string {
  if (typeof value === "string") return `${indent}<string>${escapeXml(value)}</string>\n`;
  if (typeof value === "boolean") return `${indent}<${value ? "true" : "false"}/>\n`;
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? `${indent}<integer>${value}</integer>\n`
      : `${indent}<real>${value}</real>\n`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}<array/>\n`;
    return `${indent}<array>\n${value.map((v) => serializeValue(v, `${indent}\t`)).join("")}${indent}</array>\n`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return `${indent}<dict/>\n`;
  const body = entries
    .map(([key, v]) => `${indent}\t<key>${escapeXml(key)}</key>\n${serializeValue(v, `${indent}\t`)}`)
    .join("");
  return `${indent}<dict>\n${body}${indent}</dict>\n`;
}

export function toXmlPlist(root: PlistValue): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
    `<plist version="1.0">\n${serializeValue(root, "")}</plist>\n`
  );
}

// ─── Workflow construction ────────────────────────────────────────────────────

const OBJECT_REPLACEMENT = "￼";

function text(value: string): PlistValue {
  return {
    Value: { string: value, attachmentsByRange: {} },
    WFSerializationType: "WFTextTokenString",
  };
}

function tokenString(attachment: PlistValue): PlistValue {
  return {
    Value: { string: OBJECT_REPLACEMENT, attachmentsByRange: { "{0, 1}": attachment } },
    WFSerializationType: "WFTextTokenString",
  };
}

/** Item types used by Shortcuts dictionary editors. */
const ITEM_TYPE_TEXT = 0;
const ITEM_TYPE_DICTIONARY = 1;

function field(key: string, value: PlistValue, itemType = ITEM_TYPE_TEXT): PlistValue {
  return { WFItemType: itemType, WFKey: text(key), WFValue: value };
}

function dictionary(items: PlistValue[]): PlistValue {
  return {
    Value: { WFDictionaryFieldValueItems: items },
    WFSerializationType: "WFDictionaryFieldValue",
  };
}

/** A dictionary nested inside another dictionary item (wrapped one level deeper). */
function nestedDictionary(items: PlistValue[]): PlistValue {
  return { Value: dictionary(items), WFSerializationType: "WFDictionaryFieldValue" };
}

function action(identifier: string, parameters: Record<string, PlistValue>): PlistValue {
  return { WFWorkflowActionIdentifier: identifier, WFWorkflowActionParameters: parameters };
}

export function buildShortcutWorkflow(options: ShortcutOptions): PlistValue {
  const captureUrl = `${options.serverUrl.replace(/\/+$/, "")}/capture`;
  const detectLinkId = randomUUID().toUpperCase();
  const firstLinkId = randomUUID().toUpperCase();
  const requestId = randomUUID().toUpperCase();

  const bodyFields: PlistValue[] = [
    field("url", tokenString({ Type: "ActionOutput", OutputUUID: firstLinkId, OutputName: "Item from List" })),
    field(
      "title",
      tokenString({
        Type: "ExtensionInput",
        Aggrandizements: [{ Type: "WFPropertyVariableAggrandizement", PropertyName: "Name" }],
      })
    ),
    field("source", nestedDictionary([field("client", text("apple-shortcut"))]), ITEM_TYPE_DICTIONARY),
  ];
  if (options.category) bodyFields.push(field("category", text(options.category)));

  return {
    WFWorkflowClientVersion: "900",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: "900",
    WFWorkflowIcon: { WFWorkflowIconStartColor: 4282601983, WFWorkflowIconGlyphNumber: 59511 },
    WFWorkflowImportQuestions: [],
    WFWorkflowInputContentItemClasses: ["WFURLContentItem", "WFSafariWebPageContentItem"],
    WFWorkflowTypes: ["ActionExtension"],
    WFWorkflowActions: [
      action("is.workflow.actions.detect.link", { UUID: detectLinkId }),
      // Several links can arrive from one share; keep the first so `url` is always a single string.
      action("is.workflow.actions.getitemfromlist", {
        UUID: firstLinkId,
        WFItemSpecifier: "First Item",
        WFInput: {
          Value: { Type: "ActionOutput", OutputUUID: detectLinkId, OutputName: "URLs" },
          WFSerializationType: "WFTextTokenAttachment",
        },
      }),
      action("is.workflow.actions.downloadurl", {
        UUID: requestId,
        WFURL: captureUrl,
        WFHTTPMethod: "POST",
        WFHTTPBodyType: "JSON",
        WFJSONValues: dictionary(bodyFields),
        WFHTTPHeaders: dictionary([field("Authorization", text(`Bearer ${options.token}`))]),
      }),
      // Reads `data.bookmark.id` from the response. On any error response (401, 409, 422, ...) the key is
      // missing and Shortcuts stops with an alert, so the success notification below only shows on a real save.
      // (An If/Otherwise on the response would be friendlier, but its undocumented parameter format
      // imported with an empty value, which made Shortcuts refuse to run the shortcut.)
      action("is.workflow.actions.getvalueforkey", {
        WFDictionaryKey: "data.bookmark.id",
        WFInput: {
          Value: { Type: "ActionOutput", OutputUUID: requestId, OutputName: "Contents of URL" },
          WFSerializationType: "WFTextTokenAttachment",
        },
      }),
      action("is.workflow.actions.notification", {
        WFNotificationActionTitle: "Grimoire",
        WFNotificationActionBody: "Saved to Grimoire",
      }),
    ],
  };
}

// ─── Signing ──────────────────────────────────────────────────────────────────

/** True when this host can sign shortcut files (macOS with the `shortcuts` CLI). */
export function canSignShortcuts(): boolean {
  return process.platform === "darwin" && Bun.which("shortcuts") !== null;
}

/**
 * Signs an unsigned workflow plist with `shortcuts sign --mode anyone`.
 * Returns null when signing is unavailable or fails, so callers can fall back
 * to the unsigned file and explain how to sign it.
 */
export async function signShortcut(unsignedPlist: string): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!canSignShortcuts()) return null;

  const dir = await mkdtemp(join(tmpdir(), "grimoire-shortcut-"));
  try {
    const input = join(dir, "in.shortcut");
    const output = join(dir, "out.shortcut");
    await writeFile(input, unsignedPlist, { mode: 0o600 });

    const proc = Bun.spawn(
      ["shortcuts", "sign", "--mode", "anyone", "--input", input, "--output", output],
      { stdout: "ignore", stderr: "ignore" }
    );
    const timer = setTimeout(() => proc.kill(), SIGN_TIMEOUT_MS);
    const exitCode = await proc.exited.finally(() => clearTimeout(timer));
    if (exitCode !== 0) return null;

    return Uint8Array.from(await readFile(output));
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface GeneratedShortcut {
  data: Uint8Array<ArrayBuffer>;
  signed: boolean;
  /** True when this host tried to sign (macOS) so an unsigned result means signing failed, not "unsupported". */
  signAttempted: boolean;
}

export async function generateShortcut(options: ShortcutOptions): Promise<GeneratedShortcut> {
  const plist = toXmlPlist(buildShortcutWorkflow(options));
  const signAttempted = canSignShortcuts();
  const signed = await signShortcut(plist);
  if (signed) return { data: signed, signed: true, signAttempted };
  return { data: new TextEncoder().encode(plist), signed: false, signAttempted };
}
