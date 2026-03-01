import { describe, test, expect } from 'manten';
import type { JsonValue } from '../src/types.ts';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentRemove } from '../src/doc/remove.ts';
import { documentPush, documentInsert } from '../src/doc/arrays.ts';
import { documentSort } from '../src/doc/sort.ts';
import { documentRename } from '../src/doc/rename.ts';

const parse = createDocument;

describe('stress', () => {
	// --- Comments containing JSON-like syntax ---

	test('comment containing fake JSON object', () => {
		const document = parse('{\n  // {"fake": 999, "keys": true}\n  "real": 1\n}');
		documentSet(document, ['real'], 2);
		expect(document.text).toContain('"real": 2');
		expect(document.text).toContain('fake');
	});

	test('comment containing array with commas', () => {
		const document = parse('{\n  "a": 1 /* [1, 2, 3] */\n}');
		documentRemove(document, ['a']);
		expect(document.text).toBe('{}');
	});

	test('block comment containing closing brace', () => {
		const document = parse('{\n  "a": 1 /* } */,\n  "b": 2\n}');
		documentRemove(document, ['a']);
		expect(document.text).toContain('"b": 2');
		expect(documentGet(document, ['b'])).toBe(2);
	});

	test('block comment containing colon and comma', () => {
		const document = parse('{"a": /* "key": "val", */ 1, "b": 2}');
		documentSort(document);
		expect(documentGet(document, ['a'])).toBe(1);
		expect(documentGet(document, ['b'])).toBe(2);
	});

	// --- Consecutive and nested comments ---

	test('many consecutive block comments between members', () => {
		const document = parse('{\n  "b": 2, /* c1 */ /* c2 */ /* c3 */\n  "a": 1\n}');
		documentSort(document);
		const result = document.text;
		expect(result).toContain('c1');
		expect(result).toContain('c2');
		expect(result).toContain('c3');
		expect(documentGet(document, ['a'])).toBe(1);
		expect(documentGet(document, ['b'])).toBe(2);
	});

	test('line comment immediately followed by block comment', () => {
		const document = parse('{\n  "a": 1, // line\n  /* block */\n  "b": 2\n}');
		documentSort(document);
		const result = document.text;
		expect(result).toContain('// line');
		expect(result).toContain('/* block */');
	});

	// --- Empty and minimal documents ---

	test('empty object: set then remove then set', () => {
		const document = parse('{}');
		documentSet(document, ['a'], 1);
		documentRemove(document, ['a']);
		documentSet(document, ['b'], 2);
		expect(JSON.parse(document.text)).toEqual({ b: 2 });
	});

	test('empty array: push then remove then push', () => {
		const document = parse('[]');
		documentPush(document, [], 1);
		documentRemove(document, [0]);
		documentPush(document, [], 2);
		expect(documentGet(document, [])).toEqual([2]);
	});

	test('single character key and value', () => {
		const document = parse('{"x":0}');
		documentSet(document, ['x'], 1);
		expect(document.text).toBe('{"x":1}');
	});

	// --- Deep nesting ---

	test('10 levels of nesting: set at leaf', () => {
		const input = '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":{"j":1}}}}}}}}}}';
		const document = parse(input);
		documentSet(document, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 2);
		expect(documentGet(document, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])).toBe(2);
	});

	test('sort at deeply nested path', () => {
		const document = parse('{"a":{"b":{"c":{"z":1,"x":2,"y":3}}}}');
		documentSort(document, ['a', 'b', 'c']);
		expect(Object.keys(JSON.parse(document.text).a.b.c)).toEqual(['x', 'y', 'z']);
	});

	// --- Large values ---

	test('very long string value', () => {
		const longString = 'x'.repeat(10_000);
		const document = parse('{"before": 1, "target": "old", "after": 2}');
		documentSet(document, ['target'], longString);
		expect(documentGet(document, ['target'])).toBe(longString);
		expect(documentGet(document, ['before'])).toBe(1);
		expect(documentGet(document, ['after'])).toBe(2);
	});

	test('many properties: sort 50 keys', () => {
		const keys = Array.from({ length: 50 }, (_, i) => `key${String(i).padStart(3, '0')}`);
		const shuffled = [...keys].sort(() => Math.random() - 0.5);
		const object = shuffled.map(k => `"${k}": 1`).join(', ');
		const document = parse(`{${object}}`);
		documentSort(document);
		expect(Object.keys(JSON.parse(document.text))).toEqual(keys);
	});

	// --- Whitespace extremes ---

	test('excessive whitespace everywhere', () => {
		const document = parse('{   "a"   :   1   ,   "b"   :   2   }');
		documentSet(document, ['a'], 10);
		expect(document.text).toBe('{   "a"   :   10   ,   "b"   :   2   }');
	});

	test('no whitespace at all (fully minified)', () => {
		const document = parse('{"c":3,"a":1,"b":2}');
		documentSort(document);
		expect(document.text).toBe('{"a":1,"b":2,"c":3}');
	});

	test('mixed CRLF and LF line endings', () => {
		const document = parse('{\r\n  "a": 1,\n  "b": 2\r\n}');
		documentSet(document, ['a'], 10);
		// Only the value changes, line endings preserved
		expect(document.text).toBe('{\r\n  "a": 10,\n  "b": 2\r\n}');
	});

	// --- Special characters in keys and values ---

	test('key containing backslash and quotes', () => {
		const document = parse(String.raw`{"a\"b\\c": 1}`);
		expect(documentGet(document, [String.raw`a"b\c`])).toBe(1);
		documentSet(document, [String.raw`a"b\c`], 2);
		expect(documentGet(document, [String.raw`a"b\c`])).toBe(2);
	});

	test('value containing all JSON escape sequences', () => {
		const document = parse('{"text": "old"}');
		documentSet(document, ['text'], 'tab\there\nnewline\r\n"quotes"\\backslash');
		const result = documentGet(document, ['text']);
		expect(result).toContain('tab\there');
		expect(result).toContain('\n');
	});

	test('empty string key', () => {
		const document = parse('{"": 1, "a": 2}');
		expect(documentGet(document, [''])).toBe(1);
		documentSet(document, [''], 99);
		expect(documentGet(document, [''])).toBe(99);
		expect(documentGet(document, ['a'])).toBe(2);
	});

	// --- Operation chains ---

	test('5 operations chained', () => {
		const document = parse('{"deps":{"c":3,"a":1},"items":[1],"old":"val"}');
		documentSort(document, ['deps']);
		documentPush(document, ['items'], 2);
		documentRename(document, ['old'], 'new');
		documentSet(document, ['added'], true);
		documentRemove(document, ['new']);
		const parsed = JSON.parse(document.text);
		expect(Object.keys(parsed.deps)).toEqual(['a', 'c']);
		expect(parsed.items).toEqual([1, 2]);
		expect(parsed.added).toBe(true);
		expect(parsed.new).toBeUndefined();
	});

	test('remove all members then rebuild', () => {
		const document = parse('{"a": 1, "b": 2, "c": 3}');
		documentRemove(document, ['a']);
		documentRemove(document, ['b']);
		documentRemove(document, ['c']);
		expect(document.text).toBe('{}');
		documentSet(document, ['x'], 1);
		documentSet(document, ['y'], 2);
		const parsed = JSON.parse(document.text);
		expect(parsed).toEqual({
			x: 1,
			y: 2,
		});
	});

	test('sort then set then sort (idempotent after no change)', () => {
		const document = parse('{"c": 3, "a": 1, "b": 2}');
		documentSort(document);
		const afterFirst = document.text;
		documentSort(document);
		expect(document.text).toBe(afterFirst);
	});

	test('set same value multiple times', () => {
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], 2);
		documentSet(document, ['a'], 3);
		documentSet(document, ['a'], 4);
		expect(documentGet(document, ['a'])).toBe(4);
		expect(document.text).toBe('{"a": 4}');
	});

	// --- JSONC-specific ---

	test('comment between every token', () => {
		const document = parse('{ /* c1 */ "a" /* c2 */ : /* c3 */ 1 /* c4 */ }');
		expect(documentGet(document, ['a'])).toBe(1);
		documentSet(document, ['a'], 2);
		expect(documentGet(document, ['a'])).toBe(2);
		// All comments preserved
		const result = document.text;
		expect(result).toContain('c1');
		expect(result).toContain('c2');
		expect(result).toContain('c3');
		expect(result).toContain('c4');
	});

	test('line comment at end of file (no trailing newline)', () => {
		const document = parse('{"a": 1} // end');
		documentSet(document, ['a'], 2);
		expect(document.text).toBe('{"a": 2} // end');
	});

	test('only comments, no members — comment preserved after set', () => {
		const document = parse('{\n  // just a comment\n}');
		documentSet(document, ['a'], 1);
		const result = document.text;
		expect(documentGet(document, ['a'])).toBe(1);
		// Comment is container trivia — should be preserved
		expect(result).toContain('// just a comment');
	});

	test('push into empty array preserves comment', () => {
		const document = parse('[\n  // items go here\n]');
		documentPush(document, [], 1);
		const result = document.text;
		expect(documentGet(document, [0])).toBe(1);
		expect(result).toContain('// items go here');
	});

	test('mixed-type array sort is stable no-op', () => {
		const input = '[10, "string", 2, "another", 5]';
		const document = parse(input);
		documentSort(document);
		expect(document.text).toBe(input);
	});

	test('default sort on 12-element array sorts numerically', () => {
		const input = '{"items":[0,1,2,3,4,5,6,7,8,9,10,11]}';
		const document = parse(input);
		documentSort(document, ['items']);
		// Should remain in numeric order (0,1,2,...,11), not lexicographic
		expect(document.text).toBe(input);
	});

	// --- CRLF-specific ---

	test('CRLF document: inserted content uses CRLF', () => {
		const document = parse('{\r\n  "a": 1\r\n}');
		documentSet(document, ['b'], 2);
		const result = document.text;
		// All line endings should be CRLF — no bare LF mixed in
		const withoutCRLF = result.replaceAll('\r\n', '');
		expect(withoutCRLF).not.toContain('\n');
	});

	// --- Container header edge cases ---

	test('remove under container header leaves clean empty object', () => {
		const document = parse('{\n  // header\n\n  "a": 1\n}');
		documentRemove(document, ['a']);
		const result = document.text;
		// Should not have a line with only whitespace before }
		expect(result).not.toMatch(/\n[ \t]+\n\}/);
	});

	// --- Duplicate key and push ordering ---

	test('remove with duplicate keys removes last occurrence (semantic change)', () => {
		const document = parse('{"a":1,"a":2,"b":3}');
		documentRemove(document, ['a']);
		// Should remove the last "a" (the one JSON.parse uses) to change semantics
		expect(JSON.parse(document.text).a).toBe(1);
	});

	test('push on non-existent path with undefined creates array with null', () => {
		const document = parse('{"a": 1}');
		documentPush(document, ['missing'], undefined as unknown as JsonValue);
		expect(JSON.parse(document.text).missing).toEqual([null]);
	});

	test('push on non-array path is no-op even with invalid values', () => {
		const document = parse('{"a": "string"}');
		documentPush(document, ['a'], undefined as unknown as JsonValue);
		expect(document.text).toBe('{"a": "string"}');
	});

	// --- insert and removeValue edge cases ---

	test('insert into array with trailing commas', () => {
		const document = parse('[1, 2,]');
		documentInsert(document, [], 1, 99);
		expect(documentGet(document, [])).toEqual([1, 99, 2]);
	});

	test('insert into array with CRLF line endings', () => {
		const document = parse('{\r\n  "items": [\r\n    1,\r\n    2\r\n  ]\r\n}');
		documentInsert(document, ['items'], 1, 99);
		const result = document.text;
		expect(JSON.parse(result).items).toEqual([1, 99, 2]);
		// No bare LF mixed in
		const withoutCRLF = result.replaceAll('\r\n', '');
		expect(withoutCRLF).not.toContain('\n');
	});

	test('insert into array with comments between elements', () => {
		const input = '[\n  // first\n  1,\n  // second\n  2\n]';
		const document = parse(input);
		documentInsert(document, [], 1, 99);
		const result = document.text;
		expect(result).toContain('// first');
		expect(result).toContain('// second');
		expect(JSON.parse(result.replaceAll(/\/\/.*$/gm, ''))).toEqual([1, 99, 2]);
	});

	test('remove from array with comments preserves comments', () => {
		const input = '[\n  // keep\n  "a",\n  "b",\n  "c"\n]';
		const document = parse(input);
		documentRemove(document, [1]); // remove "b" by index
		const result = document.text;
		expect(result).toContain('// keep');
		expect(result).toContain('"a"');
		expect(result).toContain('"c"');
		expect(result).not.toContain('"b"');
	});

	test('remove object from array by index', () => {
		const document = parse('[{"a": 1, "b": 2}, {"a": 3, "b": 4}]');
		documentRemove(document, [0]); // remove first element
		expect(JSON.parse(document.text)).toEqual([{
			a: 3,
			b: 4,
		}]);
	});

	test('insert then remove round-trip', () => {
		const document = parse('["a", "c"]');
		documentInsert(document, [], 1, 'b');
		expect(documentGet(document, [])).toEqual(['a', 'b', 'c']);
		documentRemove(document, [1]); // remove "b" by index
		expect(documentGet(document, [])).toEqual(['a', 'c']);
	});

	// --- Trailing comma edge cases ---

	test('trailing comma on every member including nested', () => {
		const input = '{\n  "a": [1, 2,],\n  "b": {"x": 1, "y": 2,},\n}';
		const document = parse(input);
		documentSort(document);
		expect(documentGet(document, ['a', 0])).toBe(1);
		expect(documentGet(document, ['b', 'x'])).toBe(1);
	});

	test('push to single-element array with trailing comma', () => {
		const document = parse('[1,]');
		documentPush(document, [], 2);
		expect(documentGet(document, [])).toEqual([1, 2]);
	});

	// --- Numeric string key sorting ---

	test('numeric string keys sort lexicographically', () => {
		const document = parse('{"10": "ten", "2": "two", "1": "one"}');
		documentSort(document);
		// Lexicographic: "1" < "10" < "2"
		// Can't use Object.keys(JSON.parse(...)) because JS reorders integer-like keys
		const result = document.text;
		const pos1 = result.indexOf('"1"');
		const pos10 = result.indexOf('"10"');
		const pos2 = result.indexOf('"2"');
		expect(pos1).toBeLessThan(pos10);
		expect(pos10).toBeLessThan(pos2);
	});
});
