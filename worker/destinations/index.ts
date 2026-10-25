import type { Post } from '../post-text.js';
import { aprs } from './aprs.js';
import { bluesky } from './bluesky.js';
import { mastodon } from './mastodon.js';
import { misskey } from './misskey.js';
import { mixi2 } from './mixi2.js';
import { nostr } from './nostr.js';
import { webhook } from './webhook.js';
import { x } from './x.js';

/** A service the post is sent to. It is used only when its settings are present in env. */
export interface Destination {
	name: string;
	configured(env: any): boolean;
	/** Post `post.text`; resolves with an id or URL for the log, rejects on failure. */
	post(post: Post, env: any): Promise<string>;
}

export const DESTINATIONS: Destination[] = [x, bluesky, mastodon, misskey, mixi2, nostr, aprs, webhook];
