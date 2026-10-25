import { ApiResponseError, TwitterApi } from 'twitter-api-v2';
import type { Destination } from './index.js';

/** X (Twitter), with an app's OAuth 1.0a keys. The app needs Read and Write permission. */
export const x: Destination = {
	name: 'X',
	configured: (env) =>
		Boolean(env.X_API_KEY && env.X_API_SECRET && env.X_API_ACCESS_TOKEN && env.X_API_ACCESS_TOKEN_SECRET),
	async post({ text }, env) {
		const client = new TwitterApi({
			appKey: env.X_API_KEY,
			appSecret: env.X_API_SECRET,
			accessToken: env.X_API_ACCESS_TOKEN,
			accessSecret: env.X_API_ACCESS_TOKEN_SECRET,
		});
		try {
			const { data } = await client.v2.tweet(text);
			return data.id;
		} catch (error) {
			// Put X's reason (its title and detail, such as duplicate content or
			// missing write permission) in the message so it shows in the log.
			if (error instanceof ApiResponseError) {
				throw new Error(`HTTP ${error.code}: ${JSON.stringify(error.data)}`);
			}
			throw error;
		}
	},
};
