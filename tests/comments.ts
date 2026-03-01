import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentRemove } from '../src/doc/remove.ts';

const parse = createDocument;

describe('comments', () => {
	test('preserve line comment before property', () => {
		const input = [
			'{',
			'  // This is the name',
			'  "name": "old"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		const expected = [
			'{',
			'  // This is the name',
			'  "name": "new"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserve line comment at end of line', () => {
		const input = [
			'{',
			'  "name": "old" // inline comment',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		const expected = [
			'{',
			'  "name": "new" // inline comment',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserve block comment before property', () => {
		const input = [
			'{',
			'  /* Block comment */',
			'  "name": "old"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		const expected = [
			'{',
			'  /* Block comment */',
			'  "name": "new"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserve block comment between key and value', () => {
		const input = '{"name": /* comment */ "old"}';
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		expect(document.text).toBe('{"name": /* comment */ "new"}');
	});

	test('preserve block comment between colon and value', () => {
		const input = [
			'{',
			'  "name": /* important */ "old"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		const expected = [
			'{',
			'  "name": /* important */ "new"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserve comments on other properties when updating one', () => {
		const input = [
			'{',
			'  // Name of the package',
			'  "name": "old",',
			'  // Version number',
			'  "version": "1.0.0"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		const expected = [
			'{',
			'  // Name of the package',
			'  "name": "new",',
			'  // Version number',
			'  "version": "1.0.0"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserve comments at top of file', () => {
		const input = [
			'// Config file',
			'{',
			'  "name": "old"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		const expected = [
			'// Config file',
			'{',
			'  "name": "new"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserve comments at bottom of file', () => {
		const input = [
			'{',
			'  "name": "old"',
			'}',
			'// End of file',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		const expected = [
			'{',
			'  "name": "new"',
			'}',
			'// End of file',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserve multiline block comment', () => {
		const input = [
			'{',
			'  /**',
			'   * The name',
			'   */',
			'  "name": "old"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		const expected = [
			'{',
			'  /**',
			'   * The name',
			'   */',
			'  "name": "new"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserve comments between properties', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  // separator',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['a'], 10);
		const expected = [
			'{',
			'  "a": 10,',
			'  // separator',
			'  "b": 2',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('add property to JSONC file preserves existing comments', () => {
		const input = [
			'{',
			'  // Existing property',
			'  "a": 1',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['b'], 2);
		const result = document.text;
		expect(result).toContain('// Existing property');
		expect(result).toContain('"a": 1');
		expect(result).toContain('"b": 2');
	});

	test('trailing comma with comments', () => {
		const input = [
			'{',
			'  "a": 1, // first',
			'  "b": 2, // second',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['a'], 10);
		const expected = [
			'{',
			'  "a": 10, // first',
			'  "b": 2, // second',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('remove property with comment before it', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  // This is b',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['b']);
		const result = document.text;
		expect(result).not.toContain('"b"');
		expect(result).toContain('"a": 1');
	});

	test('comment after removed value', () => {
		const input = [
			'{',
			'  "a": 1, // keep this comment context',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['b']);
		const result = document.text;
		expect(result).toContain('"a": 1');
		expect(result).not.toContain('"b"');
	});

	// --- Deep edge cases (from comments-deep) ---

	test('comment between key colon and value with spaces', () => {
		const input = '{ "key" : /* mid */ "value" }';
		const document = parse(input);
		documentSet(document, ['key'], 'updated');
		const result = document.text;
		expect(result).toBe('{ "key" : /* mid */ "updated" }');
	});

	test('multiple block comments between colon and value', () => {
		const input = '{"key": /* a */ /* b */ "value"}';
		const document = parse(input);
		documentSet(document, ['key'], 'new');
		expect(document.text).toBe('{"key": /* a */ /* b */ "new"}');
	});

	test('line comment after colon on same line, value on next line', () => {
		const input = [
			'{',
			'  "key": // comment',
			'    "value"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['key'], 'new');
		const expected = [
			'{',
			'  "key": // comment',
			'    "new"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('block comment wrapping value', () => {
		const input = '{"a": /* before */ 42 /* after */}';
		const document = parse(input);
		documentSet(document, ['a'], 100);
		// Only the value node is replaced, comments before and after are preserved
		expect(document.text).toBe('{"a": /* before */ 100 /* after */}');
	});

	test('comment between comma and next property preserved on update', () => {
		const input = [
			'{',
			'  "a": 1, /* section break */',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['b'], 20);
		const expected = [
			'{',
			'  "a": 1, /* section break */',
			'  "b": 20',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('set value in JSONC with only comments and one property', () => {
		const input = [
			'// top comment',
			'{',
			'  // property comment',
			'  "only": "value"',
			'  // trailing comment',
			'}',
			'// bottom comment',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['only'], 'changed');
		const result = document.text;
		expect(result).toContain('// top comment');
		expect(result).toContain('// property comment');
		expect(result).toContain('"only": "changed"');
		expect(result).toContain('// trailing comment');
		expect(result).toContain('// bottom comment');
	});

	test('remove first property between two comment blocks', () => {
		const input = [
			'{',
			'  /* header */',
			'  "a": 1,',
			'  /* separator */',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['a']);
		const result = document.text;
		expect(result).toContain('"b": 2');
		expect(result).not.toContain('"a"');
	});

	test('update array element surrounded by block comments', () => {
		const input = '{"arr": [/*a*/ 1 /*b*/, 2]}';
		const document = parse(input);
		documentSet(document, ['arr', 0], 99);
		expect(document.text).toBe('{"arr": [/*a*/ 99 /*b*/, 2]}');
	});

	test('remove last array element with trailing comma', () => {
		const input = [
			'{',
			'  "arr": [',
			'    1, // comment on 1',
			'    2,',
			'  ]',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['arr', 1]);
		// Consistent with object removal: removing the last element also removes
		// the preceding comma and anything after it (including inline comments),
		// since the comma was a separator for the now-removed element.
		const expected = [
			'{',
			'  "arr": [',
			'    1',
			'  ]',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('remove last member when comma exists inside preceding comment', () => {
		const input = [
			'{',
			'  "a": 1 /* useful, comment */,',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['b']);
		const expected = [
			'{',
			'  "a": 1 /* useful, comment */',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('remove first inline member when comma in block comment after it', () => {
		const input = '{"a": 1 /* comment */, "b": 2}';
		const document = parse(input);
		documentRemove(document, ['a']);
		expect(document.text).toBe('{"b": 2}');
	});

	test('remove first inline array element when comma in block comment', () => {
		const input = '[1 /* note, here */, 2]';
		const document = parse(input);
		documentRemove(document, [0]);
		expect(document.text).toBe('[2]');
	});

	test('remove last inline member when comma in block comment', () => {
		const input = '{"a": 1 /* x, y */, "b": 2}';
		const document = parse(input);
		documentRemove(document, ['b']);
		expect(document.text).toBe('{"a": 1 /* x, y */}');
	});

	test('preserve inline comments when updating adjacent property', () => {
		const input = [
			'{',
			'  "host": "localhost", // dev server',
			'  "port": 3000 // default port',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['port'], 8080);
		const expected = [
			'{',
			'  "host": "localhost", // dev server',
			'  "port": 8080 // default port',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('JSONC with all comment styles', () => {
		const input = [
			'// file header',
			'{',
			'  /* block before */',
			'  "a": /* inline */ 1, // trailing',
			'  /**',
			'   * multiline',
			'   */',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['a'], 10);
		const result = document.text;
		expect(result).toContain('// file header');
		expect(result).toContain('/* block before */');
		expect(result).toContain('/* inline */');
		expect(result).toContain('// trailing');
		expect(result).toContain('"a": /* inline */ 10');
		expect(result).toContain('* multiline');
	});

	test('colon inside block comment does not affect spacing detection', () => {
		const document = parse('{"a"/*x:y*/: 1}');
		documentSet(document, ['b'], 2);
		// New member should use same colon spacing as existing members (": ")
		expect(document.text).toContain('"b": 2');
	});

	test('colon inside line comment does not affect spacing detection', () => {
		const document = parse('{"a" // note:x\n: 1}');
		documentSet(document, ['b'], 2);
		expect(document.text).toContain('"b": 2');
	});
});
