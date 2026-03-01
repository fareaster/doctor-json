import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentRemove } from '../src/doc/remove.ts';
import { documentPush } from '../src/doc/arrays.ts';
import { documentSort } from '../src/doc/sort.ts';

const parse = createDocument;

describe('integration', () => {
	test('empty object', () => {
		const document = parse('{}');
		expect(document.text).toBe('{}');
	});

	test('property key with spaces', () => {
		const document = parse('{"hello world": 1}');
		expect(documentGet(document, ['hello world'])).toBe(1);
		documentSet(document, ['hello world'], 2);
		expect(document.text).toBe('{"hello world": 2}');
	});

	test('property key with dots', () => {
		// String path "a.b" should be treated as single key, not nested path
		const document = parse('{"a.b": 1}');
		expect(documentGet(document, ['a.b'])).toBe(1);
	});

	test('property key with quotes', () => {
		const document = parse(String.raw`{"say \"hello\"": 1}`);
		expect(documentGet(document, ['say "hello"'])).toBe(1);
	});

	test('unicode values', () => {
		const document = parse(String.raw`{"emoji": "\u2764"}`);
		documentSet(document, ['emoji'], '\u{1F600}');
		const result = document.text;
		expect(documentGet(parse(result), ['emoji'])).toBe('\u{1F600}');
	});

	test('empty string value', () => {
		const document = parse('{"name": ""}');
		expect(documentGet(document, ['name'])).toBe('');
		documentSet(document, ['name'], 'filled');
		expect(document.text).toBe('{"name": "filled"}');
	});

	test('large number', () => {
		const document = parse('{"n": 9007199254740991}');
		expect(documentGet(document, ['n'])).toBe(9_007_199_254_740_991);
	});

	test('negative number', () => {
		const document = parse('{"n": -42}');
		documentSet(document, ['n'], -100);
		expect(document.text).toBe('{"n": -100}');
	});

	test('float number', () => {
		const document = parse('{"n": 3.14}');
		documentSet(document, ['n'], 2.718);
		expect(document.text).toBe('{"n": 2.718}');
	});

	test('toString returns same result on multiple calls', () => {
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], 2);
		expect(document.text).toBe('{"a": 2}');
		expect(document.text).toBe('{"a": 2}');
	});

	test('original string is not mutated', () => {
		const original = '{"a": 1}';
		const document = parse(original);
		documentSet(document, ['a'], 2);
		// We can't actually test this since strings are immutable in JS,
		// but we can verify the doc has the new value
		expect(document.text).toBe('{"a": 2}');
	});

	test('chain set on empty object', () => {
		const document = parse('{}');
		documentSet(document, ['a'], 1);
		documentSet(document, ['b'], 2);
		const result = JSON.parse(document.text);
		expect(result).toEqual({
			a: 1,
			b: 2,
		});
	});

	test('chain set after removing only property', () => {
		const document = parse('{"a": 1}');
		documentRemove(document, ['a']);
		documentSet(document, ['b'], 2);
		const result = JSON.parse(document.text);
		expect(result).toEqual({ b: 2 });
	});

	test('chain set on empty formatted object', () => {
		const input = '{\n  "outer": {}\n}';
		const document = parse(input);
		documentSet(document, ['outer', 'x'], 1);
		documentSet(document, ['outer', 'y'], 2);
		const result = JSON.parse(document.text);
		expect(result.outer).toEqual({
			x: 1,
			y: 2,
		});
	});

	test('set array index on existing object is no-op', () => {
		const document = parse('{"items": {"0": "im-an-object-key"}}');
		// Path wants array index, but items is an ObjectNode
		documentSet(document, ['items', 0], 'new-value');
		expect(document.text).toBe('{"items": {"0": "im-an-object-key"}}');
	});

	test('set object key on existing array is no-op', () => {
		const document = parse('{"items": ["im-an-array-element"]}');
		// Path wants object key, but items is an ArrayNode
		documentSet(document, ['items', 'name'], 'new-value');
		expect(document.text).toBe('{"items": ["im-an-array-element"]}');
	});

	test('deeply nested set and get', () => {
		const input = '{"a": {"b": {"c": {"d": {"e": 1}}}}}';
		const document = parse(input);
		documentSet(document, ['a', 'b', 'c', 'd', 'e'], 2);
		expect(documentGet(document, ['a', 'b', 'c', 'd', 'e'])).toBe(2);
	});

	test('handle root array', () => {
		const document = parse('[1, 2, 3]');
		expect(documentGet(document, [0])).toBe(1);
		expect(documentGet(document, [2])).toBe(3);
	});

	test('real-world package.json edit', () => {
		const input = [
			'{',
			'  "name": "@scope/package",',
			'  "version": "1.0.0",',
			'  "description": "A package",',
			'  "main": "index.js",',
			'  "scripts": {',
			'    "build": "tsc",',
			'    "test": "jest"',
			'  },',
			'  "dependencies": {',
			'    "lodash": "^4.17.21"',
			'  }',
			'}',
		].join('\n');

		const document = parse(input);
		documentSet(document, ['version'], '2.0.0');
		documentSet(document, ['scripts', 'test'], 'vitest');
		documentSet(document, ['dependencies', 'react'], '^18.0.0');

		const result = document.text;
		const parsed = JSON.parse(result);
		expect(parsed.version).toBe('2.0.0');
		expect(parsed.scripts.test).toBe('vitest');
		expect(parsed.dependencies.react).toBe('^18.0.0');
		expect(parsed.name).toBe('@scope/package');
		expect(parsed.scripts.build).toBe('tsc');
	});

	test('real-world tsconfig.json edit', () => {
		const input = [
			'{',
			'  "compilerOptions": {',
			'    "target": "ES2020",',
			'    "module": "ESNext",',
			'    "strict": true',
			'  },',
			'  "include": ["src"]',
			'}',
		].join('\n');

		const document = parse(input);
		documentSet(document, ['compilerOptions', 'target'], 'ES2022');
		documentRemove(document, ['compilerOptions', 'module']);

		const result = document.text;
		const parsed = JSON.parse(result);
		expect(parsed.compilerOptions.target).toBe('ES2022');
		expect(parsed.compilerOptions.module).toBeUndefined();
		expect(parsed.compilerOptions.strict).toBe(true);
	});

	test('real-world JSONC tsconfig edit', () => {
		const input = [
			'{',
			'  // Compiler options',
			'  "compilerOptions": {',
			'    "target": "ES2020", // ECMAScript target',
			'    "strict": true',
			'  }',
			'}',
		].join('\n');

		const document = parse(input);
		documentSet(document, ['compilerOptions', 'target'], 'ES2022');

		const result = document.text;
		expect(result).toContain('// Compiler options');
		expect(result).toContain('// ECMAScript target');
		expect(result).toContain('"target": "ES2022"');
	});

	test('set property with value containing newlines', () => {
		const document = parse('{"text": "old"}');
		documentSet(document, ['text'], 'line1\nline2\nline3');
		expect(documentGet(document, ['text'])).toBe('line1\nline2\nline3');
	});

	test('multiple operations preserve overall structure', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2,',
			'  "c": 3,',
			'  "d": 4',
			'}',
		].join('\n');

		const document = parse(input);
		documentSet(document, ['a'], 10);
		documentRemove(document, ['b']);
		documentSet(document, ['e'], 5);
		documentSet(document, ['c'], 30);

		const result = document.text;
		const parsed = JSON.parse(result);
		expect(parsed.a).toBe(10);
		expect(parsed.b).toBeUndefined();
		expect(parsed.c).toBe(30);
		expect(parsed.d).toBe(4);
		expect(parsed.e).toBe(5);
	});

	test('object with only whitespace between braces', () => {
		const document = parse('{   }');
		documentSet(document, ['a'], 1);
		expect(JSON.parse(document.text)).toEqual({ a: 1 });
	});

	test('multiple blank lines create sort group boundary', () => {
		const document = parse('{\n  "c": 3,\n\n\n\n  "a": 1\n}');
		documentSort(document);
		// Multiple blank lines = group boundary, no cross-group sort
		expect(document.text.indexOf('"c"')).toBeLessThan(document.text.indexOf('"a"'));
	});

	test('comment immediately after opening brace', () => {
		const document = parse('{// comment\n  "a": 1\n}');
		documentSet(document, ['a'], 2);
		expect(document.text).toContain('// comment');
		expect(documentGet(document, ['a'])).toBe(2);
	});

	test('block comment on same line as opening brace', () => {
		const document = parse('{ /* header */ "a": 1}');
		documentSet(document, ['a'], 2);
		expect(document.text).toContain('/* header */');
		expect(documentGet(document, ['a'])).toBe(2);
	});

	test('reserved JS words as JSON keys', () => {
		const document = parse('{"constructor": 1, "__proto__": 2, "toString": 3}');
		expect(documentGet(document, ['constructor'])).toBe(1);
		expect(documentGet(document, ['__proto__'])).toBe(2);
		expect(documentGet(document, ['toString'])).toBe(3);
		documentSort(document);
		expect(Object.keys(JSON.parse(document.text))).toEqual(['__proto__', 'constructor', 'toString']);
	});

	test('remove last nested property leaves empty parent', () => {
		const document = parse('{"outer": {"only": 1}, "keep": 2}');
		documentRemove(document, ['outer', 'only']);
		expect(JSON.parse(document.text)).toEqual({
			outer: {},
			keep: 2,
		});
	});

	test('set parent to object then set child', () => {
		const document = parse('{"a": {"b": 1}}');
		documentSet(document, ['a'], {
			b: 2,
			c: 3,
		});
		documentSet(document, ['a', 'b'], 99);
		expect(documentGet(document, ['a', 'b'])).toBe(99);
		expect(documentGet(document, ['a', 'c'])).toBe(3);
	});

	test('push multiple complex objects to multiline array', () => {
		const document = parse('{\n  "items": [\n    {"id": 1}\n  ]\n}');
		documentPush(document, ['items'], { id: 2 }, { id: 3 });
		const parsed = JSON.parse(document.text);
		expect(parsed.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
	});
});
