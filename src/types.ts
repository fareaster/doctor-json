import type {
	MemberNode,
	ElementNode,
} from '@humanwhocodes/momoa';

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export type SortEntry<T = unknown> = {
	key: string | number;
	value: T;
};

export type MemberRange = {
	member: MemberNode | ElementNode;
	start: number;
	end: number;
	commaOffset: number | null;
};

export type LocalIndent = {
	memberIndent: string;
	indentUnit: string;
};
