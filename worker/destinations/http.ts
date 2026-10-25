/** `value` as a base URL, without trailing slashes. */
export function baseUrl(value: unknown): string {
	return String(value).replace(/\/+$/, '');
}

export interface PostJsonOptions {
	/** Sent as `Authorization: Bearer <token>`. */
	token?: string;
	/** Prefixed to the error message, e.g. the XRPC method. */
	label?: string;
	/** The error detail in the service's response body (default: `data.error`). */
	detail?: (data: any) => unknown;
	/** Something with a fetch() other than the global one, e.g. a Durable Object stub. */
	fetcher?: { fetch(input: string, init?: RequestInit): Promise<Response> };
}

/**
 * POST `body` as JSON. Resolves with the parsed response, or {} when it is not
 * JSON; rejects with "<label>: HTTP <status> <detail>" when the response is not OK.
 */
export async function postJson(url: string, body: unknown, options: PostJsonOptions = {}): Promise<any> {
	const { token, label, detail = (data) => data.error, fetcher } = options;
	const init: RequestInit = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(body),
	};
	const response = await (fetcher ? fetcher.fetch(url, init) : fetch(url, init));
	const data: any = await response.json().catch(() => ({}));
	if (!response.ok) {
		const message = `HTTP ${response.status} ${detail(data) ?? ''}`.trim();
		throw new Error(label ? `${label}: ${message}` : message);
	}
	return data;
}
