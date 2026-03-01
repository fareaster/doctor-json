import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentRemove } from '../src/doc/remove.ts';

const parse = createDocument;

describe('trailing commas (JSONC)', () => {
	test('parse and preserve trailing comma in object', () => {
		const input = '{"a": 1, "b": 2,}';
		const document = parse(input);
		expect(documentGet(document, ['a'])).toBe(1);
		expect(documentGet(document, ['b'])).toBe(2);
	});

	test('parse and preserve trailing comma in array', () => {
		const input = '{"items": [1, 2, 3,]}';
		const document = parse(input);
		expect(documentGet(document, ['items', 0])).toBe(1);
		expect(documentGet(document, ['items', 2])).toBe(3);
	});

	test('update value in object with trailing comma', () => {
		const input = '{"a": 1, "b": 2,}';
		const document = parse(input);
		documentSet(document, ['a'], 10);
		expect(document.text).toBe('{"a": 10, "b": 2,}');
	});

	test('remove only property from object with trailing comma (minified)', () => {
		const input = '{"a": 1,}';
		const document = parse(input);
		documentRemove(document, ['a']);
		expect(document.text).toBe('{}');
	});

	test('remove last property from object with trailing comma (formatted)', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2,',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['b']);
		const result = document.text;
		expect(result).toContain('"a": 1');
		expect(result).not.toContain('"b"');
	});

	test('remove first property from object with trailing comma (formatted)', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2,',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['a']);
		const result = document.text;
		expect(result).not.toContain('"a"');
		expect(result).toContain('"b": 2');
	});

	test('add property to object that already has trailing comma (formatted)', () => {
		const input = [
			'{',
			'  "a": 1,',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['b'], 2);
		const result = document.text;
		expect(result).toContain('"a": 1');
		expect(result).toContain('"b": 2');
		// Result should be valid JSONC
		const document2 = parse(result);
		expect(documentGet(document2, ['a'])).toBe(1);
		expect(documentGet(document2, ['b'])).toBe(2);
	});

	test('multiple trailing commas in nested structure', () => {
		const input = [
			'{',
			'  "obj": {',
			'    "x": 1,',
			'    "y": 2,',
			'  },',
			'  "arr": [',
			'    "a",',
			'    "b",',
			'  ],',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['obj', 'x'], 10);
		const result = document.text;
		expect(result).toContain('"x": 10');
		expect(result).toContain('"y": 2');
		// Re-parse should work
		const document2 = parse(result);
		expect(documentGet(document2, ['obj', 'x'])).toBe(10);
		expect(documentGet(document2, ['arr', 0])).toBe('a');
	});
});
