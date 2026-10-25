import * as PostalMime from 'postal-mime';
import xApiPost from '@kworq/x-api-post';
import { buildPostText } from './post-text.js';

/** An integer var from the Worker's env that passes `valid`; unset or invalid → `fallback`. */
function precisionVar(name: string, value: unknown, fallback: number, valid: (n: number) => boolean): number {
	if (value === undefined || value === '') return fallback;
	const precision = Number(value);
	if (Number.isInteger(precision) && valid(precision)) return precision;
	console.warn(`Invalid ${name}: ${value}, using ${fallback}`);
	return fallback;
}

export default {
	async email(message: any, env: any, ctx: any) {
		const parser = new PostalMime.default();
		const rawEmail = new Response(message.raw);
		const email = await parser.parse(await rawEmail.arrayBuffer());
		const from = email.from?.address ?? '';
		const body = email.text ?? '';
		const subject = email.subject ?? '';

		// Check sender is allowed
		// `allowed` is JSON like {"address": ["a@example.com"]}; addresses are compared case-insensitively.
		let allowed: string[] = [];
		try {
			const address = JSON.parse(env.allowed ?? '{}')?.address;
			if (Array.isArray(address)) allowed = address.map((a: unknown) => String(a).toLowerCase());
			else console.error('Invalid allowed: "address" must be an array');
		} catch (error) {
			console.error('Invalid allowed JSON:', error);
		}
		if (from === '' || !allowed.includes(from.toLowerCase())) {
			message.setReject(`Sender not allowed: ${from}`);
			return;
		}

		// 1. Message and coordinates → post text
		// An empty trigger would match every subject, so treat it as unset.
		const text = buildPostText(subject, body, {
			geohashPrecision: precisionVar('GEOHASH_PRECISION', env.GEOHASH_PRECISION, 9, (n) => n >= 1 && n <= 12),
			maidenheadPrecision: precisionVar('MAIDENHEAD_PRECISION', env.MAIDENHEAD_PRECISION, 6, (n) => [2, 4, 6, 8, 10].includes(n)),
			subjectTrigger: env.INREACH_SUBJECT_TRIGGER || undefined,
		});
		if (text === '') {
			console.log(`Failed: empty post text from ${from}`);
			return;
		}

		// 2. Post to X
		try {
			const xApiClient = new xApiPost({
				X_API_KEY: env.X_API_KEY || '',
				X_API_SECRET: env.X_API_SECRET || '',
				X_API_ACCESS_TOKEN: env.X_API_ACCESS_TOKEN || '',
				X_API_ACCESS_TOKEN_SECRET: env.X_API_ACCESS_TOKEN_SECRET || '',
			});
			const response = await xApiClient.postTweetWithMedia(text);
			// x-api-post resolves with the error body when X rejects a post,
			// so it succeeded only if X returned the new post's id.
			if (response?.data?.id) console.log(`Posted: ${response.data.id}`);
			else console.error('Error posting tweet:', JSON.stringify(response), text);
		} catch (error) {
			// Missing credentials (the constructor throws) or a network failure.
			console.error('Error posting tweet:', error, text);
		}
	},
};
