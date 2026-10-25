import { encodeGeohash, encodeMaidenhead, parseInReachFields } from '../src/index.js';
import type { InReachParseOptions } from '../src/index.js';
import { TWEET_MAX_LENGTH, fitTweet } from './tweet.js';

export interface Location {
	latitude: number;
	longitude: number;
}

/** Used when an inReach message has no coordinates (no GPS fix, or "Lat 0 Lon 0"). */
export const IMPERIAL_PALACE: Location = { latitude: 35.683851, longitude: 139.753973 };

/**
 * Build the post text from a decoded email:
 *   message            (shortened with "…" if the post would be too long)
 *   Google Maps link
 *   geohash
 *   Maidenhead locator
 * Without coordinates, `fallback` (the Imperial Palace by default) is used.
 * Fits X's 280 limit as X counts it (Japanese = 2, URL = 23).
 */
export function buildPostText(
	subject: string,
	body: string,
	{
		geohashPrecision = 9,
		maidenheadPrecision = 6,
		subjectTrigger,
		maxPostLength = TWEET_MAX_LENGTH,
		fallback = IMPERIAL_PALACE,
	}: InReachParseOptions & { maxPostLength?: number; fallback?: Location } = {},
): string {
	const inReach = parseInReachFields({ subject, text: body }, { geohashPrecision, maidenheadPrecision, subjectTrigger });
	if (!inReach) {
		// Not an inReach message: first non-empty line, as before.
		return fitTweet(body.split(/\r?\n/).find((line) => line.trim() !== '') ?? '', [], maxPostLength);
	}

	const { latitude, longitude } =
		inReach.latitude !== null && inReach.longitude !== null
			? { latitude: inReach.latitude, longitude: inReach.longitude }
			: fallback;
	const tail = [
		`https://maps.google.com/?q=${latitude},${longitude}`,
		encodeGeohash(latitude, longitude, geohashPrecision),
		encodeMaidenhead(latitude, longitude, maidenheadPrecision),
	];
	return fitTweet(inReach.message, tail, maxPostLength);
}
