import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentSet } from '../src/doc/set.ts';

const parse = createDocument;

describe('whitespace', () => {
	test('preserves spaces around colons', () => {
		const input = '{"a" : 1, "b" : 2}';
		const document = parse(input);
		documentSet(document, ['a'], 10);
		expect(document.text).toBe('{"a" : 10, "b" : 2}');
	});

	test('preserves no spaces around colons', () => {
		const input = '{"a":1,"b":2}';
		const document = parse(input);
		documentSet(document, ['a'], 10);
		expect(document.text).toBe('{"a":10,"b":2}');
	});

	test('preserves trailing newline', () => {
		const input = '{\n  "a": 1\n}\n';
		const document = parse(input);
		documentSet(document, ['a'], 2);
		expect(document.text).toBe('{\n  "a": 2\n}\n');
	});

	test('preserves CRLF line endings', () => {
		const input = '{\r\n  "a": 1\r\n}';
		const document = parse(input);
		documentSet(document, ['a'], 2);
		expect(document.text).toBe('{\r\n  "a": 2\r\n}');
	});

	test('preserves inconsistent spacing between properties', () => {
		// Some properties have extra spaces, some don't
		const input = '{"a":1,  "b": 2,   "c" :  3}';
		const document = parse(input);
		documentSet(document, ['b'], 20);
		// Only the value of "b" should change
		expect(document.text).toBe('{"a":1,  "b": 20,   "c" :  3}');
	});

	test('preserves spaces inside empty object when adding', () => {
		const input = '{  }';
		const document = parse(input);
		// When we add to an empty object with spaces, we collapse it
		documentSet(document, ['a'], 1);
		const result = document.text;
		// Should contain the new property
		expect(JSON.parse(result)).toEqual({ a: 1 });
	});

	test('update preserves whitespace before and after value', () => {
		// Extra space after colon
		const input = '{"name":   "old"}';
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		expect(document.text).toBe('{"name":   "new"}');
	});

	test('preserves blank lines between properties', () => {
		const input = [
			'{',
			'  "a": 1,',
			'',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['a'], 10);
		const expected = [
			'{',
			'  "a": 10,',
			'',
			'  "b": 2',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('preserves indentation in multiline value', () => {
		const input = [
			'{',
			'  "nested": {',
			'    "deep": "value"',
			'  },',
			'  "other": "keep"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['other'], 'changed');
		const expected = [
			'{',
			'  "nested": {',
			'    "deep": "value"',
			'  },',
			'  "other": "changed"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	// --- Deep edge cases (from whitespace-deep) ---

	test('inconsistent indentation across properties', () => {
		// Some properties 2-space, some 4-space (malformed but real-world)
		const input = [
			'{',
			'  "a": 1,',
			'    "b": 2,',
			'  "c": 3',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['b'], 20);
		// Should only change the value, preserving the weird indentation
		const expected = [
			'{',
			'  "a": 1,',
			'    "b": 20,',
			'  "c": 3',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('mixed tabs and spaces (real-world messy files)', () => {
		const input = '{\n\t"a": 1,\n  "b": 2\n}';
		const document = parse(input);
		documentSet(document, ['a'], 10);
		expect(document.text).toBe('{\n\t"a": 10,\n  "b": 2\n}');
	});

	test('extra spaces between colon and value', () => {
		const input = '{"name":     "value"}';
		const document = parse(input);
		documentSet(document, ['name'], 'new');
		// Preserves the gap between colon and value
		expect(document.text).toBe('{"name":     "new"}');
	});

	test('no space after colon', () => {
		const input = '{"a":1}';
		const document = parse(input);
		documentSet(document, ['a'], 2);
		expect(document.text).toBe('{"a":2}');
	});

	test('spaces before colon', () => {
		const input = '{"a" : 1}';
		const document = parse(input);
		documentSet(document, ['a'], 2);
		expect(document.text).toBe('{"a" : 2}');
	});

	test('update preserves whitespace in multiline arrays', () => {
		const input = [
			'{',
			'  "items": [',
			'    1,',
			'    2,',
			'    3',
			'  ]',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['items'], [10, 20, 30]);
		const result = document.text;
		const parsed = JSON.parse(result);
		expect(parsed.items).toEqual([10, 20, 30]);
	});

	test('preserve Windows CRLF when adding property', () => {
		const input = '{\r\n  "a": 1\r\n}';
		const document = parse(input);
		documentSet(document, ['a'], 2);
		expect(document.text).toBe('{\r\n  "a": 2\r\n}');
	});

	test('single-line with varied spacing', () => {
		const input = '{  "a" :  1 ,  "b"  :  2  }';
		const document = parse(input);
		documentSet(document, ['a'], 10);
		// Only the value changes
		expect(document.text).toBe('{  "a" :  10 ,  "b"  :  2  }');
	});

	test('property value spans multiple lines (object)', () => {
		const input = [
			'{',
			'  "config": {',
			'    "a": 1,',
			'    "b": 2',
			'  },',
			'  "name": "test"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['name'], 'updated');
		const expected = [
			'{',
			'  "config": {',
			'    "a": 1,',
			'    "b": 2',
			'  },',
			'  "name": "updated"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('empty lines before closing brace preserved', () => {
		const input = [
			'{',
			'  "a": 1',
			'',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['a'], 2);
		const expected = [
			'{',
			'  "a": 2',
			'',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});
});
