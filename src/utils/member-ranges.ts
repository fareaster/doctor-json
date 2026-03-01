import type {
	Token,
	MemberNode,
	ElementNode,
	ObjectNode,
	ArrayNode,
} from '@humanwhocodes/momoa';
import type { MemberRange } from '../types.ts';

export const findTokenIndex = (tokens: Token[], offset: number): number => {
	let low = 0;
	let high = tokens.length - 1;
	while (low <= high) {
		// eslint-disable-next-line no-bitwise
		const mid = (low + high) >>> 1;
		if (tokens[mid].loc.start.offset < offset) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return low;
};

const isCommentToken = (token: Token): boolean => token.type === 'LineComment' || token.type === 'BlockComment';

const blankLinePattern = /\n[\t\r ]*\n/;

export const getMemberKeyStart = (member: MemberNode | ElementNode): number => (
	member.type === 'Member'
		? member.name.loc.start.offset
		: member.value.loc.start.offset
);

const computeSemanticStart = (
	member: MemberNode | ElementNode,
	tokens: Token[],
	text: string,
): { semanticStart: number;
	stoppedAtBlankLine: boolean; } => {
	const keyStart = getMemberKeyStart(member);
	let semanticStart = keyStart;
	let nextBoundary = keyStart;
	let tokenIndex = findTokenIndex(tokens, keyStart) - 1;
	let stoppedAtBlankLine = false;

	while (tokenIndex >= 0) {
		const token = tokens[tokenIndex];

		if (!isCommentToken(token)) {
			break;
		}

		// Check for blank line between this comment's end and the next boundary below
		const textBetween = text.slice(token.loc.end.offset, nextBoundary);
		if (blankLinePattern.test(textBetween)) {
			stoppedAtBlankLine = true;
			break;
		}

		semanticStart = token.loc.start.offset;
		nextBoundary = token.loc.start.offset;
		tokenIndex -= 1;

		// Check if the token before this comment is a stopping delimiter
		if (tokenIndex >= 0) {
			const previousToken = tokens[tokenIndex];
			if (
				previousToken.type === 'Comma'
				|| previousToken.type === 'LBrace'
				|| previousToken.type === 'LBracket'
			) {
				break;
			}
		}
	}

	return {
		semanticStart,
		stoppedAtBlankLine,
	};
};

const computeTrailingEnd = (
	member: MemberNode | ElementNode,
	tokens: Token[],
): { semanticEnd: number;
	commaOffset: number | null; } => {
	const valueEndOffset = member.value.loc.end.offset;
	const valueEndLine = member.value.loc.end.line;
	let semanticEnd = valueEndOffset;
	let commaOffset: number | null = null;
	let afterIndex = findTokenIndex(tokens, valueEndOffset);

	while (afterIndex < tokens.length) {
		const token = tokens[afterIndex];

		if (token.type === 'Comma') {
			commaOffset = token.loc.start.offset;
			afterIndex += 1;
			continue;
		}

		if (isCommentToken(token) && token.loc.start.line === valueEndLine) {
			semanticEnd = token.loc.end.offset;
			afterIndex += 1;
			continue;
		}

		break;
	}

	return {
		semanticEnd,
		commaOffset,
	};
};

export const getMemberRanges = (
	container: ObjectNode | ArrayNode,
	text: string,
	tokens: Token[],
): MemberRange[] => {
	const members: (MemberNode | ElementNode)[] = container.type === 'Object'
		? container.members
		: container.elements;

	if (members.length === 0) {
		return [];
	}

	const ranges: MemberRange[] = [];
	const openBraceOffset = container.loc.start.offset;

	for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
		const member = members[memberIndex];
		const { semanticStart, stoppedAtBlankLine } = computeSemanticStart(member, tokens, text);
		const { semanticEnd, commaOffset } = computeTrailingEnd(member, tokens);

		let start: number;
		if (memberIndex === 0) {
			// For the first member: if the backward walk stopped at a blank line,
			// there's a container header above — exclude it from the range
			if (stoppedAtBlankLine) {
				start = semanticStart;
			} else {
				start = openBraceOffset + 1;
			}
		} else {
			const previousRange = ranges[memberIndex - 1];
			// Use the furthest endpoint — commaOffset+1 or range.end, whichever
			// is later. When a trailing inline comment follows the comma
			// (e.g. "a": 1, // c1), the comment end is past commaOffset+1.
			const afterComma = previousRange.commaOffset === null
				? 0
				: previousRange.commaOffset + 1;
			start = Math.max(afterComma, previousRange.end);
		}

		ranges.push({
			member,
			start,
			end: semanticEnd,
			commaOffset,
		});
	}

	return ranges;
};

export type { MemberRange } from '../types.ts';
