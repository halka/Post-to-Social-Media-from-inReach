/**
 * X (Twitter) post length, counted by X's own twitter-text library:
 * Latin = 1, Japanese and emoji (even ZWJ sequences) = 2, every URL or bare
 * domain such as `garmin.com` = 23. The limit is 280. `string.length` is not a
 * valid check: a 200-character Japanese post is 200 by `length` but 400 for X.
 */

// CommonJS package (with an ESM build for bundlers): its functions are on the default import.
import twitterText from "twitter-text";

export const TWEET_MAX_LENGTH = 280;

/**
 * Bluesky's limit, in graphemes. It is usually looser than X's, but not always:
 * X counts a long URL as 23, Bluesky counts every character of it.
 */
export const BLUESKY_MAX_GRAPHEMES = 300;

/** Length of `text` as X counts it. */
export function tweetLength(text: string): number {
  return twitterText.parseTweet(text).weightedLength;
}

function graphemeCount(text: string): number {
  let count = 0;
  for (const _ of new Intl.Segmenter().segment(text)) count++;
  return count;
}

/** The same text goes to every destination, so it must fit X's `max` and Bluesky's limit. */
function fits(text: string, max: number): boolean {
  return tweetLength(text) <= max && graphemeCount(text) <= BLUESKY_MAX_GRAPHEMES;
}

/**
 * Join `head` and `tail` lines with newlines so the result fits in `max`.
 * The head (the user's message) is shortened first, ending in "…", so the
 * tail lines (map link, address) stay intact. If even an empty head does not
 * fit, tail lines are dropped from the end.
 */
export function fitTweet(head: string, tail: string[] = [], max = TWEET_MAX_LENGTH, ellipsis = "…"): string {
  const join = (h: string, t: string[]) => [h, ...t].filter((line) => line !== "").join("\n");

  // Cut on grapheme boundaries so emoji sequences and combining marks are not split.
  let chars = Array.from(new Intl.Segmenter().segment(head), (s) => s.segment);
  // twitter-text's URL matching is quadratic on long non-ASCII runs (20k Japanese
  // characters ≈ 4 s), so only ever count the first 2 × max characters. Every
  // character weighs at least 1 except inside URLs, so a longer head cannot fit anyway
  // unless it is mostly URLs.
  if (chars.length > 2 * max) {
    chars = chars.slice(0, 2 * max);
  } else {
    const full = join(head, tail);
    if (fits(full, max)) return full;
  }
  const cut = (n: number) => join(chars.slice(0, n).join("").trimEnd() + ellipsis, tail);
  const cutFits = (n: number) => fits(cut(n), max);

  // Find the longest prefix that fits without re-counting after every removed
  // character: double the length until it stops fitting, then binary search.
  // Each count only covers about as much text as the post itself, however long the head is.
  if (chars.length > 1 && cutFits(1)) {
    let lo = 1; // fits
    let hi = chars.length - 1; // longest candidate (the full head did not fit)
    for (let n = 2; n < hi; n *= 2) {
      if (!cutFits(n)) {
        hi = n - 1;
        break;
      }
      lo = n;
    }
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (cutFits(mid)) lo = mid;
      else hi = mid - 1;
    }
    return cut(lo);
  }
  if (tail.length > 0) return fitTweet(head, tail.slice(0, -1), max, ellipsis);
  return "";
}
