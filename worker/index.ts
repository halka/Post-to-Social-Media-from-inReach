import * as PostalMime from 'postal-mime';
import { DESTINATIONS } from './destinations/index.js';
import { listVar } from './list-var.js';
import { buildPost } from './post-text.js';

// The Durable Object that runs the mixi2 relay container; see wrangler.toml in README.md.
export { Mixi2Relay } from './mixi2-container.js';

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
		// `permittedAddresses` is a list of addresses: a JSON array such as ["a@example.com"], or the original
		// {"address": [...]}, or comma-separated text. Addresses are compared case-insensitively.
		let permittedAddresses: string[] = [];
		try {
			permittedAddresses = listVar(env.permittedAddresses, 'address').map((a) => a.toLowerCase());
		} catch (error) {
			console.error('Invalid permittedAddresses:', error);
		}
		if (from === '' || !permittedAddresses.includes(from.toLowerCase())) {
			message.setReject(`Sender not allowed: ${from}`);
			return;
		}

		// 1. Message and coordinates → post text
		// An empty trigger would match every subject, so treat it as unset.
		const post = buildPost(subject, body, {
			geohashPrecision: precisionVar('GEOHASH_PRECISION', env.GEOHASH_PRECISION, 9, (n) => n >= 1 && n <= 12),
			gridPrecision: precisionVar('GRID_PRECISION', env.GRID_PRECISION, 6, (n) => [2, 4, 6, 8, 10].includes(n)),
			subjectTrigger: env.INREACH_SUBJECT_TRIGGER || undefined,
		});
		if (post.text === '') {
			console.log(`Failed: empty post text from ${from}`);
			return;
		}

		// 2. Post to every destination whose settings are present, in parallel;
		// one failing does not stop the others.
		const destinations = DESTINATIONS.filter((d) => d.configured(env));
		if (destinations.length === 0) {
			console.error('No destination configured: set the secrets of at least one service');
			return;
		}
		const results = await Promise.allSettled(destinations.map((d) => d.post(post, env)));
		results.forEach((result, i) => {
			if (result.status === 'fulfilled') console.log(`Posted to ${destinations[i].name}: ${result.value}`);
			else console.error(`Error posting to ${destinations[i].name}:`, result.reason, post.text);
		});
	},
};
