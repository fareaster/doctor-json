import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';

const parse = createDocument;

describe('get', () => {
	test('string property', () => {
		const document = parse('{"name": "hello"}');
		expect(documentGet(document, ['name'])).toBe('hello');
	});

	test('number property', () => {
		const document = parse('{"count": 42}');
		expect(documentGet(document, ['count'])).toBe(42);
	});

	test('boolean property', () => {
		const document = parse('{"enabled": true}');
		expect(documentGet(document, ['enabled'])).toBe(true);
	});

	test('null property', () => {
		const document = parse('{"value": null}');
		expect(documentGet(document, ['value'])).toBeNull();
	});

	test('object property', () => {
		const document = parse('{"obj": {"a": 1}}');
		expect(documentGet(document, ['obj'])).toEqual({ a: 1 });
	});

	test('array property', () => {
		const document = parse('{"arr": [1, 2, 3]}');
		expect(documentGet(document, ['arr'])).toEqual([1, 2, 3]);
	});

	test('nested property with array path', () => {
		const document = parse('{"a": {"b": {"c": "deep"}}}');
		expect(documentGet(document, ['a', 'b', 'c'])).toBe('deep');
	});

	test('array element by index', () => {
		const document = parse('{"items": ["a", "b", "c"]}');
		expect(documentGet(document, ['items', 1])).toBe('b');
	});

	test('non-existent property returns undefined', () => {
		const document = parse('{"name": "hello"}');
		expect(documentGet(document, ['missing'])).toBeUndefined();
	});

	test('non-existent nested path returns undefined', () => {
		const document = parse('{"a": {"b": 1}}');
		expect(documentGet(document, ['a', 'c', 'd'])).toBeUndefined();
	});

	test('path through non-object returns undefined', () => {
		const document = parse('{"a": "string"}');
		expect(documentGet(document, ['a', 'b'])).toBeUndefined();
	});

	test('array index out of bounds returns undefined', () => {
		const document = parse('{"items": [1, 2]}');
		expect(documentGet(document, ['items', 5])).toBeUndefined();
	});
});
