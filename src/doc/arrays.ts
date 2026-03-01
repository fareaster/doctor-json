import type {
	ArrayNode,
} from '@humanwhocodes/momoa';
import type { JsonValue } from '../types.ts';
import { serializeValue } from '../utils/serialize.ts';
import { getMemberRanges } from '../utils/member-ranges.ts';
import {
	detectIndent,
	detectEol,
	detectLocalIndent,
	isNodeInline,
	shouldSerializeValueInline,
} from '../utils/format-detection.ts';
import { findNodeAtPath } from '../utils/navigate.ts';
import type { Document } from './types.ts';
import {
	validateJsonValues,
	insertIntoEmptyContainer,
	appendAfterLast,
	detectColonSeparator,
	detectArraySeparator,
} from './helpers.ts';
import { documentSet } from './set.ts';

export const documentPush = (
	document: Document,
	path: readonly (string | number)[],
	...values: JsonValue[]
): void => {
	if (values.length === 0) {
		return;
	}

	// Resolve target array first
	{
		const { ast } = document;
		if (path.length === 0) {
			if (ast.body.type !== 'Array') {
				return;
			}
		} else {
			const result = findNodeAtPath(ast, path);
			if (result) {
				if (result.node.type !== 'Array') {
					return;
				}
			} else {
				if (path.length >= 2) {
					const parentPath = path.slice(0, -1);
					const parentResult = findNodeAtPath(ast, parentPath);
					if (!parentResult || parentResult.node.type !== 'Object') {
						return;
					}
				}
				validateJsonValues(values);
				documentSet(document, path, values);
				return;
			}
		}
	}

	validateJsonValues(values);

	// Batch: parse once, serialize all values, mutate once
	const { ast } = document;
	const globalIndent = detectIndent(document.text);

	let arrayNode: ArrayNode;
	if (path.length === 0) {
		arrayNode = ast.body as ArrayNode;
	} else {
		arrayNode = findNodeAtPath(ast, path)!.node as ArrayNode;
	}

	const inline = isNodeInline(arrayNode, document.text);
	const hasElements = arrayNode.elements.length > 0;
	const colonSeparator = detectColonSeparator(document, ast, path, globalIndent);

	if (inline) {
		const separator = detectArraySeparator(document, arrayNode, colonSeparator);
		const batchContent = values.map(v => serializeValue(v, '', '', colonSeparator)).join(separator);
		if (hasElements) {
			const gap = separator === ', ' ? ' ' : '';
			appendAfterLast(document, arrayNode, ast.tokens!, batchContent, gap);
		} else {
			const closingBracket = arrayNode.loc.end.offset - 1;
			document.text = document.text.slice(0, closingBracket)
				+ batchContent
				+ document.text.slice(closingBracket);
		}
	} else {
		const eol = detectEol(document.text);
		const local = detectLocalIndent(arrayNode, document.text, globalIndent);
		const memberIndent = local?.memberIndent ?? globalIndent;
		const indentUnit = local?.indentUnit ?? globalIndent;

		const batchContent = values.map((value) => {
			const valueInline = shouldSerializeValueInline(arrayNode, value, document.text);
			return valueInline
				? serializeValue(value, '', '', colonSeparator, eol)
				: serializeValue(value, memberIndent, indentUnit, colonSeparator, eol);
		}).join(`,${eol}${memberIndent}`);

		const newElementBlock = `${memberIndent}${batchContent}`;
		if (hasElements) {
			appendAfterLast(document, arrayNode, ast.tokens!, newElementBlock, eol);
		} else {
			insertIntoEmptyContainer(document, arrayNode.loc.end.offset - 1, newElementBlock, eol);
		}
	}
};

export const documentInsert = (
	document: Document,
	path: readonly (string | number)[],
	index: number,
	...values: JsonValue[]
): void => {
	if (values.length === 0) {
		return;
	}

	validateJsonValues(values);

	for (const value of values) {
		const { ast } = document;

		let arrayNode: ArrayNode;
		if (path.length === 0) {
			if (ast.body.type !== 'Array') {
				return;
			}
			arrayNode = ast.body;
		} else {
			const result = findNodeAtPath(ast, path);
			if (!result || result.node.type !== 'Array') {
				return;
			}
			arrayNode = result.node as ArrayNode;
		}

		const { length } = arrayNode.elements;
		const clampedIndex = Math.min(Math.max(0, index), length);

		if (clampedIndex === length) {
			documentPush(document, path, value);
			index += 1;
			continue;
		}

		const globalIndent = detectIndent(document.text);
		const inline = isNodeInline(arrayNode, document.text);
		const ranges = getMemberRanges(arrayNode, document.text, ast.tokens!);
		const targetRange = ranges[clampedIndex];

		const colonSeparator = detectColonSeparator(document, ast, path, globalIndent);

		if (inline) {
			const separator = detectArraySeparator(document, arrayNode, colonSeparator);
			const serialized = serializeValue(value, '', '', colonSeparator);
			document.text = document.text.slice(0, targetRange.start)
				+ serialized + separator
				+ document.text.slice(targetRange.start);
		} else {
			const eol = detectEol(document.text);
			const local = detectLocalIndent(arrayNode, document.text, globalIndent);
			const memberIndent = local?.memberIndent ?? globalIndent;
			const indentUnit = local?.indentUnit ?? globalIndent;
			const valueInline = shouldSerializeValueInline(arrayNode, value, document.text);
			const serialized = valueInline
				? serializeValue(value, '', '', colonSeparator, eol)
				: serializeValue(value, memberIndent, indentUnit, colonSeparator, eol);
			const newElement = `${memberIndent + serialized},`;
			document.text = document.text.slice(0, targetRange.start)
				+ eol + newElement
				+ document.text.slice(targetRange.start);
		}

		index += 1;
	}
};
