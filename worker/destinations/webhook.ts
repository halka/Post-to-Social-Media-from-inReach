import { listVar } from '../list-var.js';
import type { Destination } from './index.js';

/**
 * POST the post as JSON to each URL in WEBHOOK_URL (a JSON array, or URLs
 * separated by spaces, commas or newlines):
 *   { text, content, message, latitude, longitude, geohash, grid, mapUrl, isFallbackLocation }
 * `text` and `content` are both the finished post text: `text` is what Slack
 * incoming webhooks read and `content` is what Discord's read. The rest are its
 * parts, null when the email was not an inReach notification.
 */
export const webhook: Destination = {
	name: 'Webhook',
	configured: (env) => Boolean(env.WEBHOOK_URL),
	async post(post, env) {
		const urls = listVar(env.WEBHOOK_URL);
		const body = JSON.stringify({ ...post, content: post.text });
		const results = await Promise.allSettled(
			urls.map(async (url) => {
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body,
				});
				// The URL is left out of errors: it usually contains the webhook's secret.
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
			}),
		);
		const failures = results.flatMap((r, i) => (r.status === 'rejected' ? [`#${i + 1}: ${r.reason}`] : []));
		if (failures.length > 0) throw new Error(failures.join('; '));
		return `${urls.length} URL(s)`;
	},
};
