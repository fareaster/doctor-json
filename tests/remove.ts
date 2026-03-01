import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentRemove } from '../src/doc/remove.ts';

const parse = createDocument;

describe('remove', () => {
	test('remove only property (minified)', () => {
		const document = parse('{"a": 1}');
		documentRemove(document, ['a']);
		expect(document.text).toBe('{}');
	});

	test('remove first property (minified)', () => {
		const document = parse('{"a":1,"b":2,"c":3}');
		documentRemove(document, ['a']);
		expect(document.text).toBe('{"b":2,"c":3}');
	});

	test('remove middle property (minified)', () => {
		const document = parse('{"a":1,"b":2,"c":3}');
		documentRemove(document, ['b']);
		expect(document.text).toBe('{"a":1,"c":3}');
	});

	test('remove last property (minified)', () => {
		const document = parse('{"a":1,"b":2,"c":3}');
		documentRemove(document, ['c']);
		expect(document.text).toBe('{"a":1,"b":2}');
	});

	test('remove only property (formatted)', () => {
		const input = [
			'{',
			'  "a": 1',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['a']);
		expect(document.text).toBe('{}');
	});

	test('remove first property (formatted)', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2,',
			'  "c": 3',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['a']);
		const expected = [
			'{',
			'  "b": 2,',
			'  "c": 3',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('remove middle property (formatted)', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2,',
			'  "c": 3',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['b']);
		const expected = [
			'{',
			'  "a": 1,',
			'  "c": 3',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('remove last property (formatted)', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2,',
			'  "c": 3',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['c']);
		const expected = [
			'{',
			'  "a": 1,',
			'  "b": 2',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('remove nested property', () => {
		const input = [
			'{',
			'  "scripts": {',
			'    "build": "tsc",',
			'    "test": "vitest"',
			'  }',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['scripts', 'build']);
		const expected = [
			'{',
			'  "scripts": {',
			'    "test": "vitest"',
			'  }',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('remove non-existent property is no-op', () => {
		const input = '{"a": 1}';
		const document = parse(input);
		documentRemove(document, ['b']);
		expect(document.text).toBe('{"a": 1}');
	});

	test('remove then set', () => {
		const document = parse('{"a": 1, "b": 2}');
		documentRemove(document, ['a']);
		documentSet(document, ['c'], 3);
		const result = JSON.parse(document.text);
		expect(result.a).toBeUndefined();
		expect(result.b).toBe(2);
		expect(result.c).toBe(3);
	});

	test('remove with trailing comma (JSONC)', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2,',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['b']);
		const result = document.text;
		// Should still be valid JSONC
		expect(result).toContain('"a": 1');
		expect(result).not.toContain('"b"');
	});

	test('remove from two-property object leaves single property', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['a']);
		const expected = [
			'{',
			'  "b": 2',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('multiple removes', () => {
		const document = parse('{"a":1,"b":2,"c":3}');
		documentRemove(document, ['a']);
		documentRemove(document, ['c']);
		expect(document.text).toBe('{"b":2}');
	});

	test('remove first member removes its leading comment', () => {
		const input = '{\n  // about a\n  "a": 1,\n  "b": 2\n}';
		const document = parse(input);
		documentRemove(document, ['a']);
		const result = document.text;
		expect(result).not.toContain('about a');
		expect(result).toContain('"b": 2');
	});

	test('remove only member preserves container header (blank line)', () => {
		const input = '{\n  // --- Global Settings ---\n\n  "theme": "dark"\n}';
		const document = parse(input);
		documentRemove(document, ['theme']);
		const result = document.text;
		// Container header (separated by blank line) should be preserved
		expect(result).toContain('Global Settings');
	});

	test('remove middle member removes its leading comment', () => {
		const input = '{\n  "a": 1,\n  // about b\n  "b": 2,\n  "c": 3\n}';
		const document = parse(input);
		documentRemove(document, ['b']);
		const result = document.text;
		expect(result).not.toContain('about b');
		expect(result).toContain('"a": 1');
		expect(result).toContain('"c": 3');
	});
});
