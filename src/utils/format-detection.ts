import type {
	ObjectNode,
	ArrayNode,
	Node,
} from '@humanwhocodes/momoa';
import type { JsonValue, LocalIndent } from '../types.ts';

/**
 * Global fallback: detect indent from first indented line in text.
 * Only used when local detection fails (e.g. empty objects).
 *
 * Safe to run on raw JSON text: JSON strings cannot contain literal newline
 * bytes (0x0A) — the \n escape sequence is two characters (\, n), so the
 * regex won't match inside string values.
 */
export const detectIndent = (text: string): string => {
	const match = /\n([ \t]+)/.exec(text);
	if (!match) {
		return '';
	}
	const whitespace = match[1];
	if (whitespace[0] === '\t') {
		return '\t';
	}
	return whitespace;
};

/** Detect indentation from a specific object's existing members */
export const detectLocalIndent = (
	node: ObjectNode | ArrayNode,
	text: string,
	fallbackIndent: string,
): LocalIndent | null => {
	const members = node.type === 'Object' ? node.members : node.elements;

	if (members.length > 0) {
		const firstMember = members[0];
		const nlBefore = text.lastIndexOf('\n', firstMember.loc.start.offset - 1);
		if (nlBefore === -1) {
			return null; // inline
		}

		const memberIndent = text.slice(nlBefore + 1, firstMember.loc.start.offset);

		// Derive indent unit from difference between member indent and closing brace indent
		const closingOffset = node.loc.end.offset - 1;
		const nlBeforeClose = text.lastIndexOf('\n', closingOffset - 1);
		const braceIndent = nlBeforeClose === -1 ? '' : text.slice(nlBeforeClose + 1, closingOffset);
		const indentUnit = memberIndent.slice(braceIndent.length) || fallbackIndent;

		return {
			memberIndent,
			indentUnit,
		};
	}

	// Empty multiline object - derive from closing brace + fallback indent
	const closingOffset = node.loc.end.offset - 1;
	const nlBeforeClose = text.lastIndexOf('\n', closingOffset - 1);
	if (nlBeforeClose === -1 || !fallbackIndent) {
		return null;
	}
	const braceIndent = text.slice(nlBeforeClose + 1, closingOffset);
	return {
		memberIndent: braceIndent + fallbackIndent,
		indentUnit: fallbackIndent,
	};
};

export const detectEol = (text: string): string => (text.includes('\r\n') ? '\r\n' : '\n');

export const getColonSeparator = (
	object: ObjectNode,
	text: string,
	fallbackIndent: string,
): string => {
	if (object.members.length === 0) {
		return fallbackIndent ? ': ' : ':';
	}
	const member = object.members[0];
	const between = text.slice(member.name.loc.end.offset, member.value.loc.start.offset);
	// Find structural colon, skipping comments
	let i = 0;
	while (i < between.length) {
		if (between[i] === '/' && between[i + 1] === '*') {
			const end = between.indexOf('*/', i + 2);
			i = end === -1 ? between.length : end + 2;
		} else if (between[i] === '/' && between[i + 1] === '/') {
			const end = between.indexOf('\n', i + 2);
			i = end === -1 ? between.length : end + 1;
		} else if (between[i] === ':') {
			return between[i + 1] === ' ' ? ': ' : ':';
		} else {
			i += 1;
		}
	}
	return ': ';
};

export const isNodeInline = (node: Node, text: string): boolean => {
	const nodeText = text.slice(node.loc.start.offset, node.loc.end.offset);
	return !nodeText.includes('\n');
};

/**
 * Check if a new value should be serialized inline based on sibling values.
 * Works for both object members and array elements.
 */
export const shouldSerializeValueInline = (
	container: ObjectNode | ArrayNode,
	value: JsonValue,
	text: string,
): boolean => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const isArray = Array.isArray(value);
	const children = container.type === 'Object' ? container.members : container.elements;
	for (const child of children) {
		if (!child) { continue; }
		const childValue = child.value;
		const matchesType = isArray
			? childValue.type === 'Array'
			: childValue.type === 'Object';
		if (matchesType) {
			return isNodeInline(childValue, text);
		}
	}
	return false;
};
