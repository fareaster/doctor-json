import type {
	ObjectNode,
	ArrayNode,
	MemberNode,
	ElementNode,
} from '@humanwhocodes/momoa';
import type { SortEntry } from '../types.ts';
import { getMemberRanges, getMemberKeyStart } from '../utils/member-ranges.ts';
import { getMemberName, findNodeAtPath } from '../utils/navigate.ts';
import type { Document } from './types.ts';
import { evaluate } from './evaluate.ts';

export const documentSort = <T = unknown>(
	document: Document,
	pathOrComparator?: readonly (string | number)[] | ((a: SortEntry<T>, b: SortEntry<T>) => number),
	comparatorOrOptions?: ((a: SortEntry<T>, b: SortEntry<T>) => number) | { groups?: boolean },
	options?: { groups?: boolean },
): void => {
	let segments: readonly (string | number)[];
	let cmp: ((a: SortEntry<T>, b: SortEntry<T>) => number) | undefined;
	let useGroups = true;

	if (typeof pathOrComparator === 'function') {
		segments = [];
		cmp = pathOrComparator;
		if (typeof comparatorOrOptions === 'object' && comparatorOrOptions !== null) {
			useGroups = comparatorOrOptions.groups !== false;
		}
	} else {
		segments = pathOrComparator ?? [];
		if (typeof comparatorOrOptions === 'function') {
			cmp = comparatorOrOptions;
			if (options) {
				useGroups = options.groups !== false;
			}
		} else if (typeof comparatorOrOptions === 'object' && comparatorOrOptions !== null) {
			useGroups = comparatorOrOptions.groups !== false;
		}
	}

	const { ast } = document;

	// Resolve target node
	let targetNode: ObjectNode | ArrayNode;
	if (segments.length === 0) {
		if (ast.body.type !== 'Object' && ast.body.type !== 'Array') {
			return;
		}
		targetNode = ast.body;
	} else {
		const result = findNodeAtPath(ast, segments);
		if (!result || (result.node.type !== 'Object' && result.node.type !== 'Array')) {
			return;
		}
		targetNode = result.node as ObjectNode | ArrayNode;
	}

	const tokens = ast.tokens!;
	const ranges = getMemberRanges(targetNode, document.text, tokens);
	if (ranges.length <= 1) {
		return;
	}

	// Build sort entries
	const members = targetNode.type === 'Object' ? targetNode.members : targetNode.elements;
	const entries: { index: number;
		entry: SortEntry<T>; }[] = ranges.map((_range, i) => {
		const member = members[i];
		if (targetNode.type === 'Object') {
			const m = member as MemberNode;
			const key = getMemberName(m);
			const value = evaluate(m.value) as T;
			return {
				index: i,
				entry: {
					key,
					value,
				},
			};
		}
		const element = member as ElementNode;
		const value = evaluate(element.value) as T;
		return {
			index: i,
			entry: {
				key: i,
				value,
			},
		};
	});

	// Default comparator
	const compare = cmp ?? (() => {
		// For arrays: only sort if all values share the same primitive type.
		// Mixed types are a true no-op — pairwise 0-returns violate transitivity.
		if (typeof entries[0].entry.key === 'number') {
			const allStrings = entries.every(
				entry => typeof entry.entry.value === 'string',
			);
			if (allStrings) {
				return (a: SortEntry<T>, b: SortEntry<T>) => {
					const av = a.value as string;
					const bv = b.value as string;
					return av < bv ? -1 : (av > bv ? 1 : 0);
				};
			}
			const allNumbers = entries.every(
				entry => typeof entry.entry.value === 'number',
			);
			if (allNumbers) {
				return (a: SortEntry<T>, b: SortEntry<T>) => (
					(a.value as number) - (b.value as number)
				);
			}
			return () => 0;
		}
		// For objects: alphabetical by key
		return (a: SortEntry<T>, b: SortEntry<T>) => {
			const ak = String(a.key);
			const bk = String(b.key);
			return ak < bk ? -1 : (ak > bk ? 1 : 0);
		};
	})();

	// Split into sort groups at blank-line boundaries.
	// When groups is disabled (e.g. array .sort()), treat all members as one group.
	const groups: { startIdx: number;
		endIdx: number; }[] = [];

	if (useGroups) {
		let groupStart = 0;
		for (let i = 0; i < ranges.length - 1; i += 1) {
			const { commaOffset } = ranges[i];
			const afterComma = commaOffset === null ? 0 : commaOffset + 1;
			const gapStart = Math.max(afterComma, ranges[i].end);
			const gapEnd = getMemberKeyStart(ranges[i + 1].member);
			const gap = document.text.slice(gapStart, gapEnd);
			if (/\n\s*\n/.test(gap)) {
				groups.push({
					startIdx: groupStart,
					endIdx: i + 1,
				});
				groupStart = i + 1;
			}
		}
		groups.push({
			startIdx: groupStart,
			endIdx: ranges.length,
		});
	} else {
		groups.push({
			startIdx: 0,
			endIdx: ranges.length,
		});
	}

	// Sort within each group independently
	const sorted: typeof entries = [];
	for (const group of groups) {
		const groupEntries = entries.slice(group.startIdx, group.endIdx);
		groupEntries.sort((a, b) => compare(a.entry, b.entry));
		sorted.push(...groupEntries);
	}

	// Check if already sorted
	const isAlreadySorted = sorted.every((s, i) => s.index === i);
	if (isAlreadySorted) {
		return;
	}

	// Collect the first-member index of each non-first group. Leading comments
	// before these members act as group headers and must stay pinned (part of
	// padding), not travel with the member's content.
	const groupFirstIndices = new Set(
		groups.filter((_, gi) => gi > 0).map(g => g.startIdx),
	);

	// For each range, compute the semantic start (where actual content begins,
	// excluding positional whitespace between delimiter and content).
	// Positional padding stays pinned; only semantic content swaps.
	const semanticStarts = ranges.map((range, i) => {
		// For group-first members (non-first groups), pin leading comments as
		// positional padding by using the key start as the content boundary.
		if (groupFirstIndices.has(i)) {
			return getMemberKeyStart(range.member);
		}
		// Find where actual content starts by skipping whitespace from
		// range.start. The padding (newline + indentation) stays pinned;
		// content (comments + key:value) moves with the member during sort.
		let contentStart = range.start;
		while (contentStart < range.end && '\n\r\t '.includes(document.text[contentStart])) {
			contentStart += 1;
		}
		return contentStart;
	});

	// Split-content extraction: split each member's text at its value end.
	// "core" = leading comments + key + colon + value (up to value node end)
	// "trailing" = everything after value end (spaces, trailing comment)
	// The structural comma (if present) is stripped from trailing.
	// This lets the slot grid decide whether to place a comma between them.
	const memberContents = ranges.map((range, i) => {
		const contentStart = semanticStarts[i];
		const valueEnd = range.member.value.loc.end.offset;
		const core = document.text.slice(contentStart, valueEnd);

		const afterValue = document.text.slice(valueEnd, range.end);
		const comma = range.commaOffset;

		// Strip the structural comma from the after-value text
		let trailing: string;
		if (comma !== null && comma >= valueEnd && comma < range.end) {
			const commaRelative = comma - valueEnd;
			trailing = afterValue.slice(0, commaRelative) + afterValue.slice(commaRelative + 1);
		} else {
			trailing = afterValue;
		}

		return {
			core,
			trailing,
		};
	});

	// Track whether we stripped a comma from each member's content.
	// If the comma was in the delimiter (not inside content), the
	// delimiter already has it and we don't need to inject one.
	const slotHasInternalComma = ranges.map((r) => {
		if (r.commaOffset === null) { return false; }
		const valueEnd = r.member.value.loc.end.offset;
		return r.commaOffset >= valueEnd && r.commaOffset < r.end;
	});

	// Build the full "slot" for each position: padding + delimiter
	const paddings = ranges.map((range, i) => document.text.slice(range.start, semanticStarts[i]));
	const delimiters: string[] = [];
	for (let i = 0; i < ranges.length - 1; i += 1) {
		delimiters.push(document.text.slice(ranges[i].end, ranges[i + 1].start));
	}

	// Prefix (between opening brace/bracket and first range)
	const openOffset = targetNode.loc.start.offset;
	const prefix = document.text.slice(openOffset + 1, ranges[0].start);

	// Suffix (between last range end and closing brace/bracket)
	const closeOffset = targetNode.loc.end.offset;
	const suffix = document.text.slice(ranges.at(-1)!.end, closeOffset);

	// Zipper reconstruction: padding stays pinned, content moves,
	// comma placement is determined by the slot (not the member)
	// Use array chunks + .join('') for better memory performance on large objects
	const chunks: string[] = [prefix];
	for (let i = 0; i < sorted.length; i += 1) {
		const content = memberContents[sorted[i].index];
		// Re-inject comma based on the SLOT position (not the member).
		// If slot i originally had an internal comma (comma before trailing
		// comment), re-inject it at the same slot position after sorting.
		chunks.push(paddings[i], content.core, slotHasInternalComma[i] ? ',' : '', content.trailing);
		if (i < delimiters.length) {
			chunks.push(delimiters[i]);
		}
	}
	chunks.push(suffix);
	const reconstructed = chunks.join('');

	// Replace the target's interior (between open and close brace/bracket)
	document.text = document.text.slice(0, openOffset + 1)
		+ reconstructed
		+ document.text.slice(closeOffset);
};
