import type { JsonValue } from '../types.ts';

/**
 * Serialize a JS value to a JSON string with custom formatting.
 * Delegates to JSON.stringify for coercion and base serialization.
 * Only adds custom formatting (base indent, colon separator, EOL) on top.
 *
 * @param baseIndent - Absolute indentation for the closing brace/bracket
 * @param indentUnit - One level of indentation (empty string = inline)
 */

export const serializeValue = (
	value: JsonValue,
	baseIndent: string,
	indentUnit: string,
	colonSeparator = indentUnit ? ': ' : ':',
	eol = '\n',
): string => {
	// JSON.stringify handles all coercion: toJSON(), undefined→omit,
	// BigInt→throw, circular→throw, Date→string, etc.
	// Returns undefined for undefined/function/symbol — substitute null
	// (matches JSON.stringify([undefined]) → [null])
	const json = JSON.stringify(value) ?? 'null';

	// Inline compact — JSON.stringify is the complete answer
	if (!indentUnit && colonSeparator === ':') {
		return json;
	}

	// Multiline — JSON.stringify with indent, post-process for base indent + EOL
	if (indentUnit && colonSeparator === ': ') {
		let result = JSON.stringify(
			JSON.parse(json),
			null,
			indentUnit,
		);
		if (baseIndent) {
			result = result.replaceAll('\n', `\n${baseIndent}`);
		}
		if (eol !== '\n') {
			result = result.replaceAll('\n', eol);
		}
		return result;
	}

	// Inline with spaced colons (e.g. {"a": 1}) — JSON.stringify can't
	// produce compact output with `: `, so we format manually
	const clean = JSON.parse(json) as JsonValue;
	return formatInlineSpaced(clean);
};

/**
 * Format a JSON-safe value as compact string with spaced colons.
 * Only needed for the `{"a": 1}` style that JSON.stringify can't produce.
 */
const formatInlineSpaced = (value: JsonValue): string => {
	if (typeof value !== 'object' || value === null) {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return '[]';
		}
		return `[${value.map(formatInlineSpaced).join(', ')}]`;
	}
	const entries = Object.entries(value);
	if (entries.length === 0) {
		return '{}';
	}
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${formatInlineSpaced(v)}`).join(', ')}}`;
};
