import type { Destination } from './index.js';

/** Mastodon (or a server with the same API), with an access token that has the write:statuses scope. */
export const mastodon: Destination = {
	name: 'Mastodon',
	configured: (env) => Boolean(env.MASTODON_URL && env.MASTODON_ACCESS_TOKEN),
	async post({ text }, env) {
		const server = String(env.MASTODON_URL).replace(/\/+$/, '');
		const response = await fetch(`${server}/api/v1/statuses`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.MASTODON_ACCESS_TOKEN}`,
			},
			body: JSON.stringify({ status: text }),
		});
		const data: any = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(`HTTP ${response.status} ${data.error ?? ''}`.trim());
		return data.url ?? data.id;
	},
};
