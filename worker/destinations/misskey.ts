import { baseUrl, postJson } from './http.js';
import type { Destination } from './index.js';

/** Misskey, with an access token that has the "Compose or delete notes" (write:notes) permission. */
export const misskey: Destination = {
	name: 'Misskey',
	configured: (env) => Boolean(env.MISSKEY_URL && env.MISSKEY_ACCESS_TOKEN),
	async post({ text }, env) {
		const server = baseUrl(env.MISSKEY_URL);
		const data = await postJson(`${server}/api/notes/create`, { text }, {
			token: env.MISSKEY_ACCESS_TOKEN,
			detail: (data) => data.error?.message,
		});
		return `${server}/notes/${data.createdNote?.id}`;
	},
};
