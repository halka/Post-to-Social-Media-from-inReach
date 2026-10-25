import type { Destination } from './index.js';

/**
 * mixi2, through relay/mixi2 running in a Cloudflare Container (see
 * worker/mixi2-container.ts). The relay shortens the post to mixi2's 149 characters.
 * Needs the MIXI2_RELAY binding in wrangler.toml and the app's client ID and secret.
 */
export const mixi2: Destination = {
	name: 'mixi2',
	configured: (env) => Boolean(env.MIXI2_RELAY && env.MIXI2_CLIENT_ID && env.MIXI2_CLIENT_SECRET),
	async post(post, env) {
		const response: Response = await env.MIXI2_RELAY.getByName('mixi2').fetch('http://container/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(post),
		});
		const data: any = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(`HTTP ${response.status} ${data.error ?? ''}`.trim());
		return data.id;
	},
};
