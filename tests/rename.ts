import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentGet } from '../src/doc/get.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentRename } from '../src/doc/rename.ts';

const parse = createDocument;

describe('rename', () => {
	test('rename a property key', () => {
		const document = parse('{"old": 1}');
		documentRename(document, ['old'], 'new');
		expect(document.text).toBe('{"new": 1}');
	});

	test('rename preserves value exactly', () => {
		const document = parse('{"old": {"nested": true}}');
		documentRename(document, ['old'], 'new');
		expect(document.text).toBe('{"new": {"nested": true}}');
	});

	test('rename preserves whitespace around colon', () => {
		const document = parse('{"old" : 1}');
		documentRename(document, ['old'], 'new');
		expect(document.text).toBe('{"new" : 1}');
	});

	test('rename preserves inline comment after value', () => {
		const document = parse('{\n  "old": 1 // note\n}');
		documentRename(document, ['old'], 'new');
		expect(document.text).toBe('{\n  "new": 1 // note\n}');
	});

	test('rename preserves leading comment above member', () => {
		const document = parse('{\n  // about this\n  "old": 1\n}');
		documentRename(document, ['old'], 'new');
		const result = document.text;
		expect(result).toContain('// about this');
		expect(result).toContain('"new": 1');
	});

	test('rename non-existent path is no-op', () => {
		const document = parse('{"a": 1}');
		documentRename(document, ['missing'], 'new');
		expect(document.text).toBe('{"a": 1}');
	});

	test('rename array element is no-op', () => {
		const document = parse('{"items": [1, 2]}');
		documentRename(document, ['items', 0], 'new');
		expect(document.text).toBe('{"items": [1, 2]}');
	});

	test('rename is chainable', () => {
		const document = parse('{"old": 1}');
		documentRename(document, ['old'], 'new');
		documentSet(document, ['new'], 42);
		expect(document.text).toBe('{"new": 42}');
	});

	test('rename nested property', () => {
		const document = parse('{"config": {"oldKey": 1}}');
		documentRename(document, ['config', 'oldKey'], 'newKey');
		expect(document.text).toBe('{"config": {"newKey": 1}}');
	});

	test('rename to key with special characters', () => {
		const document = parse('{"old": 1}');
		documentRename(document, ['old'], 'hello world');
		expect(document.text).toBe('{"hello world": 1}');
	});

	test('rename preserves other members', () => {
		const document = parse('{"a": 1, "old": 2, "c": 3}');
		documentRename(document, ['old'], 'new');
		expect(document.text).toBe('{"a": 1, "new": 2, "c": 3}');
	});

	test('get works with new key after rename', () => {
		const document = parse('{"old": 42}');
		documentRename(document, ['old'], 'new');
		expect(documentGet(document, ['new'])).toBe(42);
		expect(documentGet(document, ['old'])).toBeUndefined();
	});

	test('rename with longer key name', () => {
		const document = parse('{"a": 1}');
		documentRename(document, ['a'], 'longKeyName');
		expect(document.text).toBe('{"longKeyName": 1}');
	});

	test('rename to existing key is no-op', () => {
		const document = parse('{"a": 1, "b": 2}');
		documentRename(document, ['a'], 'b');
		// Should not create duplicate keys
		expect(document.text).toBe('{"a": 1, "b": 2}');
	});

	test('rename with shorter key name', () => {
		const document = parse('{"longKeyName": 1}');
		documentRename(document, ['longKeyName'], 'a');
		expect(document.text).toBe('{"a": 1}');
	});
});
