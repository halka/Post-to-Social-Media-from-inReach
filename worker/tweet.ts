/**
 * X (Twitter) post length, counted the way X counts it (twitter-text v3):
 * - Latin, symbols etc. (U+0000–U+10FF and a few punctuation ranges) = 1
 * - everything else, including Japanese and emoji = 2
 * - every URL = 23, however long
 * The limit is 280. `string.length` is not a valid check: a 200-character
 * Japanese post is 200 by `length` but 400 for X.
 */

export const TWEET_MAX_LENGTH = 280;
const URL_LENGTH = 23;
// twitter-text ends a URL at the first non-ASCII character (e.g. Japanese text written right after it).
const URL_RE = /https?:\/\/[\x21-\x7e]+/g;

/** Code point ranges that count as 1 (from twitter-text's default config). */
const LIGHT_RANGES: Array<[number, number]> = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];

function weightOf(codePoint: number): number {
  return LIGHT_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi) ? 1 : 2;
}

/** Length of `text` as X counts it. */
export function tweetLength(text: string): number {
  const normalized = text.normalize("NFC");
  let length = 0;
  const withoutUrls = normalized.replace(URL_RE, () => {
    length += URL_LENGTH;
    return "";
  });
  for (const ch of withoutUrls) length += weightOf(ch.codePointAt(0)!);
  return length;
}

/**
 * Join `head` and `tail` lines with newlines so the result fits in `max`.
 * The head (the user's message) is shortened first, ending in "…", so the
 * tail lines (map link, address) stay intact. If even an empty head does not
 * fit, tail lines are dropped from the end.
 */
export function fitTweet(head: string, tail: string[] = [], max = TWEET_MAX_LENGTH, ellipsis = "…"): string {
  const join = (h: string, t: string[]) => [h, ...t].filter((line) => line !== "").join("\n");

  const full = join(head, tail);
  if (tweetLength(full) <= max) return full;

  // Cut on grapheme boundaries so emoji sequences and combining marks are not split.
  const chars = Array.from(new Intl.Segmenter().segment(head), (s) => s.segment);
  for (let n = chars.length - 1; n > 0; n--) {
    const candidate = join(chars.slice(0, n).join("").trimEnd() + ellipsis, tail);
    if (tweetLength(candidate) <= max) return candidate;
  }
  if (tail.length > 0) return fitTweet(head, tail.slice(0, -1), max, ellipsis);
  return "";
}
