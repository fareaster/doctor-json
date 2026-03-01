import type {
	DocumentNode,
	ObjectNode,
	ArrayNode,
} from '@humanwhocodes/momoa';
import type { JsonValue } from '../types.ts';
import { serializeValue } from '../utils/serialize.ts';
import {
	detectIndent,
	detectLocalIndent,
	detectEol,
	getColonSeparator,
	isNodeInline,
	shouldSerializeValueInline,
} from '../utils/format-detection.ts';
import { getMemberName, findNodeAtPath, findObjectAtPath } from '../utils/navigate.ts';
import type { Document } from './types.ts';
import { insertIntoEmptyContainer, appendAfterLast, detectColonSeparator } from './helpers.ts';

const insertMember = (
	document: Document,
	object: ObjectNode,
	key: string,
	value: JsonValue,
	globalIndent: string,
): void => {
	const objectIsInline = isNodeInline(object, document.text);
	const colonSeparator = getColonSeparator(object, document.text, globalIndent);
	const hasMembers = object.members.length > 0;

	if (objectIsInline) {
		// Inline insertion
		const serializedValue = serializeValue(value, '', '', colonSeparator);
		const newMember = `${JSON.stringify(key)}${colonSeparator}${serializedValue}`;

		if (hasMembers) {
			// Detect member separator from existing members
			let memberSeparator = colonSeparator === ': ' ? ' ' : '';
			if (object.members.length >= 2) {
				const firstEnd = object.members[0].loc.end.offset;
				const secondStart = object.members[1].loc.start.offset;
				const between = document.text.slice(firstEnd, secondStart);
				const commaIndex = between.indexOf(',');
				if (commaIndex !== -1) {
					memberSeparator = between[commaIndex + 1] === ' ' ? ' ' : '';
				}
			}
			appendAfterLast(document, object, document.ast.tokens!, newMember, memberSeparator);
		} else {
			const closingBrace = object.loc.end.offset - 1;
			document.text = document.text.slice(0, closingBrace)
				+ newMember
				+ document.text.slice(closingBrace);
		}
		return;
	}

	// Multiline insertion - detect indent locally from target object
	const eol = detectEol(document.text);
	const local = detectLocalIndent(object, document.text, globalIndent);
	const memberIndent = local?.memberIndent ?? globalIndent;
	const indentUnit = local?.indentUnit ?? globalIndent;

	// Determine how to serialize the value
	const valueInline = shouldSerializeValueInline(object, value, document.text);
	const serializedValue = valueInline
		? serializeValue(value, '', '', colonSeparator, eol)
		: serializeValue(value, memberIndent, indentUnit, colonSeparator, eol);

	const newMember = `${memberIndent}${JSON.stringify(key)}${colonSeparator}${serializedValue}`;

	if (hasMembers) {
		appendAfterLast(document, object, document.ast.tokens!, newMember, eol);
	} else {
		insertIntoEmptyContainer(document, object.loc.end.offset - 1, newMember, eol);
	}
};

const insertAtPath = (
	document: Document,
	segments: readonly (string | number)[],
	value: JsonValue,
	globalIndent: string,
	ast: DocumentNode,
): void => {
	// Find the deepest existing object along the path
	let deepestExistingDepth = 0;

	for (let i = segments.length - 1; i >= 0; i -= 1) {
		const parentPath = segments.slice(0, i);
		const parentNode = parentPath.length === 0
			? (ast.body.type === 'Object' ? ast.body : undefined)
			: findObjectAtPath(ast, parentPath);
		if (parentNode) {
			deepestExistingDepth = i;
			break;
		}
	}

	// Build the value with nested objects for missing intermediate segments
	// Note: only string segments (object keys) are supported for intermediate
	// path creation. Number segments (array indices) in intermediate positions
	// are not supported — we only handle object property insertion.
	let builtValue: JsonValue = value;
	for (let i = segments.length - 1; i > deepestExistingDepth; i -= 1) {
		const segment = segments[i];
		if (typeof segment === 'string') {
			builtValue = { [segment]: builtValue };
		} else {
			// Number segment in intermediate position means we'd need to
			// create an array, which is unsupported — bail out entirely.
			return;
		}
	}

	const key = segments[deepestExistingDepth];
	if (typeof key !== 'string') {
		// Cannot insert into arrays — array insertion is not supported
		return;
	}

	const parentPath = segments.slice(0, deepestExistingDepth);
	const parentObject = parentPath.length === 0
		? (ast.body.type === 'Object' ? ast.body : undefined)
		: findObjectAtPath(ast, parentPath);

	if (!parentObject) {
		return;
	}

	// Don't insert if the key already exists (would create duplicate keys).
	// This happens when the path traversal hit a type mismatch (e.g. trying
	// to set a string key on an array node), causing fallback to a parent
	// that already has this key with a different-typed value.
	const keyExists = parentObject.members.some(m => getMemberName(m) === key);
	if (keyExists) {
		return;
	}

	insertMember(document, parentObject, key, builtValue, globalIndent);
};

export const documentSet = (
	document: Document,
	path: readonly (string | number)[],
	value: JsonValue,
): void => {
	if (path.length === 0) {
		return;
	}

	const { ast } = document;
	const globalIndent = detectIndent(document.text);
	const eol = detectEol(document.text);

	// Try to find the existing node to update
	const existing = findNodeAtPath(ast, path);
	if (existing?.parent && (existing.parent.type === 'Member' || existing.parent.type === 'Element')) {
		const valueNode = existing.node;
		const start = valueNode.loc.start.offset;
		const end = valueNode.loc.end.offset;

		const colonSeparator = detectColonSeparator(document, ast, path, globalIndent);

		// Determine serialization format from existing value
		const oldIsInline = isNodeInline(valueNode, document.text);
		if (oldIsInline) {
			const serialized = serializeValue(value, '', '', colonSeparator, eol);
			document.text = document.text.slice(0, start) + serialized + document.text.slice(end);
		} else {
			// Detect indent from the old value's structure
			const isContainer = valueNode.type === 'Object' || valueNode.type === 'Array';
			const local = isContainer
				? detectLocalIndent(
					valueNode as ObjectNode | ArrayNode,
					document.text,
					globalIndent,
				)
				: null;
			const baseIndent = local
				? local.memberIndent.slice(0, local.memberIndent.length - local.indentUnit.length)
				: '';
			const indentUnit = local?.indentUnit ?? globalIndent;
			const serialized = serializeValue(value, baseIndent, indentUnit, colonSeparator, eol);
			document.text = document.text.slice(0, start) + serialized + document.text.slice(end);
		}
		return;
	}

	// Need to insert a new property
	insertAtPath(document, path, value, globalIndent, ast);
};
