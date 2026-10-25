import { ApiResponseError, TwitterApi } from 'twitter-api-v2';
import type { Destination } from './index.js';

/**
 * X (Twitter), with OAuth 1.0a: the app's API Key & Secret and the Access Token &
 * Secret of the account to post as, all from the app's "Keys and tokens" tab.
 * The app needs Read and write permission, and the access token must be
 * generated after it is set.
 */
export const x: Destination = {
	name: 'X',
	configured: (env) =>
		Boolean(env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET),
	async post({ text }, env) {
		const client = new TwitterApi({
			appKey: env.X_API_KEY,
			appSecret: env.X_API_SECRET,
			accessToken: env.X_ACCESS_TOKEN,
			accessSecret: env.X_ACCESS_TOKEN_SECRET,
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
