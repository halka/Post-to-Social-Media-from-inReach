// @ts-ignore: a Workers-only module
import { DurableObject } from 'cloudflare:workers';

const PORT = 8080;
/** The container sleeps after this long without a message and starts again on the next one. */
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Runs relay/mixi2 (Node.js + mixi2-js) in a Cloudflare Container. mixi2-js
 * cannot run in the Worker itself: the mixi2 API is gRPC only, and its protobuf
 * library generates code at runtime, which Workers forbid.
 * The container is reached only through this Durable Object, never from the internet.
 */
export class Mixi2Relay extends DurableObject {
	// Set by DurableObject; declared here because this project has no Workers types.
	declare ctx: any;
	declare env: any;
	private starting: Promise<void> | undefined;

	async fetch(request: Request): Promise<Response> {
		// Share startup between concurrent requests.
		this.starting ??= this.start().finally(() => {
			this.starting = undefined;
		});
		await this.starting;
		return this.ctx.container.getTcpPort(PORT).fetch(new Request('http://container/', request));
	}

	private async start(): Promise<void> {
		const container = this.ctx.container;
		if (!container.running) {
			container.start({
				image: container.images.base,
				instance: 'lite',
				// mixi2's API is on the internet.
				enableInternet: true,
				env: {
					MIXI2_CLIENT_ID: this.env.MIXI2_CLIENT_ID ?? '',
					MIXI2_CLIENT_SECRET: this.env.MIXI2_CLIENT_SECRET ?? '',
					MIXI2_AUTH_KEY: this.env.MIXI2_AUTH_KEY ?? '',
					// Only this Durable Object can reach the container, so no token is needed.
					RELAY_INTERNAL: '1',
				},
			});
		}
		await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

		// `running` means startup was requested, not that the server is listening yet.
		const port = container.getTcpPort(PORT);
		for (let attempt = 0; attempt < 100; attempt++) {
			try {
				const response = await port.fetch('http://container/health', { signal: AbortSignal.timeout(1000) });
				await response.body?.cancel();
				if (response.ok) return;
			} catch {
				// Not listening yet.
			}
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
		throw new Error(`mixi2 relay container did not start listening on port ${PORT}`);
	}
}
