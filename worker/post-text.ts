import { parseInReachFields } from '../src/inreach.js';
import { encodeGeohash } from '../src/geohash.js';
import { encodeMaidenhead } from '../src/maidenhead.js';
import type { InReachParseOptions } from '../src/inreach.js';
import { TWEET_MAX_LENGTH, fitTweet } from './tweet.js';

export interface Location {
	latitude: number;
	longitude: number;
}

/** Used when an inReach message has no coordinates (no GPS fix, or "Lat 0 Lon 0"). */
export const IMPERIAL_PALACE: Location = { latitude: 35.683851, longitude: 139.753973 };

/**
 * What is sent to the destinations: the finished `text`, plus its parts for
 * destinations that build their own (the webhook passes them on). The parts
 * are null when the email is not an inReach notification.
 */
export interface Post {
	text: string;
	/** The whole message as typed, not shortened. */
	message: string | null;
	latitude: number | null;
	longitude: number | null;
	geohash: string | null;
	grid: string | null;
	mapUrl: string | null;
	/** True when the message had no GPS fix and the location is `fallback`, not where it was sent from. */
	isFallbackLocation: boolean;
}

/**
 * Build the post from a decoded email. Its text is:
 *   message            (shortened with "…" if the post would be too long)
 *   Geohash: geohash
 *   Grid: Maidenhead locator
 *   Google Maps link
 * Without coordinates, `fallback` (the Imperial Palace by default) is used.
 * Fits X's 280 limit as X counts it (Japanese = 2, URL = 23) and Bluesky's 300.
 */
export function buildPost(
	subject: string,
	body: string,
	{
		geohashPrecision = 9,
		gridPrecision: gridPrecision = 6,
		subjectTrigger,
		maxPostLength = TWEET_MAX_LENGTH,
		fallback = IMPERIAL_PALACE,
	}: InReachParseOptions & { maxPostLength?: number; fallback?: Location } = {},
): Post {
	const inReach = parseInReachFields({ subject, text: body }, { geohashPrecision, gridPrecision: gridPrecision, subjectTrigger });
	if (!inReach) {
		// Not an inReach message: first non-empty line, as before.
		const text = fitTweet(body.split(/\r?\n/).find((line) => line.trim() !== '') ?? '', [], maxPostLength);
		return {
			text,
			message: null,
			latitude: null,
			longitude: null,
			geohash: null,
			grid: null,
			mapUrl: null,
			isFallbackLocation: false,
		};
	}

	const isFallbackLocation = inReach.latitude === null || inReach.longitude === null;
	const { latitude, longitude } = isFallbackLocation
		? fallback
		: { latitude: inReach.latitude!, longitude: inReach.longitude! };
	// The parser already encoded real coordinates; only the fallback needs encoding here.
	const geohash = inReach.geohash ?? encodeGeohash(latitude, longitude, geohashPrecision);
	const grid = inReach.grid ?? encodeMaidenhead(latitude, longitude, gridPrecision);
	const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
	const text = fitTweet(inReach.message, [`Geohash: ${geohash}`, `Grid: ${grid}`, mapUrl], maxPostLength);
	return { text, message: inReach.message, latitude, longitude, geohash, grid, mapUrl, isFallbackLocation };
}
