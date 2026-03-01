import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentSet } from '../src/doc/set.ts';

const parse = createDocument;

describe('indentation detection', () => {
	test('detect 2-space indentation', () => {
		const input = [
			'{',
			'  "a": 1',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['b'], 2);
		const result = document.text;
		// New property should use 2-space indent
		expect(result).toMatch(/^ {2}"b"/m);
	});

	test('detect 4-space indentation', () => {
		const input = [
			'{',
			'    "a": 1',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['b'], 2);
		const result = document.text;
		// New property should use 4-space indent
		expect(result).toMatch(/^ {4}"b"/m);
	});

	test('detect tab indentation', () => {
		const input = '{\n\t"a": 1\n}';
		const document = parse(input);
		documentSet(document, ['b'], 2);
		const result = document.text;
		expect(result).toMatch(/^\t"b"/m);
	});

	test('minified JSON stays minified when adding', () => {
		const document = parse('{"a":1}');
		documentSet(document, ['b'], 2);
		expect(document.text).toBe('{"a":1,"b":2}');
	});

	test('nested object preserves indent level', () => {
		const input = [
			'{',
			'  "outer": {',
			'    "a": 1',
			'  }',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['outer', 'b'], 2);
		const result = document.text;
		// Inner property should have 4-space indent (2 levels deep)
		expect(result).toMatch(/^ {4}"b"/m);
	});

	test('added object value uses correct indentation', () => {
		const input = [
			'{',
			'  "name": "pkg"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['config'], { key: 'value' });
		const result = document.text;
		// The nested "key" should have 4-space indent
		const parsed = JSON.parse(result);
		expect(parsed.config.key).toBe('value');
	});

	test('added array value uses correct indentation', () => {
		const input = [
			'{',
			'  "name": "pkg"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['items'], [1, 2, 3]);
		const result = document.text;
		const parsed = JSON.parse(result);
		expect(parsed.items).toEqual([1, 2, 3]);
	});

	test('blank line before first member does not corrupt indent', () => {
		const document = parse('{\n\n  "config": {\n  }\n}');
		documentSet(document, ['config', 'x'], 1);
		const result = document.text;
		expect(result).toBe('{\n\n  "config": {\n    "x": 1\n  }\n}');
	});
});
