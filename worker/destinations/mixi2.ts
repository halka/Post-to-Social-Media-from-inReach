import { postJson } from './http.js';
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
		const data = await postJson('http://container/', post, { fetcher: env.MIXI2_RELAY.getByName('mixi2') });
		return data.id;
	},
};
