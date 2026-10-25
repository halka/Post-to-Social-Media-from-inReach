import { baseUrl, postJson } from './http.js';
import type { Destination } from './index.js';

/** Mastodon (or a server with the same API), with an access token that has the write:statuses scope. */
export const mastodon: Destination = {
	name: 'Mastodon',
	configured: (env) => Boolean(env.MASTODON_URL && env.MASTODON_ACCESS_TOKEN),
	async post({ text }, env) {
		const data = await postJson(`${baseUrl(env.MASTODON_URL)}/api/v1/statuses`, { status: text }, {
			token: env.MASTODON_ACCESS_TOKEN,
		});
		return data.url ?? data.id;
	},
};
