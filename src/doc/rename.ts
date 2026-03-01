import { getMemberName, findNodeAtPath, findObjectAtPath } from '../utils/navigate.ts';
import type { Document } from './types.ts';

export const documentRename = (
	document: Document,
	path: readonly (string | number)[],
	newKey: string,
): void => {
	if (path.length === 0) {
		return;
	}

	const { ast } = document;
	const existing = findNodeAtPath(ast, path);
	if (!existing?.parent || existing.parent.type !== 'Member') {
		return;
	}

	// Check if newKey already exists in the same object (prevent duplicates)
	const parentPath = path.slice(0, -1);
	const parentObject = parentPath.length === 0
		? (ast.body.type === 'Object' ? ast.body : undefined)
		: findObjectAtPath(ast, parentPath);
	if (parentObject) {
		const keyExists = parentObject.members.some(m => getMemberName(m) === newKey);
		if (keyExists) {
			return;
		}
	}

	const nameNode = existing.parent.name;
	const start = nameNode.loc.start.offset;
	const end = nameNode.loc.end.offset;

	document.text = document.text.slice(0, start) + JSON.stringify(newKey) + document.text.slice(end);
};
