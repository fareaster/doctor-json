import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';
import { documentInsert } from '../src/doc/arrays.ts';

const parse = createDocument;

describe('insert', () => {
	test('insert at beginning of inline array', () => {
		const document = parse('{"items": [1, 2, 3]}');
		documentInsert(document, ['items'], 0, 0);
		expect(documentGet(document, ['items'])).toEqual([0, 1, 2, 3]);
	});

	test('insert at middle of inline array', () => {
		const document = parse('{"items": [1, 2, 3]}');
		documentInsert(document, ['items'], 1, 99);
		expect(documentGet(document, ['items'])).toEqual([1, 99, 2, 3]);
	});

	test('insert at end (same as push)', () => {
		const document = parse('{"items": [1, 2]}');
		documentInsert(document, ['items'], 2, 3);
		expect(documentGet(document, ['items'])).toEqual([1, 2, 3]);
	});

	test('insert into multiline array', () => {
		const input = '{\n  "items": [\n    1,\n    2,\n    3\n  ]\n}';
		const document = parse(input);
		documentInsert(document, ['items'], 1, 99);
		const expected = '{\n  "items": [\n    1,\n    99,\n    2,\n    3\n  ]\n}';
		expect(document.text).toBe(expected);
	});

	test('insert at beginning of multiline array', () => {
		const input = '{\n  "items": [\n    1,\n    2\n  ]\n}';
		const document = parse(input);
		documentInsert(document, ['items'], 0, 0);
		const result = document.text;
		const parsed = JSON.parse(result);
		expect(parsed.items).toEqual([0, 1, 2]);
		expect(result).toMatch(/^\s+0,$/m);
	});

	test('insert multiple values', () => {
		const document = parse('[1, 4]');
		documentInsert(document, [], 1, 2, 3);
		expect(documentGet(document, [])).toEqual([1, 2, 3, 4]);
	});

	test('insert on non-array is no-op', () => {
		const document = parse('{"a": "string"}');
		documentInsert(document, ['a'], 0, 1);
		expect(document.text).toBe('{"a": "string"}');
	});

	test('insert on non-existent path is no-op', () => {
		const document = parse('{"a": 1}');
		documentInsert(document, ['missing'], 0, 1);
		expect(document.text).toBe('{"a": 1}');
	});

	test('insert is chainable', () => {
		const document = parse('[1]');
		documentInsert(document, [], 0, 0);
		documentInsert(document, [], 2, 2);
		expect(documentGet(document, [])).toEqual([0, 1, 2]);
	});

	test('insert with out-of-bounds index clamps to end', () => {
		const document = parse('[1, 2]');
		documentInsert(document, [], 99, 3);
		expect(documentGet(document, [])).toEqual([1, 2, 3]);
	});

	test('insert with negative index clamps to 0', () => {
		const document = parse('[1, 2]');
		documentInsert(document, [], -5, 0);
		expect(documentGet(document, [])).toEqual([0, 1, 2]);
	});

	test('insert preserves inline formatting', () => {
		const document = parse('{"items":[1,2,3]}');
		documentInsert(document, ['items'], 1, 99);
		expect(document.text).toBe('{"items":[1,99,2,3]}');
	});

	test('insert into empty array', () => {
		const document = parse('{"items": []}');
		documentInsert(document, ['items'], 0, 1);
		expect(documentGet(document, ['items'])).toEqual([1]);
	});

	test('real-world: insert plugin at start', () => {
		const input = '{\n  "plugins": [\n    "existing-plugin"\n  ]\n}';
		const document = parse(input);
		documentInsert(document, ['plugins'], 0, 'new-first-plugin');
		const parsed = JSON.parse(document.text);
		expect(parsed.plugins[0]).toBe('new-first-plugin');
		expect(parsed.plugins[1]).toBe('existing-plugin');
	});
});
