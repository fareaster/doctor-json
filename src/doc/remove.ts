import type {
	ObjectNode,
	ArrayNode,
	Token,
} from '@humanwhocodes/momoa';
import type { MemberRange } from '../types.ts';
import { getMemberRanges } from '../utils/member-ranges.ts';
import { getMemberName, findNodeAtPath, findObjectAtPath } from '../utils/navigate.ts';
import type { Document } from './types.ts';

/**
 * Shared removal logic for both objects and arrays, using getMemberRanges
 * for accurate boundary detection including associated comments.
 */
const removeByRanges = (
	document: Document,
	ranges: MemberRange[],
	index: number,
	container: ObjectNode | ArrayNode,
): void => {
	const range = ranges[index];
	const isOnly = ranges.length === 1;
	const isLast = index === ranges.length - 1;

	if (isOnly) {
		const hasContainerHeader = range.start > container.loc.start.offset + 1;
		if (hasContainerHeader) {
			// Preserve the container header (text between { and range.start)
			// Trim trailing whitespace from the header to avoid dangling indent
			let headerEnd = range.start;
			while (headerEnd > container.loc.start.offset + 1 && ' \t'.includes(document.text[headerEnd - 1])) {
				headerEnd -= 1;
			}
			const afterComma = range.commaOffset === null ? 0 : range.commaOffset + 1;
			const removeEnd = Math.max(afterComma, range.end);
			document.text = document.text.slice(0, headerEnd)
				+ document.text.slice(removeEnd, container.loc.end.offset - 1)
				+ document.text.slice(container.loc.end.offset - 1);
		} else {
			// No header — collapse to empty braces
			document.text = document.text.slice(0, container.loc.start.offset + 1)
				+ document.text.slice(container.loc.end.offset - 1);
		}
		return;
	}

	if (isLast) {
		// Remove from previous member's comma to this range's full end,
		// using Math.max to handle trailing comments after the comma
		const previousRange = ranges[index - 1];
		const removeStart = previousRange.commaOffset ?? range.start;
		const afterComma = range.commaOffset === null ? 0 : range.commaOffset + 1;
		const removeEnd = Math.max(afterComma, range.end);
		document.text = document.text.slice(0, removeStart) + document.text.slice(removeEnd);
	} else {
		// First or middle: remove from this range's start to next range's start
		const nextRange = ranges[index + 1];
		let resumeOffset = nextRange.start;

		// For first member of inline containers, skip whitespace after the
		// comma so there's no leading space between the opening brace and
		// the next member: `{ "b"` → `{"b"`
		if (index === 0 && !document.text.slice(container.loc.start.offset, container.loc.end.offset).includes('\n')) {
			while (resumeOffset < container.loc.end.offset && document.text[resumeOffset] === ' ') {
				resumeOffset += 1;
			}
		}

		document.text = document.text.slice(0, range.start) + document.text.slice(resumeOffset);
	}
};

/**
 * Remove a member from an object using getMemberRanges for accurate
 * boundary detection, including associated leading/trailing comments.
 */
const removeMember = (
	document: Document,
	object: ObjectNode,
	memberIndex: number,
	tokens: Token[],
): void => {
	const ranges = getMemberRanges(object, document.text, tokens);
	removeByRanges(document, ranges, memberIndex, object);
};

const removeArrayElement = (
	document: Document,
	array: ArrayNode,
	index: number,
	tokens: Token[],
): void => {
	if (!array.elements[index]) {
		return;
	}

	const ranges = getMemberRanges(array, document.text, tokens);
	removeByRanges(document, ranges, index, array);
};

export const documentRemove = (document: Document, path: readonly (string | number)[]): void => {
	if (path.length === 0) {
		return;
	}

	const { ast } = document;
	const parentPath = path.slice(0, -1);
	const key = path.at(-1);

	if (typeof key === 'number') {
		const parentResult = parentPath.length === 0
			? { node: ast.body }
			: findNodeAtPath(ast, parentPath);
		if (!parentResult || parentResult.node.type !== 'Array') {
			return;
		}
		removeArrayElement(document, parentResult.node, key, ast.tokens!);
		return;
	}

	const parentObject = parentPath.length === 0
		? (ast.body.type === 'Object' ? ast.body : undefined)
		: findObjectAtPath(ast, parentPath);

	if (!parentObject) {
		return;
	}

	// Use findLastIndex to match JSON.parse last-key-wins for duplicate keys
	const memberIndex = parentObject.members.findLastIndex(m => getMemberName(m) === key);

	if (memberIndex === -1) {
		return;
	}

	removeMember(document, parentObject, memberIndex, ast.tokens!);
};
