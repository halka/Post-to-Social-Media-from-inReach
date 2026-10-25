/** mixi2's limit, in graphemes (an emoji, even a ZWJ sequence, counts as 1). */
export const MIXI2_MAX_LENGTH = 149;

const graphemes = (text) => Array.from(new Intl.Segmenter().segment(text), (s) => s.segment);

/**
 * Build a mixi2 post from the Worker's webhook JSON. The Worker's `text` is
 * fitted to X and Bluesky (up to 300), too long for mixi2, so the post is
 * rebuilt from its parts: the message, shortened with "…", and the location
 * lines kept. Without the parts (not an inReach message), `text` is shortened.
 */
export function fitPost({ text, message, geohash, grid, mapUrl }, max = MIXI2_MAX_LENGTH) {
  const tail = message == null ? [] : [`Geohash: ${geohash}`, `Grid: ${grid}`, mapUrl];
  const tailLength = tail.length === 0 ? 0 : graphemes(tail.join("\n")).length + 1; // + the newline before it
  const head = graphemes(String(message ?? text ?? "").trim());
  const room = max - tailLength;
  const shortened = head.length <= room ? head.join("") : head.slice(0, room - 1).join("").trimEnd() + "…";
  return [shortened, ...tail].filter((line) => line !== "").join("\n");
}
