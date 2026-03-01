import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';
import { documentSet } from '../src/doc/set.ts';

const parse = createDocument;

describe('set', () => {
	describe('update existing', () => {
		test('update string value', () => {
			const document = parse('{"name": "old"}');
			documentSet(document, ['name'], 'new');
			expect(document.text).toBe('{"name": "new"}');
		});

		test('update number value', () => {
			const document = parse('{"count": 1}');
			documentSet(document, ['count'], 42);
			expect(document.text).toBe('{"count": 42}');
		});

		test('update boolean value', () => {
			const document = parse('{"enabled": false}');
			documentSet(document, ['enabled'], true);
			expect(document.text).toBe('{"enabled": true}');
		});

		test('update to null', () => {
			const document = parse('{"value": "something"}');
			documentSet(document, ['value'], null);
			expect(document.text).toBe('{"value": null}');
		});

		test('update with object value', () => {
			const document = parse('{"config": "old"}');
			documentSet(document, ['config'], { a: 1 });
			// Matches parent's colon style (space after colon)
			expect(document.text).toBe('{"config": {"a": 1}}');
		});

		test('update with array value', () => {
			const document = parse('{"items": "old"}');
			documentSet(document, ['items'], [1, 2, 3]);
			expect(document.text).toBe('{"items": [1, 2, 3]}');
		});

		test('update first array element', () => {
			const document = parse('{"items": ["a", "b", "c"]}');
			documentSet(document, ['items', 0], 'x');
			expect(document.text).toBe('{"items": ["x", "b", "c"]}');
		});

		test('update middle array element', () => {
			const document = parse('{"items": ["a", "b", "c"]}');
			documentSet(document, ['items', 1], 'x');
			expect(document.text).toBe('{"items": ["a", "x", "c"]}');
		});

		test('update last array element', () => {
			const document = parse('{"items": ["a", "b", "c"]}');
			documentSet(document, ['items', 2], 'x');
			expect(document.text).toBe('{"items": ["a", "b", "x"]}');
		});

		test('update array element with complex value', () => {
			const document = parse('{"items": [1, 2, 3]}');
			documentSet(document, ['items', 1], { nested: true });
			// Old value (2) was inline, so replacement is serialized inline
			expect(document.text).toBe('{"items": [1, {"nested":true}, 3]}');
		});

		test('update nested value inside array element', () => {
			const document = parse('{"users": [{"name": "alice"}, {"name": "bob"}]}');
			documentSet(document, ['users', 1, 'name'], 'charlie');
			expect(document.text).toBe('{"users": [{"name": "alice"}, {"name": "charlie"}]}');
		});

		test('update array element then get returns new value', () => {
			const document = parse('{"items": [1, 2, 3]}');
			documentSet(document, ['items', 1], 99);
			expect(documentGet(document, ['items', 1])).toBe(99);
			expect(documentGet(document, ['items', 0])).toBe(1);
		});

		test('update root array element', () => {
			const document = parse('[10, 20, 30]');
			documentSet(document, [1], 99);
			expect(document.text).toBe('[10, 99, 30]');
		});

		test('update with object value (minified)', () => {
			const document = parse('{"config":"old"}');
			documentSet(document, ['config'], { a: 1 });
			expect(document.text).toBe('{"config":{"a":1}}');
		});

		test('update with array value (minified)', () => {
			const document = parse('{"items":"old"}');
			documentSet(document, ['items'], [1, 2, 3]);
			expect(document.text).toBe('{"items":[1,2,3]}');
		});

		test('update nested property', () => {
			const document = parse('{"a": {"b": "old"}}');
			documentSet(document, ['a', 'b'], 'new');
			expect(document.text).toBe('{"a": {"b": "new"}}');
		});

		test('update deeply nested property', () => {
			const document = parse('{"a": {"b": {"c": 1}}}');
			documentSet(document, ['a', 'b', 'c'], 2);
			expect(document.text).toBe('{"a": {"b": {"c": 2}}}');
		});

		test('update preserves other properties', () => {
			const document = parse('{"a": 1, "b": 2, "c": 3}');
			documentSet(document, ['b'], 99);
			expect(document.text).toBe('{"a": 1, "b": 99, "c": 3}');
		});

		test('update value in formatted JSON', () => {
			const input = [
				'{',
				'  "name": "old",',
				'  "version": "1.0.0"',
				'}',
			].join('\n');
			const document = parse(input);
			documentSet(document, ['name'], 'new');
			const expected = [
				'{',
				'  "name": "new",',
				'  "version": "1.0.0"',
				'}',
			].join('\n');
			expect(document.text).toBe(expected);
		});

		test('update with object value in formatted JSON', () => {
			const input = [
				'{',
				'  "scripts": {',
				'    "build": "tsc"',
				'  }',
				'}',
			].join('\n');
			const document = parse(input);
			documentSet(document, ['scripts', 'build'], 'rollup -c');
			const expected = [
				'{',
				'  "scripts": {',
				'    "build": "rollup -c"',
				'  }',
				'}',
			].join('\n');
			expect(document.text).toBe(expected);
		});

		test('chained updates', () => {
			const document = parse('{"a": 1, "b": 2}');
			documentSet(document, ['a'], 10);
			documentSet(document, ['b'], 20);
			expect(document.text).toBe('{"a": 10, "b": 20}');
		});

		test('update string with special characters', () => {
			const document = parse('{"msg": "hello"}');
			documentSet(document, ['msg'], 'hello "world" \\ new\nline');
			expect(documentGet(document, ['msg'])).toBe('hello "world" \\ new\nline');
		});

		test('update number to larger number', () => {
			const document = parse('{"n": 1}');
			documentSet(document, ['n'], 1_000_000);
			expect(document.text).toBe('{"n": 1000000}');
		});

		test('update number to smaller number', () => {
			const document = parse('{"n": 1000000}');
			documentSet(document, ['n'], 1);
			expect(document.text).toBe('{"n": 1}');
		});
	});

	describe('insert new', () => {
		test('add to empty object (minified)', () => {
			const document = parse('{}');
			documentSet(document, ['name'], 'hello');
			expect(document.text).toBe('{"name":"hello"}');
		});

		test('add to non-empty object (minified)', () => {
			const document = parse('{"a":1}');
			documentSet(document, ['b'], 2);
			expect(document.text).toBe('{"a":1,"b":2}');
		});

		test('add to empty object (no detectable indent)', () => {
			// Can't detect indent from {\n} - no indented lines exist
			const document = parse('{\n}');
			documentSet(document, ['name'], 'hello');
			const result = document.text;
			expect(JSON.parse(result)).toEqual({ name: 'hello' });
		});

		test('add to empty nested object (formatted)', () => {
			const input = '{\n  "config": {}\n}';
			const document = parse(input);
			documentSet(document, ['config', 'key'], 'value');
			const result = document.text;
			const parsed = JSON.parse(result);
			expect(parsed.config.key).toBe('value');
		});

		test('add to non-empty object (2-space indent)', () => {
			const input = [
				'{',
				'  "a": 1',
				'}',
			].join('\n');
			const document = parse(input);
			documentSet(document, ['b'], 2);
			const expected = [
				'{',
				'  "a": 1,',
				'  "b": 2',
				'}',
			].join('\n');
			expect(document.text).toBe(expected);
		});

		test('add to non-empty object (4-space indent)', () => {
			const input = [
				'{',
				'    "a": 1',
				'}',
			].join('\n');
			const document = parse(input);
			documentSet(document, ['b'], 2);
			const expected = [
				'{',
				'    "a": 1,',
				'    "b": 2',
				'}',
			].join('\n');
			expect(document.text).toBe(expected);
		});

		test('add to non-empty object (tab indent)', () => {
			const input = '{\n\t"a": 1\n}';
			const document = parse(input);
			documentSet(document, ['b'], 2);
			expect(document.text).toBe('{\n\t"a": 1,\n\t"b": 2\n}');
		});

		test('add nested property where parent exists', () => {
			const input = [
				'{',
				'  "scripts": {',
				'    "build": "tsc"',
				'  }',
				'}',
			].join('\n');
			const document = parse(input);
			documentSet(document, ['scripts', 'test'], 'vitest');
			const expected = [
				'{',
				'  "scripts": {',
				'    "build": "tsc",',
				'    "test": "vitest"',
				'  }',
				'}',
			].join('\n');
			expect(document.text).toBe(expected);
		});

		test('add nested property creating intermediate objects', () => {
			const input = '{\n  "name": "pkg"\n}';
			const document = parse(input);
			documentSet(document, ['scripts', 'build'], 'tsc');
			const result = document.text;
			// Should contain the nested structure
			const parsed = JSON.parse(result);
			expect(parsed.scripts.build).toBe('tsc');
			expect(parsed.name).toBe('pkg');
		});

		test('add object value (formatted)', () => {
			const input = [
				'{',
				'  "name": "pkg"',
				'}',
			].join('\n');
			const document = parse(input);
			documentSet(document, ['scripts'], {
				build: 'tsc',
				test: 'vitest',
			});
			const result = document.text;
			const parsed = JSON.parse(result);
			expect(parsed.scripts).toEqual({
				build: 'tsc',
				test: 'vitest',
			});
		});

		test('add array value (formatted)', () => {
			const input = '{\n  "name": "pkg"\n}';
			const document = parse(input);
			documentSet(document, ['keywords'], ['json', 'edit']);
			const result = document.text;
			const parsed = JSON.parse(result);
			expect(parsed.keywords).toEqual(['json', 'edit']);
		});

		test('add multiple properties', () => {
			const document = parse('{"a": 1}');
			documentSet(document, ['b'], 2);
			documentSet(document, ['c'], 3);
			const result = JSON.parse(document.text);
			expect(result).toEqual({
				a: 1,
				b: 2,
				c: 3,
			});
		});

		test('add to object with trailing comma (JSONC)', () => {
			const input = [
				'{',
				'  "a": 1,',
				'}',
			].join('\n');
			const document = parse(input);
			documentSet(document, ['b'], 2);
			const result = document.text;
			// The new property should maintain trailing comma style
			expect(result).toContain('"b": 2');
			expect(result).toContain('"a": 1');
		});

		test('add empty object value', () => {
			const document = parse('{"a": 1}');
			documentSet(document, ['b'], {});
			// Matches existing style: space after colon, space after comma
			expect(document.text).toBe('{"a": 1, "b": {}}');
		});

		test('add empty array value', () => {
			const document = parse('{"a": 1}');
			documentSet(document, ['b'], []);
			expect(document.text).toBe('{"a": 1, "b": []}');
		});

		test('add empty object value (minified)', () => {
			const document = parse('{"a":1}');
			documentSet(document, ['b'], {});
			expect(document.text).toBe('{"a":1,"b":{}}');
		});

		test('add empty array value (minified)', () => {
			const document = parse('{"a":1}');
			documentSet(document, ['b'], []);
			expect(document.text).toBe('{"a":1,"b":[]}');
		});
	});
});
