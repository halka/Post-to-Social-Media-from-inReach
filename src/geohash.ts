/** Geohash (https://en.wikipedia.org/wiki/Geohash) encoding, via ngeohash. */

import ngeohash from "ngeohash";

/**
 * Encode latitude/longitude as a geohash. Approximate cell size by precision:
 * 5 ≈ 4.9 km, 6 ≈ 1.2 km, 7 ≈ 150 m, 8 ≈ 38 m, 9 ≈ 4.8 m (default), 10 ≈ 1.2 m.
 */
export function encodeGeohash(latitude: number, longitude: number, precision = 9): string {
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new RangeError("Coordinates out of range");
  if (!Number.isInteger(precision) || precision < 1 || precision > 12) throw new RangeError("Precision must be 1–12");
  return ngeohash.encode(latitude, longitude, precision);
}
