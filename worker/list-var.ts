/**
 * A list setting from env, in any of these forms:
 *   JSON type in the dashboard:  ["a", "b"]  (arrives already parsed, as an array)
 *   Text or Secret:              '["a", "b"]'  or  'a, b'  or  'a b'
 * `key` also accepts an object holding the list, such as {"address": ["a"]}
 * for `permittedAddresses` (the original format), as JSON or as text.
 * Throws when the value looks like JSON but is not valid.
 */
export function listVar(value: unknown, key?: string): string[] {
	if (value === undefined || value === null || value === '') return [];
	let parsed = value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!/^[[{]/.test(trimmed)) return trimmed.split(/[\s,]+/).filter(Boolean);
		parsed = JSON.parse(trimmed);
	}
	if (key && parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) parsed = (parsed as any)[key];
	if (!Array.isArray(parsed)) throw new Error(key ? `must be an array or {"${key}": [...]}` : 'must be an array');
	return parsed.map((item) => String(item).trim()).filter(Boolean);
}
