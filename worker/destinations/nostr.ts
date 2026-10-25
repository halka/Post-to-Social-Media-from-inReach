import { finalizeEvent } from 'nostr-tools/pure';
import type { VerifiedEvent } from 'nostr-tools/pure';
import { decode } from 'nostr-tools/nip19';
import { hexToBytes } from 'nostr-tools/utils';
import { listVar } from '../list-var.js';
import type { Destination } from './index.js';

export const DEFAULT_NOSTR_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://yabu.me'];

const RELAY_TIMEOUT_MS = 10_000;

/** The private key as bytes, from `nsec1...` or 64 hex characters. */
export function nostrSecretKey(key: string): Uint8Array {
	const trimmed = key.trim();
	if (trimmed.startsWith('nsec1')) {
		const decoded = decode(trimmed);
		if (decoded.type !== 'nsec') throw new Error('Invalid NOSTR_PRIVATE_KEY');
		return decoded.data;
	}
	if (!/^[0-9a-f]{64}$/i.test(trimmed)) throw new Error('NOSTR_PRIVATE_KEY must be nsec1... or 64 hex characters');
	return hexToBytes(trimmed.toLowerCase());
}

/**
 * Send the event to one relay and wait for its ["OK", id, accepted, reason] reply.
 * Workers open an outgoing WebSocket with fetch() and an Upgrade header, on an http(s) URL.
 */
async function publish(relay: string, event: VerifiedEvent): Promise<void> {
	const response = await fetch(relay.replace(/^ws/i, 'http'), { headers: { Upgrade: 'websocket' } });
	const ws = (response as any).webSocket;
	if (!ws) throw new Error(`${relay}: no WebSocket (HTTP ${response.status})`);
	ws.accept();
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`${relay}: timed out`));
			ws.close();
		}, RELAY_TIMEOUT_MS);
		ws.addEventListener('message', (e: MessageEvent) => {
			let message: unknown;
			try {
				message = JSON.parse(String(e.data));
			} catch {
				return;
			}
			if (!Array.isArray(message) || message[0] !== 'OK' || message[1] !== event.id) return;
			clearTimeout(timer);
			if (message[2] === true) resolve();
			else reject(new Error(`${relay}: ${message[3] ?? 'rejected'}`));
			ws.close();
		});
		ws.addEventListener('close', () => {
			clearTimeout(timer);
			reject(new Error(`${relay}: closed`));
		});
		ws.send(JSON.stringify(['EVENT', event]));
	});
}

/** Nostr: a kind 1 note signed with the private key, sent to every relay. */
export const nostr: Destination = {
	name: 'Nostr',
	configured: (env) => Boolean(env.NOSTR_PRIVATE_KEY),
	async post({ text }, env) {
		const event = finalizeEvent(
			{ kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content: text },
			nostrSecretKey(env.NOSTR_PRIVATE_KEY),
		);
		const configured = listVar(env.NOSTR_RELAYS);
		const relays = configured.length > 0 ? configured : DEFAULT_NOSTR_RELAYS;
		const results = await Promise.allSettled(relays.map((relay) => publish(relay, event)));
		const failures = results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason)] : []));
		// One relay that stores the note is enough for it to be seen.
		if (failures.length === relays.length) throw new Error(failures.join('; '));
		if (failures.length > 0) console.warn('Some Nostr relays failed:', failures.join('; '));
		return `${event.id} (${relays.length - failures.length}/${relays.length} relays)`;
	},
};
