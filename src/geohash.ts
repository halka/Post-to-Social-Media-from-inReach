/** Geohash (https://en.wikipedia.org/wiki/Geohash) encoding and decoding, via ngeohash. */

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

/** Decode a geohash to the centre of its cell, plus the cell's half-size in degrees. */
export function decodeGeohash(hash: string): { latitude: number; longitude: number; latitudeError: number; longitudeError: number } {
  // ngeohash silently yields NaN for characters outside its alphabet.
  const invalid = /[^0-9b-hjkmnp-z]/.exec(hash.toLowerCase());
  if (invalid) throw new Error(`Invalid geohash character: ${invalid[0]}`);
  const { latitude, longitude, error } = ngeohash.decode(hash.toLowerCase());
  return { latitude, longitude, latitudeError: error.latitude, longitudeError: error.longitude };
}
