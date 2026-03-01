import { describe, test, expect } from 'manten';
import type { JsonValue } from '../src/types.ts';
import { createDocument } from '../src/doc/types.ts';
import { documentSet } from '../src/doc/set.ts';
import { documentPush } from '../src/doc/arrays.ts';

const parse = createDocument;

describe('validation', () => {
	test('Date value serializes via toJSON (matches JSON.stringify)', () => {
		const document = parse('{"a": 1}');
		const date = new Date('2024-01-01T00:00:00.000Z');
		documentSet(document, ['a'], date as unknown as JsonValue);
		expect(JSON.parse(document.text).a).toBe('2024-01-01T00:00:00.000Z');
	});

	test('undefined value serializes as null (matches JSON.stringify)', () => {
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], undefined as unknown as JsonValue);
		expect(JSON.parse(document.text).a).toBeNull();
	});

	test('Function value serializes as null (matches JSON.stringify)', () => {
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], (() => {}) as unknown as JsonValue);
		expect(JSON.parse(document.text).a).toBeNull();
	});

	test('object with own "constructor" property is valid JSON', () => {
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], {
			constructor: 1,
			x: 2,
		} as unknown as JsonValue);
		const parsed = JSON.parse(document.text);
		expect(parsed.a).toEqual({
			constructor: 1,
			x: 2,
		});
	});

	test('object with constructor: null is valid JSON', () => {
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], { constructor: null } as unknown as JsonValue);
		expect(JSON.parse(document.text).a).toEqual({ constructor: null });
	});

	test('circular reference throws clear error', () => {
		const v: Record<string, unknown> = { x: 1 };
		v.self = v;
		const document = parse('{"a": 1}');
		expect(() => documentSet(document, ['a'], v as unknown as JsonValue)).toThrow(TypeError);
	});

	test('sparse array serializes with null for empty slots', () => {
		const sparse: unknown[] = [];
		sparse[0] = 1;
		sparse[2] = 3;
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], sparse as JsonValue);
		// Should produce [1, null, 3] like JSON.stringify
		const result = document.text;
		expect(JSON.parse(result).a).toEqual([1, null, 3]);
	});

	test('shared object references are not treated as circular', () => {
		const shared = { x: 1 };
		const document = parse('{"v": 0}');
		documentSet(document, ['v'], {
			a: shared,
			b: shared,
		});
		const parsed = JSON.parse(document.text);
		expect(parsed.v.a).toEqual({ x: 1 });
		expect(parsed.v.b).toEqual({ x: 1 });
	});

	test('NaN produces null in JSON output', () => {
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], Number.NaN);
		// NaN is not valid JSON — should serialize as null (JSON.stringify behavior)
		expect(document.text).toBe('{"a": null}');
	});

	test('Infinity produces null in JSON output', () => {
		const document = parse('{"a": 1}');
		documentSet(document, ['a'], Infinity);
		expect(document.text).toBe('{"a": null}');
	});

	test('set with missing numeric segment does not write wrong structure', () => {
		const document = parse('{}');
		documentSet(document, ['users', 0], 'Alice');
		// Number segment 0 in intermediate path is unsupported — should be no-op
		// Must NOT produce {"users": "Alice"} (wrong: dropped the array layer)
		const result = document.text;
		expect(result).toBe('{}');
	});

	test('duplicate keys: set updates last occurrence (JSON.parse semantics)', () => {
		const document = parse('{"a":1,"a":2}');
		documentSet(document, ['a'], 99);
		// JSON.parse uses last-key-wins, so set should update the last "a"
		expect(JSON.parse(document.text).a).toBe(99);
	});

	test('push with undefined serializes as null (matches JSON.stringify)', () => {
		const document = parse('{"arr":[]}');
		documentPush(document, ['arr'], 1, undefined as unknown as JsonValue);
		expect(JSON.parse(document.text).arr).toEqual([1, null]);
	});

	test('push is atomic: bigint failure rolls back', () => {
		const document = parse('{"arr":[]}');
		const before = document.text;
		try {
			documentPush(document, ['arr'], 1, 2n as unknown as JsonValue);
		} catch {
			// Expected to throw on BigInt
		}
		// Should not have partially committed the 1
		expect(document.text).toBe(before);
	});
});
