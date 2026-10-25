import type { Destination } from './index.js';

/** Misskey, with an access token that has the "Compose or delete notes" (write:notes) permission. */
export const misskey: Destination = {
	name: 'Misskey',
	configured: (env) => Boolean(env.MISSKEY_URL && env.MISSKEY_ACCESS_TOKEN),
	async post({ text }, env) {
		const server = String(env.MISSKEY_URL).replace(/\/+$/, '');
		const response = await fetch(`${server}/api/notes/create`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.MISSKEY_ACCESS_TOKEN}`,
			},
			body: JSON.stringify({ text }),
		});
		const data: any = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(`HTTP ${response.status} ${data.error?.message ?? ''}`.trim());
		return `${server}/notes/${data.createdNote?.id}`;
	},
};
