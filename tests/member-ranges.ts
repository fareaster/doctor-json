import { describe, test, expect } from 'manten';
import { parse, type ObjectNode, type ArrayNode } from '@humanwhocodes/momoa';
import { findTokenIndex, getMemberRanges } from '../src/utils/member-ranges.ts';

describe('findTokenIndex', () => {
	test('finds token at exact offset', () => {
		const ast = parse('{"a": 1}', {
			mode: 'jsonc',
			tokens: true,
			ranges: true,
			allowTrailingCommas: true,
		});
		const tokens = ast.tokens!;
		// Token "a" starts at offset 1
		const index = findTokenIndex(tokens, 1);
		expect(tokens[index].loc.start.offset).toBe(1);
	});

	test('finds first token at or after offset', () => {
		const ast = parse('{"a": 1}', {
			mode: 'jsonc',
			tokens: true,
			ranges: true,
			allowTrailingCommas: true,
		});
		const tokens = ast.tokens!;
		// Offset 5 is after the colon — should find the Number token
		const index = findTokenIndex(tokens, 5);
		expect(tokens[index].type).toBe('Number');
	});

	test('returns tokens.length when offset is past all tokens', () => {
		const ast = parse('{"a": 1}', {
			mode: 'jsonc',
			tokens: true,
			ranges: true,
			allowTrailingCommas: true,
		});
		const tokens = ast.tokens!;
		const index = findTokenIndex(tokens, 999);
		expect(index).toBe(tokens.length);
	});
});

describe('getMemberRanges', () => {
	const getRanges = (text: string) => {
		const ast = parse(text, {
			mode: 'jsonc',
			tokens: true,
			ranges: true,
			allowTrailingCommas: true,
		});
		const node = ast.body as ObjectNode | ArrayNode;
		return {
			ranges: getMemberRanges(node, text, ast.tokens!),
			text,
			ast,
		};
	};

	test('basic object — correct number of ranges', () => {
		const { ranges } = getRanges('{\n  "a": 1,\n  "b": 2\n}');
		expect(ranges).toHaveLength(2);
	});

	test('commaOffset points to structural comma', () => {
		const { ranges, text } = getRanges('{"a": 1, "b": 2}');
		expect(ranges[0].commaOffset).not.toBeNull();
		expect(text[ranges[0].commaOffset!]).toBe(',');
		expect(ranges[1].commaOffset).toBeNull();
	});

	test('trailing inline comment included in range', () => {
		const { ranges, text } = getRanges('{\n  "a": 1, // note\n  "b": 2\n}');
		const aSlice = text.slice(ranges[0].start, ranges[0].end);
		expect(aSlice).toContain('// note');
	});

	test('leading own-line comment belongs to following member', () => {
		const { ranges, text } = getRanges('{\n  "a": 1,\n  // about b\n  "b": 2\n}');
		const bSlice = text.slice(ranges[1].start, ranges[1].end);
		expect(bSlice).toContain('// about b');
		const aSlice = text.slice(ranges[0].start, ranges[0].end);
		expect(aSlice).not.toContain('// about b');
	});

	test('container header excluded from member ranges', () => {
		const { ranges, text } = getRanges('{\n  // AUTO-GENERATED\n\n  "a": 1\n}');
		const aSlice = text.slice(ranges[0].start, ranges[0].end);
		expect(aSlice).not.toContain('AUTO-GENERATED');
	});

	test('dangling comment after last member excluded', () => {
		const { ranges, text } = getRanges('{\n  "a": 1\n  // footer\n}');
		const aSlice = text.slice(ranges[0].start, ranges[0].end);
		expect(aSlice).not.toContain('footer');
	});

	test('comma inside comment does not confuse commaOffset', () => {
		const { ranges, text } = getRanges('{"a": 1 /* x, y */, "b": 2}');
		expect(text[ranges[0].commaOffset!]).toBe(',');
		expect(ranges[0].commaOffset!).toBeGreaterThan(text.indexOf('*/'));
	});

	test('inline object returns ranges', () => {
		const { ranges } = getRanges('{"a": 1, "b": 2, "c": 3}');
		expect(ranges).toHaveLength(3);
		expect(ranges[0].commaOffset).not.toBeNull();
		expect(ranges[1].commaOffset).not.toBeNull();
		expect(ranges[2].commaOffset).toBeNull();
	});

	test('trailing comma detected on last member', () => {
		const { ranges } = getRanges('{\n  "a": 1,\n  "b": 2,\n}');
		expect(ranges[1].commaOffset).not.toBeNull();
	});

	test('works with arrays', () => {
		const { ranges, text } = getRanges('[\n  // first\n  1,\n  2\n]');
		expect(ranges).toHaveLength(2);
		const firstSlice = text.slice(ranges[0].start, ranges[0].end);
		expect(firstSlice).toContain('// first');
	});

	test('empty object returns empty ranges', () => {
		const { ranges } = getRanges('{}');
		expect(ranges).toHaveLength(0);
	});

	test('single member object', () => {
		const { ranges } = getRanges('{"a": 1}');
		expect(ranges).toHaveLength(1);
		expect(ranges[0].commaOffset).toBeNull();
	});

	test('multiple comments between members go to following member', () => {
		const { ranges, text } = getRanges('{\n  "a": 1,\n  // comment 1\n  // comment 2\n  "b": 2\n}');
		const bSlice = text.slice(ranges[1].start, ranges[1].end);
		expect(bSlice).toContain('// comment 1');
		expect(bSlice).toContain('// comment 2');
	});

	test('inline comment stays with member, own-line goes to next', () => {
		const { ranges, text } = getRanges('{\n  "a": 1, // inline\n  // leading b\n  "b": 2\n}');
		const aSlice = text.slice(ranges[0].start, ranges[0].end);
		const bSlice = text.slice(ranges[1].start, ranges[1].end);
		expect(aSlice).toContain('// inline');
		expect(aSlice).not.toContain('// leading b');
		expect(bSlice).toContain('// leading b');
	});

	test('block comment between key and value is inside member range', () => {
		const { ranges, text } = getRanges('{"a": /* note */ 1, "b": 2}');
		const aSlice = text.slice(ranges[0].start, ranges[0].end);
		expect(aSlice).toContain('/* note */');
	});

	test('blank line between members creates delimiter gap', () => {
		const { ranges, text } = getRanges('{\n  "a": 1,\n\n  "b": 2\n}');
		// The blank line should be in the delimiter (gap between ranges), not inside a member range
		const aSlice = text.slice(ranges[0].start, ranges[0].end);
		const bSlice = text.slice(ranges[1].start, ranges[1].end);
		// Neither range should span across both members
		expect(aSlice).not.toContain('"b"');
		expect(bSlice).not.toContain('"a"');
	});

	test('no blank line: comment is leading comment of first member', () => {
		const { ranges, text } = getRanges('{\n  // about a\n  "a": 1\n}');
		const aSlice = text.slice(ranges[0].start, ranges[0].end);
		expect(aSlice).toContain('// about a');
	});

	test('array: leading comment on element', () => {
		const { ranges, text } = getRanges('[\n  // item 1\n  "a",\n  // item 2\n  "b"\n]');
		const firstSlice = text.slice(ranges[0].start, ranges[0].end);
		const secondSlice = text.slice(ranges[1].start, ranges[1].end);
		expect(firstSlice).toContain('// item 1');
		expect(secondSlice).toContain('// item 2');
	});

	test('comma before trailing comment: ranges do not overlap', () => {
		const text = '{\n  "a": 1, // c1\n  "b": 2\n}';
		const { ranges } = getRanges(text);
		// range[0].end must be <= range[1].start (no overlap)
		expect(ranges[0].end).toBeLessThanOrEqual(ranges[1].start);
	});

	test('ranges tile contiguously with delimiters', () => {
		const text = '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}';
		const { ranges } = getRanges(text);
		// Each range.end should connect to next range.start via a delimiter
		for (let i = 0; i < ranges.length - 1; i += 1) {
			const gap = text.slice(ranges[i].end, ranges[i + 1].start);
			// The gap (delimiter) should exist and not be empty for multiline
			expect(gap.length).toBeGreaterThan(0);
		}
	});
});
