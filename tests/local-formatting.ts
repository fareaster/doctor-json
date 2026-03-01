import { describe, test, expect } from 'manten';
import { createDocument } from '../src/doc/types.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentRemove } from '../src/doc/remove.ts';

const parse = createDocument;

describe('local formatting detection', () => {
	test('insert into inline object within formatted document', () => {
		const input = [
			'{',
			'  "scripts": {"build": "tsc", "test": "vitest"},',
			'  "name": "pkg"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['scripts', 'lint'], 'eslint');
		const result = document.text;
		// scripts object is inline - new member should be inline too
		expect(result).toContain('{"build": "tsc", "test": "vitest", "lint": "eslint"}');
	});

	test('insert into multiline object within formatted document', () => {
		const input = [
			'{',
			'  "scripts": {',
			'    "build": "tsc",',
			'    "test": "vitest"',
			'  },',
			'  "name": "pkg"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['scripts', 'lint'], 'eslint');
		const expected = [
			'{',
			'  "scripts": {',
			'    "build": "tsc",',
			'    "test": "vitest",',
			'    "lint": "eslint"',
			'  },',
			'  "name": "pkg"',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('insert into minified object within minified document', () => {
		const document = parse('{"scripts":{"build":"tsc"}}');
		documentSet(document, ['scripts', 'test'], 'vitest');
		expect(document.text).toBe('{"scripts":{"build":"tsc","test":"vitest"}}');
	});

	test('insert into inline empty object within formatted document', () => {
		const input = [
			'{',
			'  "scripts": {},',
			'  "name": "pkg"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['scripts', 'build'], 'tsc');
		const result = document.text;
		// Empty inline object - adding first member should stay inline
		expect(result).toContain('"scripts": {"build": "tsc"}');
	});

	test('insert into multiline empty object within formatted document', () => {
		const input = [
			'{',
			'  "scripts": {',
			'  },',
			'  "name": "pkg"',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['scripts', 'build'], 'tsc');
		const result = document.text;
		// Multiline empty object - should add formatted
		expect(result).toContain('"build": "tsc"');
	});

	test('detect colon spacing from existing members', () => {
		// Existing members use no space after colon
		const input = [
			'{',
			'  "a":1,',
			'  "b":2',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['c'], 3);
		const result = document.text;
		// New member should match existing style: no space after colon
		expect(result).toContain('"c":3');
	});

	test('detect space-after-colon from existing members', () => {
		const input = [
			'{',
			'  "a": 1,',
			'  "b": 2',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['c'], 3);
		const result = document.text;
		// Standard style: space after colon
		expect(result).toContain('"c": 3');
	});

	test('serialize new object value matching inline sibling style', () => {
		const input = [
			'{',
			'  "dev": {"port": 3000},',
			'  "prod": {"port": 8080}',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['staging'], { port: 4000 });
		const result = document.text;
		// Sibling objects are inline, so the new one should be too
		expect(result).toContain('"staging": {"port": 4000}');
	});

	test('serialize new object value matching multiline sibling style', () => {
		const input = [
			'{',
			'  "dev": {',
			'    "port": 3000',
			'  },',
			'  "prod": {',
			'    "port": 8080',
			'  }',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['staging'], { port: 4000 });
		const result = document.text;
		const parsed = JSON.parse(result);
		expect(parsed.staging.port).toBe(4000);
		// Should be formatted multi-line like siblings
		expect(result).toMatch(/^\s+"port": 4000$/m);
	});

	test('update inline object value preserves inline format', () => {
		const input = [
			'{',
			'  "config": {"debug": true, "verbose": false}',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['config'], {
			debug: false,
			verbose: true,
		});
		const result = document.text;
		expect(result).toContain('{"debug": false, "verbose": true}');
	});

	test('update multiline object value preserves multiline format', () => {
		const input = [
			'{',
			'  "config": {',
			'    "debug": true',
			'  }',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['config'], {
			debug: false,
			verbose: true,
		});
		const result = document.text;
		expect(result).toMatch(/^\s+"debug": false,$/m);
		expect(result).toMatch(/^\s+"verbose": true$/m);
	});

	test('update inline array preserves inline format', () => {
		const input = '{\n  "items": [1, 2, 3]\n}';
		const document = parse(input);
		documentSet(document, ['items'], [10, 20, 30]);
		expect(document.text).toBe('{\n  "items": [10, 20, 30]\n}');
	});

	test('detect indent from target object, not document', () => {
		const input = '{"a":{"b":{\n    "c": 1\n}}}';
		const document = parse(input);
		documentSet(document, ['a', 'b', 'd'], 2);
		expect(document.text).toBe('{"a":{"b":{\n    "c": 1,\n    "d": 2\n}}}');
	});

	test('inconsistent indentation across nested objects', () => {
		const input = '{\n  "outer": {\n      "inner": 1\n  }\n}';
		const document = parse(input);
		documentSet(document, ['outer', 'deep'], 2);
		// Should match "inner"'s 6-space indent, not the document's 2-space
		expect(document.text).toBe('{\n  "outer": {\n      "inner": 1,\n      "deep": 2\n  }\n}');
	});

	test('deeply nested with local indent detection', () => {
		const input = [
			'{',
			'  "a": {',
			'        "b": 1',
			'  }',
			'}',
		].join('\n');
		const document = parse(input);
		documentSet(document, ['a', 'c'], 2);
		const expected = [
			'{',
			'  "a": {',
			'        "b": 1,',
			'        "c": 2',
			'  }',
			'}',
		].join('\n');
		expect(document.text).toBe(expected);
	});

	test('add complex value respects local indent unit', () => {
		const input = '{"wrapper":{\n    "existing": 1\n}}';
		const document = parse(input);
		documentSet(document, ['wrapper', 'nested'], {
			x: 1,
			y: 2,
		});
		const result = document.text;
		// Inner object should use the 4-space indent unit from the wrapper
		expect(result).toContain('"nested": {\n        "x": 1,\n        "y": 2\n    }');
	});

	test('remove from inline object preserves inline format', () => {
		const input = [
			'{',
			'  "scripts": {"build": "tsc", "test": "vitest", "lint": "eslint"},',
			'  "name": "pkg"',
			'}',
		].join('\n');
		const document = parse(input);
		documentRemove(document, ['scripts', 'test']);
		const result = document.text;
		expect(result).toContain('{"build": "tsc", "lint": "eslint"}');
	});
});
