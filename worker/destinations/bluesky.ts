import { baseUrl, postJson } from './http.js';
import type { Destination } from './index.js';

/** A URL, without trailing punctuation that is more likely to end the sentence. */
const URL_PATTERN = /https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]'」』）]/g;

/**
 * Bluesky does not link URLs in the text by itself: each link is a "facet"
 * that marks its UTF-8 byte range.
 */
export function linkFacets(text: string): object[] {
	const encoder = new TextEncoder();
	return Array.from(text.matchAll(URL_PATTERN), (m) => {
		const byteStart = encoder.encode(text.slice(0, m.index)).length;
		return {
			index: { byteStart, byteEnd: byteStart + encoder.encode(m[0]).length },
			features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
		};
	});
}

function xrpc(service: string, method: string, body: object, accessJwt?: string): Promise<any> {
	return postJson(`${service}/xrpc/${method}`, body, {
		token: accessJwt,
		label: method,
		detail: (data) => `${data.error ?? ''} ${data.message ?? ''}`.trim(),
	});
}

/** Bluesky (or another AT Protocol server), signed in with an app password. */
export const bluesky: Destination = {
	name: 'Bluesky',
	configured: (env) => Boolean(env.BLUESKY_IDENTIFIER && env.BLUESKY_APP_PASSWORD),
	async post({ text }, env) {
		const service = baseUrl(env.BLUESKY_SERVICE || 'https://bsky.social');
		const session = await xrpc(service, 'com.atproto.server.createSession', {
			identifier: env.BLUESKY_IDENTIFIER,
			password: env.BLUESKY_APP_PASSWORD,
		});
		const facets = linkFacets(text);
		const created = await xrpc(
			service,
			'com.atproto.repo.createRecord',
			{
				repo: session.did,
				collection: 'app.bsky.feed.post',
				record: {
					$type: 'app.bsky.feed.post',
					text,
					createdAt: new Date().toISOString(),
					...(facets.length > 0 ? { facets } : {}),
				},
			},
			session.accessJwt,
		);
		return created.uri;
	},
};
