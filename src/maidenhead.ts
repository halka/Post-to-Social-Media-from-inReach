/** Maidenhead Locator System (https://en.wikipedia.org/wiki/Maidenhead_Locator_System), via @amrato/maidenhead-ts. */

import maidenheadModule from "@amrato/maidenhead-ts";

// A CommonJS module with `exports.default`: from ESM, the class is on `.default`.
const Maidenhead = maidenheadModule.default;

/**
 * Encode latitude/longitude as a Maidenhead locator. `precision` is the number of
 * characters (2, 4, 6, 8 or 10). Approximate cell size (longitude × latitude):
 * 2 ≈ 20° × 10°, 4 ≈ 2° × 1°, 6 ≈ 5' × 2.5' (default, about 7 × 5 km in Japan),
 * 8 ≈ 30" × 15", 10 ≈ 1.25" × 0.625".
 */
export function encodeMaidenhead(latitude: number, longitude: number, precision = 6): string {
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new RangeError("Coordinates out of range");
  if (!Number.isInteger(precision) || precision < 2 || precision > 10 || precision % 2 !== 0) {
    throw new RangeError("Precision must be 2, 4, 6, 8 or 10");
  }
  // The library overflows to an invalid field ("S") at exactly 90° / 180°, and adds ~1e-6° of its own
  // rounding slack, so pull those back by 1e-5° (well inside the smallest, ~1.7e-4° cell).
  const lat = Math.min(latitude, 90 - 1e-5);
  const lon = Math.min(longitude, 180 - 1e-5);
  return Maidenhead.coordinatesToGridCode(lat, lon, precision / 2);
}
