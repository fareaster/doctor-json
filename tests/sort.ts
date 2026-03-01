import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentSort } from '../src/doc/sort.ts';

const parse = createDocument;

describe('sort', () => {
	test('sort object keys alphabetically', () => {
		const document = parse('{"c": 3, "a": 1, "b": 2}');
		documentSort(document);
		expect(document.text).toBe('{"a": 1, "b": 2, "c": 3}');
	});

	test('sort formatted object', () => {
		const input = '{\n  "c": 3,\n  "a": 1,\n  "b": 2\n}';
		const document = parse(input);
		documentSort(document);
		const expected = '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}';
		expect(document.text).toBe(expected);
	});

	test('sort nested object by path', () => {
		const input = '{\n  "deps": {\n    "zod": "^3",\n    "axios": "^1"\n  }\n}';
		const document = parse(input);
		documentSort(document, ['deps']);
		expect(document.text).toContain('"axios": "^1"');
		const parsed = JSON.parse(document.text);
		const keys = Object.keys(parsed.deps);
		expect(keys).toEqual(['axios', 'zod']);
	});

	test('sort preserves trailing comma style', () => {
		const input = '{\n  "b": 2,\n  "a": 1,\n}';
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		expect(result).toMatch(/"a": 1,/);
		expect(result).toMatch(/"b": 2,/);
	});

	test('already sorted is no-op', () => {
		const input = '{\n  "a": 1,\n  "b": 2\n}';
		const document = parse(input);
		documentSort(document);
		expect(document.text).toBe(input);
	});

	test('sort is chainable', () => {
		const document = parse('{"b": 2, "a": 1}');
		documentSort(document);
		expect(document.text).toBe('{"a": 1, "b": 2}');
	});

	test('sort single member is no-op', () => {
		const input = '{"a": 1}';
		const document = parse(input);
		documentSort(document);
		expect(document.text).toBe(input);
	});

	test('sort empty object is no-op', () => {
		const document = parse('{}');
		documentSort(document);
		expect(document.text).toBe('{}');
	});

	test('sort on non-existent path is no-op', () => {
		const input = '{"a": 1}';
		const document = parse(input);
		documentSort(document, ['missing']);
		expect(document.text).toBe(input);
	});

	test('sort with array path', () => {
		const input = '{"outer": {"b": 2, "a": 1}}';
		const document = parse(input);
		documentSort(document, ['outer']);
		expect(document.text).toBe('{"outer": {"a": 1, "b": 2}}');
	});

	test('trailing inline comment moves with member', () => {
		const input = '{\n  "b": 2, // about b\n  "a": 1 // about a\n}';
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		// Comments travel with their members. The comma stays with the slot
		// position (zipper model), so "a" gets the comma (slot 0 had one).
		expect(result).toContain('// about a');
		expect(result).toContain('// about b');
		expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"b"'));
		// Valid when comments stripped
		const stripped = result.replaceAll(/\s*\/\/.*$/gm, '');
		expect(() => JSON.parse(stripped)).not.toThrow();
	});

	test('leading comment moves with member', () => {
		const input = '{\n  // about b\n  "b": 2,\n  // about a\n  "a": 1\n}';
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		const aPos = result.indexOf('"a"');
		const bPos = result.indexOf('"b"');
		expect(aPos).toBeLessThan(bPos);
		expect(result.indexOf('// about a')).toBeLessThan(aPos);
	});

	test('container header stays pinned during sort', () => {
		const input = '{\n  // DO NOT EDIT\n\n  "z": 1,\n  "a": 2\n}';
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		expect(result.indexOf('DO NOT EDIT')).toBeLessThan(result.indexOf('"a"'));
		expect(result.indexOf('DO NOT EDIT')).toBeLessThan(result.indexOf('"z"'));
	});

	test('block comment between key and value stays with member', () => {
		const input = '{"b": /* important */ 2, "a": 1}';
		const document = parse(input);
		documentSort(document);
		expect(document.text).toContain('"b": /* important */ 2');
	});

	test('sort groups: blank line prevents cross-group sorting', () => {
		const input = [
			'{',
			'  "c": 3,',
			'  "a": 1,',
			'',
			'  "z": 26,',
			'  "m": 13',
			'}',
		].join('\n');
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		const parsed = JSON.parse(result);
		const keys = Object.keys(parsed);
		// Group 1 sorted: a, c. Group 2 sorted: m, z. Groups don't mix.
		expect(keys).toEqual(['a', 'c', 'm', 'z']);
	});

	test('sort groups: section header stays with its group', () => {
		const input = [
			'{',
			'  "b": 1,',
			'  "a": 2,',
			'',
			'  // --- Section 2 ---',
			'  "d": 4,',
			'  "c": 3',
			'}',
		].join('\n');
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		// Group 1: a, b (sorted). Group 2: c, d (sorted). Section header stays with group 2.
		expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"b"'));
		expect(result.indexOf('"c"')).toBeLessThan(result.indexOf('"d"'));
		expect(result.indexOf('Section 2')).toBeLessThan(result.indexOf('"c"'));
		// Groups don't mix
		expect(result.indexOf('"b"')).toBeLessThan(result.indexOf('"c"'));
	});

	test('sort groups: single-member groups are no-ops', () => {
		const input = [
			'{',
			'  "b": 1,',
			'',
			'  "a": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentSort(document);
		// Each group has 1 member, nothing to sort within groups
		expect(document.text).toBe(input);
	});

	test('multiline block comment above member moves with it', () => {
		const input = [
			'{',
			'  /**',
			'   * B docs',
			'   */',
			'  "b": 2,',
			'  "a": 1',
			'}',
		].join('\n');
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		// "a" should come first, then "b" with its block comment
		const aPos = result.indexOf('"a"');
		const bPos = result.indexOf('"b"');
		expect(aPos).toBeLessThan(bPos);
		expect(result).toContain('B docs');
	});

	test('custom comparator receives key and value', () => {
		const input = '{"b": 1, "a": 2}';
		const document = parse(input);
		// Sort by value descending
		documentSort(document, [], (a, b) => (b.value as number) - (a.value as number));
		expect(document.text).toBe('{"a": 2, "b": 1}');
	});

	test('sort nested path with comparator', () => {
		const input = '{\n  "deps": {"zod": "3.0", "axios": "1.0"}\n}';
		const document = parse(input);
		documentSort(document, ['deps']);
		const keys = Object.keys(JSON.parse(document.text).deps);
		expect(keys).toEqual(['axios', 'zod']);
	});

	test('sort by key explicitly', () => {
		const input = '{"z": 1, "m": 2, "a": 3}';
		const document = parse(input);
		documentSort(document, [], (a, b) => {
			const ak = String(a.key);
			const bk = String(b.key);
			return ak < bk ? -1 : (ak > bk ? 1 : 0);
		});
		expect(document.text).toBe('{"a": 3, "m": 2, "z": 1}');
	});

	test('sort by value for reverse alphabetical', () => {
		const input = '{"a": "z-last", "b": "a-first", "c": "m-middle"}';
		const document = parse(input);
		documentSort(document, [], (a, b) => {
			const av = String(a.value);
			const bv = String(b.value);
			return av < bv ? -1 : (av > bv ? 1 : 0);
		});
		const keys = Object.keys(JSON.parse(document.text));
		expect(keys).toEqual(['b', 'c', 'a']);
	});

	test('real-world: sort package.json dependencies', () => {
		const input = [
			'{',
			'  "dependencies": {',
			'    "zod": "^3.0.0",',
			'    "axios": "^1.0.0",',
			'    "lodash": "^4.0.0"',
			'  }',
			'}',
		].join('\n');
		const document = parse(input);
		documentSort(document, ['dependencies']);
		const result = document.text;
		const keys = Object.keys(JSON.parse(result).dependencies);
		expect(keys).toEqual(['axios', 'lodash', 'zod']);
		// Indentation preserved
		expect(result).toMatch(/^ {4}"axios"/m);
	});

	test('real-world: sort tsconfig compilerOptions with comments', () => {
		const input = [
			'{',
			'  "compilerOptions": {',
			'    // Output',
			'    "target": "ES2022",',
			'    // Modules',
			'    "module": "ESNext",',
			'    // Strictness',
			'    "strict": true',
			'  }',
			'}',
		].join('\n');
		const document = parse(input);
		documentSort(document, ['compilerOptions']);
		const result = document.text;
		const stripped = result.replaceAll(/\s*\/\/.*$/gm, '');
		const keys = Object.keys(JSON.parse(stripped).compilerOptions);
		expect(keys).toEqual(['module', 'strict', 'target']);
		// Comments travel with their members
		expect(result).toContain('// Modules');
		expect(result).toContain('// Strictness');
		expect(result).toContain('// Output');
	});

	test('sort then set', () => {
		const document = parse('{"b": 2, "a": 1}');
		documentSort(document);
		documentSet(document, ['c'], 3);
		const parsed = JSON.parse(document.text);
		expect(Object.keys(parsed)).toEqual(['a', 'b', 'c']);
	});

	test('set then sort', () => {
		const document = parse('{"c": 3, "a": 1}');
		documentSet(document, ['b'], 2);
		documentSort(document);
		const parsed = JSON.parse(document.text);
		expect(Object.keys(parsed)).toEqual(['a', 'b', 'c']);
	});

	test('sort with comma before trailing inline comment', () => {
		const input = '{\n  "b": 2, // about b\n  "a": 1\n}';
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		// "a" should come first, "b" second with its comment
		expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"b"'));
		expect(result).toContain('// about b');
		// Must be valid JSON when comments are stripped
		const stripped = result.replaceAll(/\s*\/\/.*$/gm, '');
		expect(() => JSON.parse(stripped)).not.toThrow();
	});

	test('container header preserved with CRLF line endings', () => {
		const input = '{\r\n  // DO NOT EDIT\r\n\r\n  "z": 1,\r\n  "a": 2\r\n}';
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		expect(result.indexOf('DO NOT EDIT')).toBeLessThan(result.indexOf('"a"'));
	});

	test('leading comments travel with member during sort (3 members)', () => {
		const input = [
			'{',
			'  // lead c',
			'  "c": 3, // trail c',
			'  // lead a',
			'  "a": 1, // trail a',
			'  // lead b',
			'  "b": 2 // trail b',
			'}',
		].join('\n');
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		// Each leading comment should be above its member after sort
		const leadA = result.indexOf('// lead a');
		const keyA = result.indexOf('"a"');
		const leadB = result.indexOf('// lead b');
		const keyB = result.indexOf('"b"');
		const leadC = result.indexOf('// lead c');
		const keyC = result.indexOf('"c"');
		expect(leadA).toBeLessThan(keyA);
		expect(leadB).toBeLessThan(keyB);
		expect(leadC).toBeLessThan(keyC);
		// And the overall order is a, b, c
		expect(keyA).toBeLessThan(keyB);
		expect(keyB).toBeLessThan(keyC);
	});

	test('sort preserves surrounding content', () => {
		const input = [
			'// file header',
			'{',
			'  "b": 2,',
			'  "a": 1',
			'}',
		].join('\n');
		const document = parse(input);
		documentSort(document);
		const result = document.text;
		expect(result).toContain('// file header');
		expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"b"'));
	});

	test('sort root array with custom value comparator', () => {
		const document = parse('[3, 1, 2]');
		documentSort(document, [], (a, b) => (a.value as number) - (b.value as number));
		expect(document.text).toBe('[1, 2, 3]');
	});

	test('sort(comparator) for root sort', () => {
		const document = parse('{"b": 2, "a": 1}');
		documentSort(
			document,
			(a, b) => (
				(a.key as string) > (b.key as string)
					? -1
					: ((a.key as string) < (b.key as string) ? 1 : 0)
			),
		);
		expect(Object.keys(JSON.parse(document.text))).toEqual(['b', 'a']);
	});

	test('default sort on string array sorts alphabetically', () => {
		const document = parse('["banana", "apple", "cherry"]');
		documentSort(document);
		expect(documentGet(document, [])).toEqual(['apple', 'banana', 'cherry']);
	});

	test('default sort on number array sorts numerically', () => {
		const document = parse('[3, 1, 2, 10]');
		documentSort(document);
		expect(documentGet(document, [])).toEqual([1, 2, 3, 10]);
	});

	test('default sort on mixed-type array is no-op', () => {
		const input = '[1, "two", true]';
		const document = parse(input);
		documentSort(document);
		expect(document.text).toBe(input);
	});

	test('default sort on nested string array', () => {
		const document = parse('{"keywords": ["c", "a", "b"]}');
		documentSort(document, ['keywords']);
		expect(documentGet(document, ['keywords'])).toEqual(['a', 'b', 'c']);
	});
});
