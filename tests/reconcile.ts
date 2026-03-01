import { describe, test, expect } from 'manten';
import {
	parse, stringify, sortKeys, rename,
} from '../src/index.ts';

describe('reconcile', () => {
	// M1: Primitives
	describe('M1: primitives', () => {
		test('change primitive value', () => {
			const pkg = parse('{"a": 1, "b": "hello"}');
			pkg.a = 2;
			pkg.b = 'world';
			expect(stringify(pkg)).toBe('{"a": 2, "b": "world"}');
		});

		test('no-op returns original text exactly', () => {
			const text = '{\n  "a": 1,\n  "b": 2\n}';
			expect(stringify(parse(text))).toBe(text);
		});

		test('unchanged siblings preserve formatting', () => {
			const pkg = parse('{\n  "a": 1,\n  "b": 2\n}');
			pkg.a = 10;
			expect(stringify(pkg)).toBe('{\n  "a": 10,\n  "b": 2\n}');
		});
	});

	// M2: Add and remove
	describe('M2: add and remove', () => {
		test('add new property', () => {
			const pkg = parse('{\n  "a": 1\n}');
			pkg.b = 2;
			expect(stringify(pkg)).toBe('{\n  "a": 1,\n  "b": 2\n}');
		});

		test('remove property', () => {
			const pkg = parse('{"a": 1, "b": 2, "c": 3}');
			delete pkg.b;
			expect(stringify(pkg)).toBe('{"a": 1, "c": 3}');
		});

		test('add and remove in same stringify', () => {
			const pkg = parse('{"a": 1, "b": 2}');
			delete pkg.a;
			pkg.c = 3;
			expect(JSON.parse(stringify(pkg))).toEqual({
				b: 2,
				c: 3,
			});
		});
	});

	// M3: Nested objects
	describe('M3: nested objects', () => {
		test('nested value change', () => {
			const pkg = parse('{"a": {"b": 1}}');
			pkg.a.b = 2;
			expect(JSON.parse(stringify(pkg))).toEqual({ a: { b: 2 } });
		});

		test('deeply nested change preserves surrounding text', () => {
			const pkg = parse('{\n  "config": {\n    "debug": false,\n    "port": 3000\n  }\n}');
			pkg.config.port = 8080;
			const result = stringify(pkg);
			expect(result).toContain('"debug": false');
			expect(result).toContain('"port": 8080');
		});

		test('replace entire subtree', () => {
			const pkg = parse('{"config": {"old": true}}');
			pkg.config = { new: true };
			expect(JSON.parse(stringify(pkg))).toEqual({ config: { new: true } });
		});
	});

	// M4: Arrays
	describe('M4: arrays', () => {
		test('change array element', () => {
			const pkg = parse('{"items": [1, 2, 3]}');
			pkg.items[1] = 99;
			expect(JSON.parse(stringify(pkg)).items).toEqual([1, 99, 3]);
		});

		test('push to array', () => {
			const pkg = parse('{\n  "items": [\n    1,\n    2\n  ]\n}');
			pkg.items.push(3);
			expect(stringify(pkg)).toBe('{\n  "items": [\n    1,\n    2,\n    3\n  ]\n}');
		});

		test('splice remove', () => {
			const pkg = parse('{"items": [1, 2, 3]}');
			pkg.items.splice(1, 1);
			expect(stringify(pkg)).toBe('{"items": [1, 3]}');
		});

		test('empty array push', () => {
			const pkg = parse('{"items": []}');
			pkg.items.push(1);
			expect(JSON.parse(stringify(pkg)).items).toEqual([1]);
		});

		test('Array.isArray works', () => {
			const pkg = parse('{"items": [1]}');
			expect(Array.isArray(pkg.items)).toBe(true);
		});
	});

	// M5: JSONC
	describe('M5: JSONC', () => {
		test('line comment preserved', () => {
			const pkg = parse('{\n  // comment\n  "a": 1\n}');
			pkg.a = 2;
			const result = stringify(pkg);
			expect(result).toContain('// comment');
			expect(result).toContain('"a": 2');
		});

		test('block comment between key and value', () => {
			const pkg = parse('{"key": /* important */ "old"}');
			pkg.key = 'new';
			expect(stringify(pkg)).toBe('{"key": /* important */ "new"}');
		});

		test('trailing comma preserved', () => {
			const pkg = parse('{\n  "a": 1,\n  "b": 2,\n}');
			pkg.a = 10;
			expect(stringify(pkg)).toContain('"a": 10,');
		});

		test('inline comment on same line preserved', () => {
			const pkg = parse('{\n  "port": 3000 // default\n}');
			pkg.port = 8080;
			expect(stringify(pkg)).toContain('"port": 8080 // default');
		});

		test('remove property with leading comment removes comment', () => {
			const pkg = parse('{\n  "a": 1,\n  // about b\n  "b": 2\n}');
			delete pkg.b;
			expect(stringify(pkg)).not.toContain('about b');
		});
	});

	// M6: sortKeys and rename
	describe('M6: sortKeys and rename', () => {
		test('sortKeys basic', () => {
			const pkg = parse('{"b": 2, "a": 1}');
			sortKeys(pkg);
			expect(Object.keys(JSON.parse(stringify(pkg)))).toEqual(['a', 'b']);
		});

		test('sortKeys preserves comments', () => {
			const pkg = parse('{\n  // about b\n  "b": 2,\n  // about a\n  "a": 1\n}');
			sortKeys(pkg);
			const result = stringify(pkg);
			expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"b"'));
			expect(result).toContain('// about a');
			expect(result).toContain('// about b');
		});

		test('sortKeys respects blank-line groups', () => {
			const pkg = parse('{\n  "b": 1,\n  "a": 2,\n\n  "d": 3,\n  "c": 4\n}');
			sortKeys(pkg);
			const keys = Object.keys(JSON.parse(stringify(pkg)));
			expect(keys).toEqual(['a', 'b', 'c', 'd']);
		});

		test('sortKeys nested', () => {
			const pkg = parse('{"deps": {"z": 1, "a": 2}}');
			sortKeys(pkg.deps);
			expect(Object.keys(JSON.parse(stringify(pkg)).deps)).toEqual(['a', 'z']);
		});

		test('sort → add → sort → rename preserves interleaved order', () => {
			const pkg = parse('{"c": 3, "a": 1}');
			sortKeys(pkg);
			pkg.b = 2;
			sortKeys(pkg);
			rename(pkg, 'c', 'cc');
			expect(Object.keys(JSON.parse(stringify(pkg)))).toEqual(['a', 'b', 'cc']);
		});

		test('sort → add → sort → rename with lexical position change', () => {
			const pkg = parse('{"b": 2, "c": 3}');
			sortKeys(pkg);
			pkg.a = 1;
			sortKeys(pkg);
			rename(pkg, 'a', 'z');
			// Sort puts a first, rename a→z keeps position → [z, b, c]
			expect(Object.keys(JSON.parse(stringify(pkg)))).toEqual(['z', 'b', 'c']);
		});

		test('sortKeys then rename preserves call order', () => {
			const pkg = parse('{"k0": 0, "k1": 1, "k2": 2}');
			sortKeys(pkg);
			rename(pkg, 'k1', 'r4');
			// Sort first (k0,k1,k2), then rename k1→r4 in place → k0,r4,k2
			const result = Object.keys(JSON.parse(stringify(pkg)));
			expect(result).toEqual(['k0', 'r4', 'k2']);
		});

		test('rename then sortKeys preserves call order', () => {
			const pkg = parse('{"b": 2, "a_old": 1}');
			rename(pkg, 'a_old', 'a');
			sortKeys(pkg);
			// Rename first, then sort → a,b
			const result = Object.keys(JSON.parse(stringify(pkg)));
			expect(result).toEqual(['a', 'b']);
		});

		test('rename preserves value', () => {
			const pkg = parse('{"old": 1, "other": 2}');
			rename(pkg, 'old', 'new');
			expect(JSON.parse(stringify(pkg))).toEqual({
				new: 1,
				other: 2,
			});
		});

		test('rename preserves formatting', () => {
			const pkg = parse('{\n  "build": "tsc",\n  "test": "vitest"\n}');
			rename(pkg, 'build', 'compile');
			const result = stringify(pkg);
			expect(result).toContain('"compile": "tsc"');
			expect(result).toContain('"test": "vitest"');
		});
	});

	// M7: Interop and edge cases
	describe('M7: interop and edge cases', () => {
		test('Object.assign', () => {
			const pkg = parse('{\n  "a": 1,\n  "b": 2\n}');
			Object.assign(pkg, {
				a: 10,
				c: 3,
			});
			expect(JSON.parse(stringify(pkg))).toEqual({
				a: 10,
				b: 2,
				c: 3,
			});
		});

		test('spread and destructuring', () => {
			const pkg = parse('{"a": 1, "b": 2}');
			expect({ ...pkg }).toEqual({
				a: 1,
				b: 2,
			});
			const { a } = pkg;
			expect(a).toBe(1);
		});

		test('for...of on arrays', () => {
			const items: number[] = [];
			for (const x of parse('[1, 2, 3]')) {
				items.push(x);
			}
			expect(items).toEqual([1, 2, 3]);
		});

		test('mixed operations', () => {
			const text = '{\n  "name": "app",\n  "version": "1.0.0",\n  "deps": {\n    "z": "^1",\n    "a": "^2"\n  }\n}';
			const pkg = parse(text);
			pkg.version = '2.0.0';
			pkg.deps.b = '^3';
			sortKeys(pkg.deps);
			const result = stringify(pkg);
			expect(result).toContain('"version": "2.0.0"');
			expect(result).toContain('"name": "app"');
			expect(Object.keys(JSON.parse(result).deps)).toEqual(['a', 'b', 'z']);
		});

		test('inline object stays inline', () => {
			const pkg = parse('{\n  "scripts": {"build": "tsc"}\n}');
			pkg.scripts.test = 'vitest';
			expect(stringify(pkg)).toContain('{"build": "tsc", "test": "vitest"}');
		});

		test('colon spacing matches existing', () => {
			const pkg = parse('{"a":1}');
			pkg.b = 2;
			expect(stringify(pkg)).toBe('{"a":1,"b":2}');
		});

		test('indent matches existing', () => {
			const pkg = parse('{\n    "a": 1\n}');
			pkg.b = 2;
			expect(stringify(pkg)).toMatch(/^ {4}"b"/m);
		});

		test('multiple stringify calls are idempotent', () => {
			const pkg = parse('{"a": 1}');
			pkg.a = 2;
			const first = stringify(pkg);
			const second = stringify(pkg);
			expect(first).toBe(second);
		});

		test('Date value follows JSON.stringify semantics across calls', () => {
			const pkg = parse('{"d":"2020-01-01T00:00:00.000Z"}');
			pkg.d = new Date('2021-01-01T00:00:00.000Z');
			expect(JSON.parse(stringify(pkg)).d).toBe('2021-01-01T00:00:00.000Z');

			pkg.d.setUTCFullYear(2022);
			expect(JSON.parse(stringify(pkg)).d).toBe('2022-01-01T00:00:00.000Z');

			const first = stringify(pkg);
			const second = stringify(pkg);
			expect(second).toBe(first);
		});

		test('array sort values correct', () => {
			const pkg = parse('{"items": ["c", "a", "b"]}');
			pkg.items.sort();
			expect(JSON.parse(stringify(pkg)).items).toEqual(['a', 'b', 'c']);
		});

		test('array reverse values correct', () => {
			const array = parse('[1, 2, 3]');
			array.reverse();
			expect(JSON.parse(stringify(array))).toEqual([3, 2, 1]);
		});

		test('deeply nested edit', () => {
			const pkg = parse('{"a": {"b": {"c": 1}}}');
			pkg.a.b.c = 2;
			expect(JSON.parse(stringify(pkg))).toEqual({ a: { b: { c: 2 } } });
		});

		test('replace entire subtree', () => {
			const pkg = parse('{"config": {"old": true}}');
			pkg.config = { new: true };
			expect(JSON.parse(stringify(pkg))).toEqual({ config: { new: true } });
		});

		test('empty object add', () => {
			const pkg = parse('{}');
			pkg.a = 1;
			expect(JSON.parse(stringify(pkg))).toEqual({ a: 1 });
		});

		test('parsed objects have normal prototype methods', () => {
			const pkg = parse('{"name": "test"}');
			expect(pkg instanceof Object).toBe(true);
			// eslint-disable-next-line no-prototype-builtins
			expect(pkg.hasOwnProperty('name')).toBe(true);
			expect(typeof pkg.toString).toBe('function');
		});

		/* eslint-disable no-proto */
		test('__proto__ key is a normal own property', () => {
			const pkg = parse('{"__proto__": 5, "a": 1}');
			expect(Object.keys(pkg)).toContain('__proto__');
			expect(pkg.__proto__).toBe(5);
			expect(pkg.a).toBe(1);
		});

		test('__proto__ object does not pollute prototype', () => {
			const pkg = parse('{"__proto__": {"polluted": 123}}');
			expect('polluted' in pkg).toBe(false);
			expect(pkg.__proto__.polluted).toBe(123);
		});

		test('__proto__ value round-trips through stringify', () => {
			const pkg = parse('{"__proto__": 5}');
			pkg.__proto__ = 10;
			expect(JSON.parse(stringify(pkg)).__proto__).toBe(10);
		});
		/* eslint-enable no-proto */
	});

	describe('object key reorder detection', () => {
		test('manual key reorder changes output order', () => {
			const pkg = parse('{"b": 2, "a": 1, "c": 3}');
			const copy = { ...pkg };
			for (const k of Object.keys(pkg)) { delete pkg[k]; }
			pkg.a = copy.a;
			pkg.b = copy.b;
			pkg.c = copy.c;
			expect(Object.keys(JSON.parse(stringify(pkg)))).toEqual(['a', 'b', 'c']);
		});

		test('add key + reorder preserves both', () => {
			const pkg = parse('{"b": 2, "a": 1}');
			const copy = { ...pkg };
			for (const k of Object.keys(pkg)) { delete pkg[k]; }
			pkg.a = copy.a;
			pkg.c = 3;
			pkg.b = copy.b;
			expect(Object.keys(JSON.parse(stringify(pkg)))).toEqual(['a', 'c', 'b']);
		});

		test('remove key + reorder preserves both', () => {
			const pkg = parse('{"c": 3, "b": 2, "a": 1}');
			delete pkg.b;
			const copy = { ...pkg };
			for (const k of Object.keys(pkg)) { delete pkg[k]; }
			pkg.a = copy.a;
			pkg.c = copy.c;
			expect(Object.keys(JSON.parse(stringify(pkg)))).toEqual(['a', 'c']);
		});

		test('key reorder preserves comments', () => {
			const pkg = parse('{\n  // about b\n  "b": 2,\n  // about a\n  "a": 1\n}');
			const copy = { ...pkg };
			for (const k of Object.keys(pkg)) { delete pkg[k]; }
			pkg.a = copy.a;
			pkg.b = copy.b;
			const result = stringify(pkg);
			expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"b"'));
			expect(result).toContain('// about a');
			expect(result).toContain('// about b');
		});
	});

	describe('array permutation detection', () => {
		test('sort preserves per-element comments', () => {
			const pkg = parse('{\n  "items": [\n    "c", // third\n    "a", // first\n    "b" // second\n  ]\n}');
			pkg.items.sort();
			const result = stringify(pkg);
			// Comments should travel with their values
			expect(result).toContain('"a", // first');
			expect(result).toContain('"b", // second');
			expect(result).toContain('"c" // third');
		});

		test('reverse preserves per-element formatting', () => {
			const pkg = parse('[\n  {"id": 1, "name": "first"},\n  {"id": 2, "name": "second"},\n  {"id": 3, "name": "third"}\n]');
			pkg.reverse();
			const result = stringify(pkg);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual([
				{
					id: 3,
					name: 'third',
				},
				{
					id: 2,
					name: 'second',
				},
				{
					id: 1,
					name: 'first',
				},
			]);
		});

		test('reverse objects preserves per-element comments', () => {
			const pkg = parse('[\n  {"id": 1}, // first\n  {"id": 2}, // second\n  {"id": 3} // third\n]');
			pkg.reverse();
			const result = stringify(pkg);
			expect(result).toContain('{"id": 3}, // third');
			expect(result).toContain('{"id": 2}, // second');
			expect(result).toContain('{"id": 1} // first');
		});

		test('sort + modify falls back to element-by-element (values correct)', () => {
			const pkg = parse('[{"id": 3}, {"id": 1}, {"id": 2}]');
			pkg.sort((a: Record<string, number>, b: Record<string, number>) => a.id - b.id);
			pkg[0].id = 10;
			const result = JSON.parse(stringify(pkg));
			expect(result).toEqual([{ id: 10 }, { id: 2 }, { id: 3 }]);
		});

		test('duplicate content objects in array reverse correctly', () => {
			const pkg = parse('[{"id": 1}, {"id": 1}, {"id": 2}]');
			pkg.reverse();
			expect(JSON.parse(stringify(pkg))).toEqual([{ id: 2 }, { id: 1 }, { id: 1 }]);
		});

		test('sort objects by field preserves element text', () => {
			const pkg = parse('{\n  "users": [\n    {"name": "Charlie", "age": 30},\n    {"name": "Alice", "age": 25},\n    {"name": "Bob", "age": 35}\n  ]\n}');
			pkg.users.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
				const an = a.name as string;
				const bn = b.name as string;
				return an < bn ? -1 : (an > bn ? 1 : 0);
			});
			const result = stringify(pkg);
			const parsed = JSON.parse(result);
			expect(parsed.users.map((u: Record<string, unknown>) => u.name)).toEqual(['Alice', 'Bob', 'Charlie']);
		});

		test('repeated reverse preserves comments across stringifys', () => {
			const pkg = parse('[\n  {"id": 1}, // one\n  {"id": 2}, // two\n  {"id": 3} // three\n]');
			pkg.reverse();
			stringify(pkg);
			pkg.reverse();
			const result = stringify(pkg);
			expect(result).toContain('{"id": 1}, // one');
			expect(result).toContain('{"id": 2}, // two');
			expect(result).toContain('{"id": 3} // three');
		});

		test('sortKeys on number array matches text output', () => {
			const pkg = parse('[10, 2, 1]');
			sortKeys(pkg);
			const jsOrder = [...pkg];
			const textOrder = JSON.parse(stringify(pkg));
			expect(jsOrder).toEqual(textOrder);
		});
	});

	describe('non-plain object handling', () => {
		test('Date mutation detected across stringifys', () => {
			const pkg = parse('{"d": "placeholder"}');
			pkg.d = new Date('2020-01-01T00:00:00.000Z');
			const first = JSON.parse(stringify(pkg)).d;
			expect(first).toBe('2020-01-01T00:00:00.000Z');
			pkg.d.setUTCFullYear(2021);
			const second = JSON.parse(stringify(pkg)).d;
			expect(second).toBe('2021-01-01T00:00:00.000Z');
		});

		test('toJSON returning undefined omits key', () => {
			const pkg = parse('{"a": 1, "b": 2}');
			pkg.a = { toJSON: () => undefined };
			const result = JSON.parse(stringify(pkg));
			expect(result).toEqual({ b: 2 });
			expect('a' in result).toBe(false);
		});
	});

	describe('nestedToRoot freshness', () => {
		test('sortKeys on newly-assigned subtree works', () => {
			const pkg = parse('{"config": {}}');
			pkg.config = {
				z: 1,
				a: 2,
			};
			stringify(pkg); // reconciles, but walkTree doesn't refresh nestedToRoot
			sortKeys(pkg.config); // needs findRoot to locate pkg.config
			expect(Object.keys(JSON.parse(stringify(pkg)).config)).toEqual(['a', 'z']);
		});
	});

	describe('error handling', () => {
		test('sortKeys with throwing comparator does not leave stale ops', () => {
			const pkg = parse('{"b": 2, "a": 1}');
			try {
				sortKeys(pkg, () => { throw new Error('boom'); });
			} catch {
				// Expected
			}
			// stringify should work cleanly — no stale op
			expect(JSON.parse(stringify(pkg))).toEqual({
				b: 2,
				a: 1,
			});
		});

		test('rename on non-parsed object throws TypeError', () => {
			expect(() => rename({} as never, 'a', 'b')).toThrow(TypeError);
		});

		test('rename on non-parsed object with matching keys throws TypeError', () => {
			expect(() => rename({ a: 1 } as never, 'a', 'b')).toThrow(TypeError);
		});
	});
});
