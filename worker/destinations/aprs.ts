import type { Destination } from './index.js';

export const DEFAULT_APRS_SERVER = 'rotate.aprs2.net:14580';
/** Table and code of the map symbol: "/[" is a person (hiker). */
export const DEFAULT_APRS_SYMBOL = '/[';
/** The APRS spec's limit for the comment of a position report without data extension. */
export const APRS_COMMENT_MAX_LENGTH = 43;
/** Destination field: APZ is the block for experimental software. */
const TOCALL = 'APZINR';
/** Software name sent in the APRS-IS login ("vers <name> <version>"); APRS_APP_NAME overrides it. */
export const DEFAULT_APRS_APP_NAME = 'inReach2socialmedia';
const APRS_APP_VERSION = '0.1';
const APRS_TIMEOUT_MS = 10_000;

/** The login line splits on spaces, so a name with spaces becomes one word. */
export function aprsAppName(name: unknown): string {
	return String(name ?? '').trim().replace(/\s+/g, '-') || DEFAULT_APRS_APP_NAME;
}

/** `value` in degrees as APRS degrees and minutes, e.g. 35.683851 → "3541.03". */
function degreesMinutes(value: number, degreeDigits: number): string {
	// Round once, in hundredths of a minute, so 59.996' cannot become "60.00".
	const hundredths = Math.round(Math.abs(value) * 6000);
	const degrees = Math.floor(hundredths / 6000);
	const minutes = (hundredths % 6000) / 100;
	return String(degrees).padStart(degreeDigits, '0') + minutes.toFixed(2).padStart(5, '0');
}

/**
 * The message as an APRS comment: printable ASCII only, on one line. Full-width
 * letters and digits become ASCII (NFKC); anything else outside ASCII is
 * dropped, and so are "|" and "~", which APRS reserves.
 */
export function aprsComment(message: string): string {
	return message
		.normalize('NFKC')
		.replace(/[^\x20-\x7e]|[|~]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * An APRS position report without timestamp ("!"), e.g.
 *   JA1ABC-7>APZINR,TCPIP*:!3541.03N/13945.24E[message
 * The comment is only the message (no geohash or grid: the position is in the
 * report itself), as ASCII, cut to 43 characters.
 */
export function positionPacket(
	callsign: string,
	latitude: number,
	longitude: number,
	comment: string,
	symbol = DEFAULT_APRS_SYMBOL,
): string {
	const lat = degreesMinutes(latitude, 2) + (latitude < 0 ? 'S' : 'N');
	const lon = degreesMinutes(longitude, 3) + (longitude < 0 ? 'W' : 'E');
	const cut = aprsComment(comment).slice(0, APRS_COMMENT_MAX_LENGTH).trimEnd();
	return `${callsign}>${TOCALL},TCPIP*:!${lat}${symbol[0]}${lon}${symbol[1]}${cut}`;
}

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what}: timed out`)), APRS_TIMEOUT_MS)),
	]);
}

/**
 * APRS (APRS-IS): a position report with the message as its comment, sent over
 * TCP with the callsign's passcode. Skipped when the message had no GPS fix, so
 * a made-up location is never reported.
 */
export const aprs: Destination = {
	name: 'APRS',
	configured: (env) => Boolean(env.APRS_CALLSIGN && env.APRS_PASSCODE),
	async post({ message, latitude, longitude, isFallbackLocation }, env) {
		if (latitude === null || longitude === null || isFallbackLocation) return 'skipped: no GPS fix';

		const callsign = String(env.APRS_CALLSIGN).trim().toUpperCase();
		const symbol = String(env.APRS_SYMBOL || DEFAULT_APRS_SYMBOL);
		if (symbol.length !== 2) throw new Error('APRS_SYMBOL must be 2 characters: table and code');
		const packet = positionPacket(callsign, latitude, longitude, message ?? '', symbol);

		const [hostname, port = '14580'] = String(env.APRS_SERVER || DEFAULT_APRS_SERVER).split(':');
		// Imported here so the rest of this module also loads outside Workers (in tests).
		// @ts-ignore: a Workers-only module
		const { connect } = await import('cloudflare:sockets');
		const socket = connect({ hostname, port: Number(port) });
		const writer = socket.writable.getWriter();
		const reader = socket.readable.pipeThrough(new TextDecoderStream()).getReader();
		const encoder = new TextEncoder();
		try {
			const login = `user ${callsign} pass ${env.APRS_PASSCODE} vers ${aprsAppName(env.APRS_APP_NAME)} ${APRS_APP_VERSION}`;
			await writer.write(encoder.encode(`${login}\r\n`));
			// Wait for "# logresp CALL verified, server ...": an unverified login can't send packets.
			let received = '';
			await withTimeout(
				(async () => {
					while (!/^# logresp .*$/m.test(received)) {
						const { value, done } = await reader.read();
						if (done) throw new Error(`closed before login reply: ${received.trim()}`);
						received += value;
					}
				})(),
				'APRS login',
			);
			const logresp = /^# logresp .*$/m.exec(received)![0];
			if (!/ verified/.test(logresp)) throw new Error(`login not verified (check APRS_PASSCODE): ${logresp}`);
			await writer.write(encoder.encode(`${packet}\r\n`));
			return packet;
		} finally {
			await socket.close().catch(() => {});
		}
	},
};
