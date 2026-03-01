import { type Document, createDocument } from './doc/types.ts';
import { documentSort } from './doc/sort.ts';
import { documentRename } from './doc/rename.ts';
import { evaluate } from './doc/evaluate.ts';
import type { SortEntry } from './types.ts';
import { reconcile, originalIndex } from './diff.ts';

// --- Types ---

type Operation =
	| { type: 'sort';
		path: (string | number)[];
		comparator?: (a: SortEntry, b: SortEntry) => number; }
	| { type: 'rename';
		path: (string | number)[];
		oldKey: string;
		newKey: string; };

type Original = {
	doc: Document;
	snapshot: unknown;
	operations: Operation[];
};

// --- State ---

const originals = new WeakMap<object, Original>();
const nestedToRoot = new WeakMap<object, object>();
const knownRoots = new Set<WeakRef<object>>();
const rootCleanup = new FinalizationRegistry((ref: WeakRef<object>) => {
	knownRoots.delete(ref);
});

// --- Helpers ---

const createSnapshot = (value: unknown): unknown => {
	const json = JSON.stringify(value);
	if (json === undefined) {
		return undefined;
	}
	return JSON.parse(json) as unknown;
};

/**
 * Walk the object tree, registering nested objects in WeakMaps.
 * When `root` is provided, sets nestedToRoot mappings (parse time).
 * Always updates originalIndex for array elements.
 */
const walkTree = (node: unknown, root?: object) => {
	if (typeof node !== 'object' || node === null) {
		return;
	}
	if (root) {
		nestedToRoot.set(node, root);
	}
	if (Array.isArray(node)) {
		for (let i = 0; i < node.length; i += 1) {
			const child = node[i];
			if (typeof child === 'object' && child !== null) {
				originalIndex.set(child as object, i);
				walkTree(child, root);
			}
		}
	} else {
		for (const child of Object.values(node as Record<string, unknown>)) {
			if (typeof child === 'object' && child !== null) {
				walkTree(child, root);
			}
		}
	}
};

/** Rebuild an object's keys in a new order, preserving values. */
const reorderKeys = (
	object: Record<string, unknown>,
	newKeyOrder: string[],
) => {
	const copy = Object.create(null) as Record<string, unknown>;
	for (const key of Object.keys(object)) {
		copy[key] = object[key];
	}
	for (const key of Object.keys(object)) {
		delete object[key];
	}
	for (const key of newKeyOrder) {
		object[key] = copy[key];
	}
};

/** Apply a single sort operation to the document. */
const applySort = (
	document: Document,
	operation: Extract<Operation, { type: 'sort' }>,
) => {
	if (operation.path.length === 0) {
		documentSort(document, operation.comparator);
	} else {
		documentSort(document, operation.path, operation.comparator);
	}
};

// --- Path utilities ---

const findRoot = (object: unknown): object => {
	if (typeof object !== 'object' || object === null) {
		throw new TypeError('sortKeys/rename requires an object');
	}
	if (originals.has(object)) {
		return object;
	}

	const cached = nestedToRoot.get(object);
	if (cached) {
		return cached;
	}

	for (const ref of knownRoots) {
		const root = ref.deref();
		if (!root) {
			knownRoots.delete(ref);
			continue;
		}
		if (findPathInner(root, object, [])) {
			nestedToRoot.set(object, root);
			return root;
		}
	}

	throw new TypeError('Object not found in any parsed document');
};

const findPathInner = (
	root: unknown,
	target: object,
	path: (string | number)[],
): (string | number)[] | undefined => {
	if (root === target) {
		return path;
	}
	if (typeof root !== 'object' || root === null) {
		return undefined;
	}
	if (Array.isArray(root)) {
		for (let i = 0; i < root.length; i += 1) {
			const result = findPathInner(root[i], target, [...path, i]);
			if (result) {
				return result;
			}
		}
	} else {
		for (const key of Object.keys(root as Record<string, unknown>)) {
			const result = findPathInner(
				(root as Record<string, unknown>)[key],
				target,
				[...path, key],
			);
			if (result) {
				return result;
			}
		}
	}
	return undefined;
};

const findPath = (root: object, target: object): (string | number)[] => {
	const path = findPathInner(root, target, []);
	if (!path) {
		throw new TypeError('Object not reachable from parsed document root');
	}
	return path;
};

// --- Public API ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parse = <T = any>(text: string): T => {
	const document = createDocument(text);
	const value = evaluate(document.ast.body) as T;

	if (typeof value === 'object' && value !== null) {
		const root = value as object;
		originals.set(root, {
			doc: document,
			snapshot: createSnapshot(value),
			operations: [],
		});
		walkTree(root, root);
		const ref = new WeakRef(root);
		knownRoots.add(ref);
		rootCleanup.register(root, ref);
	}

	return value;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stringify = (object: any): string => {
	const orig = originals.get(object);
	if (!orig) {
		throw new TypeError('stringify() requires a drjson-parsed object');
	}

	const operations = [...orig.operations];
	orig.operations.length = 0;

	// 1. Apply all recorded operations in call order
	if (operations.length > 0) {
		for (const op of operations) {
			if (op.type === 'rename') {
				documentRename(orig.doc, [...op.path, op.oldKey], op.newKey);
			}
			if (op.type === 'sort') {
				applySort(orig.doc, op);
			}
		}
		orig.snapshot = createSnapshot(evaluate(orig.doc.ast.body));
	}

	// 2. Fast path: nothing changed
	if (JSON.stringify(object) === JSON.stringify(orig.snapshot)) {
		return orig.doc.text;
	}

	// 3. Reconcile
	reconcile(orig.doc, orig.snapshot, object, []);

	// Note: no sort replay needed — the reconcile's full-key reorder
	// detection positions all keys (including new ones) to match JS order,
	// and operations are applied in call order in step 1.

	// 5. Update state for subsequent calls
	orig.snapshot = createSnapshot(object);
	walkTree(object, object);

	return orig.doc.text;
};

export const sortKeys = (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	object: any,
	comparator?: (a: SortEntry, b: SortEntry) => number,
): void => {
	const root = findRoot(object);
	const orig = originals.get(root);
	if (!orig) {
		throw new TypeError('sortKeys() requires a drjson-parsed object');
	}

	const path = root === object ? [] : findPath(root, object);

	// Sort the JS object first — if the comparator throws,
	// no stale operation is queued
	if (Array.isArray(object)) {
		if (comparator) {
			const entries: SortEntry[] = object.map((v: unknown, i: number) => ({
				key: i,
				value: v,
			}));
			entries.sort((a, b) => comparator(a, b));
			const sorted = entries.map(entry => entry.value);
			object.length = 0;
			object.push(...sorted);
		} else {
			// Match documentSort: numeric for numbers, string comparison for strings
			const allNumbers = object.length > 0
				&& object.every((element: unknown) => typeof element === 'number');
			const allStrings = object.length > 0
				&& object.every((element: unknown) => typeof element === 'string');
			if (allNumbers) {
				object.sort((a: number, b: number) => a - b);
			} else if (allStrings) {
				object.sort((a: string, b: string) => (a < b ? -1 : (a > b ? 1 : 0)));
			}
		}
		orig.operations.push({
			type: 'sort',
			path,
			comparator,
		});
		return;
	}

	// Sort JS object keys
	const keys = Object.keys(object);
	const sorted = comparator
		? keys.slice().sort((a, b) => comparator({
			key: a,
			value: object[a],
		}, {
			key: b,
			value: object[b],
		}))
		: keys.slice().sort();
	reorderKeys(object, sorted);

	// Queue operation only after successful local sort
	orig.operations.push({
		type: 'sort',
		path,
		comparator,
	});
};

export const rename = (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	object: any,
	oldKey: string,
	newKey: string,
): void => {
	const root = findRoot(object);
	const orig = originals.get(root);
	if (!orig) {
		throw new TypeError('rename() requires a drjson-parsed object');
	}
	if (!(oldKey in object) || newKey in object) {
		return;
	}

	const path = root === object ? [] : findPath(root, object);
	orig.operations.push({
		type: 'rename',
		path,
		oldKey,
		newKey,
	});

	// Mutate JS object — preserve key position
	// (Can't use reorderKeys here — the new key name doesn't exist in
	// the copy, so values must be mapped through the old→new key transform)
	const keys = Object.keys(object);
	const copy = Object.create(null) as Record<string, unknown>;
	for (const key of keys) {
		copy[key] = object[key];
	}
	for (const key of keys) {
		delete object[key];
	}
	for (const key of keys) {
		object[key === oldKey ? newKey : key] = copy[key];
	}
};
