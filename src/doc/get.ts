import { findNodeAtPath } from '../utils/navigate.ts';
import type { Document } from './types.ts';
import { evaluate } from './evaluate.ts';

export const documentGet = (document: Document, path: readonly (string | number)[]): unknown => {
	const { ast } = document;
	const result = findNodeAtPath(ast, path);
	if (!result) {
		return undefined;
	}
	return evaluate(result.node);
};
