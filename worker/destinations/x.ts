import xApiPost from '@kworq/x-api-post';
import type { Destination } from './index.js';

/** X (Twitter), with an app's OAuth 1.0a keys. */
export const x: Destination = {
	name: 'X',
	configured: (env) =>
		Boolean(env.X_API_KEY && env.X_API_SECRET && env.X_API_ACCESS_TOKEN && env.X_API_ACCESS_TOKEN_SECRET),
	async post({ text }, env) {
		const client = new xApiPost({
			X_API_KEY: env.X_API_KEY || '',
			X_API_SECRET: env.X_API_SECRET || '',
			X_API_ACCESS_TOKEN: env.X_API_ACCESS_TOKEN || '',
			X_API_ACCESS_TOKEN_SECRET: env.X_API_ACCESS_TOKEN_SECRET || '',
		});
		const response = await client.postTweetWithMedia(text);
		// x-api-post resolves with the error body when X rejects a post,
		// so it succeeded only if X returned the new post's id.
		if (!response?.data?.id) throw new Error(JSON.stringify(response));
		return response.data.id;
	},
};
