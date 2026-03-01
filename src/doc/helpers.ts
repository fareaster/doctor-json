import type {
	DocumentNode,
	ObjectNode,
	ArrayNode,
	Token,
} from '@humanwhocodes/momoa';
import type { JsonValue } from '../types.ts';
import { serializeValue } from '../utils/serialize.ts';
import { getMemberRanges } from '../utils/member-ranges.ts';
import { getColonSeparator } from '../utils/format-detection.ts';
import { findObjectAtPath } from '../utils/navigate.ts';
import type { Document } from './types.ts';

export const validateJsonValues = (values: readonly JsonValue[]) => {
	for (const value of values) {
		serializeValue(value, '', '', ': ');
	}
};

/** Insert content into an empty multiline container (object or array) */
export const insertIntoEmptyContainer = (
	document: Document,
	closingOffset: number,
	newContent: string,
	eol: string,
) => {
	const nlBeforeClose = document.text.lastIndexOf('\n', closingOffset - 1);
	const baseIndent = nlBeforeClose === -1 ? '' : document.text.slice(nlBeforeClose + 1, closingOffset);
	const insertAt = nlBeforeClose === -1 ? closingOffset : nlBeforeClose + 1;
	document.text = document.text.slice(0, insertAt)
		+ newContent + eol + baseIndent
		+ document.text.slice(closingOffset);
};

/**
 * Append content after the last member of a container, handling trailing commas.
 * @param gap - separator: ' ' for inline, '\n' or eol for multiline
 */
export const appendAfterLast = (
	document: Document,
	container: ObjectNode | ArrayNode,
	tokens: Token[],
	content: string,
	gap: string,
) => {
	const ranges = getMemberRanges(container, document.text, tokens);
	const lastRange = ranges.at(-1)!;
	const valueEnd = lastRange.member.value.loc.end.offset;
	if (lastRange.commaOffset === null) {
		const afterValue = document.text.slice(valueEnd, lastRange.end);
		const tail = document.text.slice(lastRange.end);
		document.text = `${document.text.slice(0, valueEnd)},${afterValue}${gap}${content}${tail}`;
	} else {
		const insertAt = Math.max(lastRange.commaOffset + 1, lastRange.end);
		const before = document.text.slice(0, insertAt);
		const after = document.text.slice(insertAt);
		document.text = `${before}${gap}${content},${after}`;
	}
};

/** Detect colon separator from parent object */
export const detectColonSeparator = (
	document: Document,
	ast: DocumentNode,
	segments: readonly (string | number)[],
	globalIndent: string,
): string => {
	const parentPath = segments.slice(0, -1);
	const parentObject = parentPath.length === 0
		? (ast.body.type === 'Object' ? ast.body : undefined)
		: findObjectAtPath(ast, parentPath);
	return parentObject
		? getColonSeparator(parentObject, document.text, globalIndent)
		: (globalIndent ? ': ' : ':');
};

/** Detect inline separator style (", " vs ",") from existing array elements */
export const detectArraySeparator = (
	document: Document,
	arrayNode: ArrayNode,
	colonSeparator: string,
): string => {
	let separator = colonSeparator === ': ' ? ', ' : ',';
	if (arrayNode.elements.length >= 2) {
		const firstEnd = arrayNode.elements[0].value.loc.end.offset;
		const secondStart = arrayNode.elements[1].value.loc.start.offset;
		const gap = document.text.slice(firstEnd, secondStart);
		separator = gap.includes(' ') ? ', ' : ',';
	}
	return separator;
};
