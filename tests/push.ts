import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';
import { documentPush } from '../src/doc/arrays.ts';

const parse = createDocument;

describe('push', () => {
	test('push to inline array', () => {
		const document = parse('{"items": [1, 2]}');
		documentPush(document, ['items'], 3);
		expect(document.text).toBe('{"items": [1, 2, 3]}');
	});

	test('push to multiline array', () => {
		const input = '{\n  "items": [\n    1,\n    2\n  ]\n}';
		const document = parse(input);
		documentPush(document, ['items'], 3);
		const expected = '{\n  "items": [\n    1,\n    2,\n    3\n  ]\n}';
		expect(document.text).toBe(expected);
	});

	test('push multiple values', () => {
		const document = parse('{"items": [1]}');
		documentPush(document, ['items'], 2, 3);
		expect(document.text).toBe('{"items": [1, 2, 3]}');
	});

	test('push to empty inline array', () => {
		const document = parse('{"items": []}');
		documentPush(document, ['items'], 1);
		expect(document.text).toBe('{"items": [1]}');
	});

	test('push to empty multiline array', () => {
		const input = '{\n  "items": [\n  ]\n}';
		const document = parse(input);
		documentPush(document, ['items'], 1);
		const result = document.text;
		expect(JSON.parse(result).items).toEqual([1]);
	});

	test('push preserves trailing comma style', () => {
		const input = '{\n  "items": [\n    1,\n    2,\n  ]\n}';
		const document = parse(input);
		documentPush(document, ['items'], 3);
		const result = document.text;
		expect(result).toContain('3,');
	});

	test('push to nested array', () => {
		const document = parse('{"config": {"tags": ["a", "b"]}}');
		documentPush(document, ['config', 'tags'], 'c');
		expect(document.text).toBe('{"config": {"tags": ["a", "b", "c"]}}');
	});

	test('push is chainable', () => {
		const document = parse('{"items": [1]}');
		documentPush(document, ['items'], 2);
		documentPush(document, ['items'], 3);
		expect(document.text).toBe('{"items": [1, 2, 3]}');
	});

	test('push creates array when path does not exist', () => {
		const document = parse('{"a": 1}');
		documentPush(document, ['items'], 'hello');
		expect(documentGet(document, ['items'])).toEqual(['hello']);
	});

	test('push creates array with multiple values', () => {
		const document = parse('{}');
		documentPush(document, ['tags'], 'a', 'b', 'c');
		expect(documentGet(document, ['tags'])).toEqual(['a', 'b', 'c']);
	});

	test('push does not create array if path exists as non-array', () => {
		const document = parse('{"items": "string"}');
		documentPush(document, ['items'], 1);
		expect(document.text).toBe('{"items": "string"}');
	});

	test('push on non-array is no-op', () => {
		const document = parse('{"a": "string"}');
		documentPush(document, ['a'], 1);
		expect(document.text).toBe('{"a": "string"}');
	});

	test('push object value to array', () => {
		const document = parse('{"items": [{"id": 1}]}');
		documentPush(document, ['items'], { id: 2 });
		const parsed = JSON.parse(document.text);
		expect(parsed.items).toEqual([{ id: 1 }, { id: 2 }]);
	});

	test('push preserves existing comments', () => {
		const input = '{\n  "items": [\n    // first\n    1,\n    2\n  ]\n}';
		const document = parse(input);
		documentPush(document, ['items'], 3);
		const result = document.text;
		expect(result).toContain('// first');
	});

	test('push then get returns updated array', () => {
		const document = parse('{"items": [1, 2]}');
		documentPush(document, ['items'], 3);
		expect(documentGet(document, ['items'])).toEqual([1, 2, 3]);
	});

	test('push with no values is no-op', () => {
		const document = parse('{"items": [1]}');
		documentPush(document, ['items']);
		expect(document.text).toBe('{"items": [1]}');
	});

	test('push preserves trailing comment on last element (trailing comma)', () => {
		const input = '[\n  1, // legacy ID\n]';
		const document = parse(input);
		documentPush(document, [], 2);
		const result = document.text;
		// Comment should stay with element 1, not move to element 2
		expect(result).toContain('1, // legacy ID');
		expect(result).not.toMatch(/2.*legacy/);
	});

	test('push does not inject comma inside line comment', () => {
		const input = '[\n  1 // legacy ID\n]';
		const document = parse(input);
		documentPush(document, [], 2);
		const result = document.text;
		// Comma should be after the value, not inside the comment
		expect(result).not.toContain('// legacy ID,');
		expect(result).toContain('1,');
	});

	test('push object matches inline sibling style in multiline array', () => {
		const input = '{\n  "items": [\n    {"a": 1},\n    {"b": 2}\n  ]\n}';
		const document = parse(input);
		documentPush(document, ['items'], { c: 3 });
		const result = document.text;
		// Sibling objects are inline, so the new one should be too
		expect(result).toContain('{"c": 3}');
		expect(result).not.toContain('"c": 3\n');
	});

	test('real-world: push to package.json keywords', () => {
		const input = [
			'{',
			'  "name": "my-app",',
			'  "keywords": [',
			'    "json",',
			'    "edit"',
			'  ]',
			'}',
		].join('\n');
		const document = parse(input);
		documentPush(document, ['keywords'], 'ast');
		const result = document.text;
		const parsed = JSON.parse(result);
		expect(parsed.keywords).toEqual(['json', 'edit', 'ast']);
		// Indentation preserved
		expect(result).toMatch(/^ {4}"ast"/m);
	});

	test('push does not create intermediate objects', () => {
		const document = parse('{"a": 1}');
		documentPush(document, ['missingParent', 'items'], 1);
		// Parent "missingParent" doesn't exist — should be no-op
		expect(document.text).toBe('{"a": 1}');
	});

	test('push creates leaf array only when parent exists', () => {
		const document = parse('{"config": {}}');
		documentPush(document, ['config', 'items'], 1);
		// Parent "config" exists — leaf array should be created
		expect(documentGet(document, ['config', 'items'])).toEqual([1]);
	});

	test('push to empty multiline array uses correct indent', () => {
		const document = parse('{\n  "arr": [\n  ]\n}');
		documentPush(document, ['arr'], 1);
		expect(document.text).toBe('{\n  "arr": [\n    1\n  ]\n}');
	});
});
