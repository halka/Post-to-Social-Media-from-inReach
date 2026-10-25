import { encodeGeohash } from "./geohash.js";
import { encodeMaidenhead } from "./maidenhead.js";

/** Subject fragment that identifies an inReach message notification. */
export const INREACH_SUBJECT_TRIGGER = "さんからのinReachメッセージ";

export interface InReachMessage {
  /** Sender name taken from the subject, e.g. "HALKA". */
  sender: string;
  /** The text the sender typed, with line breaks preserved. */
  message: string;
  /** Decimal degrees, or null when the message was sent without a GPS fix. */
  latitude: number | null;
  longitude: number | null;
  /** Geohash of the coordinates (9 characters ≈ 5 m by default), or null without coordinates. */
  geohash: string | null;
  /** Maidenhead locator of the coordinates (6 characters by default), or null without coordinates. */
  maidenhead: string | null;
  /** inreachlink.com URL for viewing the location / replying. */
  replyUrl: string | null;
  /** Decoded subject line. */
  subject: string;
}

/** Optional settings shared by the parse functions. */
export interface InReachParseOptions {
  /** Geohash length, 1–12 (default 9). */
  geohashPrecision?: number;
  /** Maidenhead locator length, 2, 4, 6, 8 or 10 (default 6). */
  maidenheadPrecision?: number;
  /** Subject fragment that identifies a notification (default INREACH_SUBJECT_TRIGGER). */
  subjectTrigger?: string;
}

/**
 * Parse an already-decoded subject and plain-text body, e.g. from postal-mime,
 * the Gmail API or Google Apps Script (`getSubject()` / `getPlainBody()`).
 * Returns null when the subject does not contain the inReach trigger.
 */
export function parseInReachContent(
  subject: string,
  body: string,
  { geohashPrecision = 9, maidenheadPrecision = 6, subjectTrigger = INREACH_SUBJECT_TRIGGER }: InReachParseOptions = {},
): InReachMessage | null {
  const triggerAt = subject.indexOf(subjectTrigger);
  if (triggerAt === -1) return null;

  const text = body.replace(/\r\n?/g, "\n");
  const { latitude, longitude } = extractCoordinates(text);
  return {
    sender: subject.slice(0, triggerAt).trim(),
    message: extractMessageText(text),
    latitude,
    longitude,
    geohash: latitude !== null && longitude !== null ? encodeGeohash(latitude, longitude, geohashPrecision) : null,
    maidenhead: latitude !== null && longitude !== null ? encodeMaidenhead(latitude, longitude, maidenheadPrecision) : null,
    replyUrl: /https?:\/\/(?:[\w-]+\.)*inreachlink\.com\/[^\s<>"]+/.exec(text)?.[0] ?? null,
    subject,
  };
}

/** Already-decoded fields, as delivered by mail triggers (Zapier, n8n, Gmail API, ...). */
export interface InReachMailFields {
  subject: string;
  text: string;
  from?: string;
}

/**
 * Parse decoded `{ subject, from, text }` fields. `from` is optional and is
 * copied to the result as-is. Returns null when the subject lacks the trigger.
 */
export function parseInReachFields(
  fields: InReachMailFields,
  options: InReachParseOptions = {},
): (InReachMessage & { from?: string }) | null {
  const result = parseInReachContent(fields.subject.trim(), fields.text, options);
  if (!result) return null;
  return fields.from === undefined ? result : { ...result, from: fields.from };
}

/** Lines where the Garmin boilerplate begins (Japanese and English templates). */
const BOILERPLATE_START: RegExp[] = [
  /位置情報を確認するか/,
  /さんが次の場所からメッセージを送信しました/,
  /^View the location or send a reply to/i,
  /sent this message from:/i,
  /inreachlink\.com\//,
  /^Do not reply directly to this message/i,
  /このメッセージに直接返信しないでください/,
];

/** The user-typed text: everything before the first boilerplate line. */
export function extractMessageText(body: string): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let end = lines.findIndex((line) => BOILERPLATE_START.some((re) => re.test(line)));
  if (end === -1) end = lines.length;
  return lines
    .slice(0, end)
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}
/**
 * Extract "Lat 41.796132 Lon 140.76082" as decimal degrees. Garmin's coordinate
 * line comes after the user's message, so the last match wins: "Lat … Lon …"
 * typed in the message cannot replace the real position.
 */
export function extractCoordinates(body: string): { latitude: number | null; longitude: number | null } {
  const matches = Array.from(body.matchAll(/Lat\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*,?\s*Lon\s*[:=]?\s*(-?\d+(?:\.\d+)?)/gi));
  const m = matches.at(-1);
  if (!m) return { latitude: null, longitude: null };
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { latitude: null, longitude: null };
  // inReach reports "Lat 0.000000 Lon 0.000000" when it had no GPS fix.
  if (latitude === 0 && longitude === 0) return { latitude: null, longitude: null };
  return { latitude, longitude };
}
