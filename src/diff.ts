import type { Document } from './doc/types.ts';
import { documentSet } from './doc/set.ts';
import { documentRemove } from './doc/remove.ts';
import { documentPush } from './doc/arrays.ts';
import { documentSort } from './doc/sort.ts';
import type { JsonValue } from './types.ts';

// Maps each object/array element → its index in the parent array
export const originalIndex = new WeakMap<object, number>();

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
	if (typeof v !== 'object' || v === null || Array.isArray(v)) {
		return false;
	}
	const proto = Object.getPrototypeOf(v);
	return proto === Object.prototype || proto === null;
};

const detectPermutation = (
	original: unknown[],
	current: unknown[],
): number[] | undefined => {
	const consumed = new Set<number>();
	const permutation: number[] = [];
	const originalStrings = original.map(element => JSON.stringify(element));
	const currentStrings = current.map(element => JSON.stringify(element));

	for (let ci = 0; ci < current.length; ci += 1) {
		const element = current[ci];
		let foundIndex = -1;

		if (typeof element === 'object' && element !== null) {
			const origIndex = originalIndex.get(element);
			if (origIndex !== undefined && !consumed.has(origIndex) && origIndex < original.length) {
				foundIndex = origIndex;
			}
		}

		if (foundIndex === -1) {
			for (let i = 0; i < original.length; i += 1) {
				if (!consumed.has(i) && originalStrings[i] === currentStrings[ci]) {
					foundIndex = i;
					break;
				}
			}
		}

		if (foundIndex === -1) {
			return undefined;
		}

		consumed.add(foundIndex);
		permutation.push(foundIndex);
	}

	if (permutation.every((value, index) => value === index)) {
		return undefined;
	}

	// Verify identity-matched elements weren't modified
	for (let i = 0; i < permutation.length; i += 1) {
		if (currentStrings[i] !== originalStrings[permutation[i]]) {
			return undefined;
		}
	}

	return permutation;
};

export const reconcile = (
	document: Document,
	original: unknown,
	current: unknown,
	path: (string | number)[],
) => {
	if (JSON.stringify(original) === JSON.stringify(current)) {
		return;
	}

	// Both plain objects → reconcile keys
	if (isPlainObject(original) && isPlainObject(current)) {
		// Pre-compute which current keys are JSON-omitted (undefined,
		// function, symbol, or toJSON()→undefined). Checked once per key
		// instead of repeated JSON.stringify calls in each loop.
		const omittedKeys = new Set(
			Object.keys(current).filter(k => JSON.stringify(current[k]) === undefined),
		);

		for (const key of Object.keys(original).reverse()) {
			if (!(key in current) || omittedKeys.has(key)) {
				documentRemove(document, [...path, key]);
			}
		}

		for (const key of Object.keys(original)) {
			if (key in current && !omittedKeys.has(key)) {
				reconcile(document, original[key], current[key], [...path, key]);
			}
		}

		for (const key of Object.keys(current)) {
			if (!(key in original) && !omittedKeys.has(key)) {
				documentSet(document, [...path, key], current[key] as JsonValue);
			}
		}

		// Detect key reorder: compare doc order (surviving + appended)
		// against JS object's key order
		const desiredOrder = Object.keys(current).filter(k => !omittedKeys.has(k));
		const documentOrder = [
			...Object.keys(original).filter(k => k in current && !omittedKeys.has(k)),
			...Object.keys(current).filter(k => !(k in original) && !omittedKeys.has(k)),
		];
		if (
			desiredOrder.length > 1
			&& desiredOrder.some((k, i) => k !== documentOrder[i])
		) {
			const positionMap = new Map(desiredOrder.map((k, i) => [k, i]));
			documentSort(document, path, (a, b) => (positionMap.get(a.key as string) ?? 0)
				- (positionMap.get(b.key as string) ?? 0), { groups: false });
		}
		return;
	}

	// Both arrays → reconcile elements
	if (Array.isArray(original) && Array.isArray(current)) {
		if (original.length === current.length && original.length > 1) {
			const permutation = detectPermutation(original, current);
			if (permutation) {
				// Pre-compute target position map (O(1) lookup instead of indexOf)
				const targetMap = new Map<number, number>();
				for (let i = 0; i < permutation.length; i += 1) {
					targetMap.set(permutation[i], i);
				}
				documentSort(document, path, (a, b) => (targetMap.get(a.key as number) ?? 0)
					- (targetMap.get(b.key as number) ?? 0), { groups: false });
				return;
			}
		}

		for (let i = original.length - 1; i >= current.length; i -= 1) {
			documentRemove(document, [...path, i]);
		}

		const minLength = Math.min(original.length, current.length);
		for (let i = 0; i < minLength; i += 1) {
			reconcile(document, original[i], current[i], [...path, i]);
		}

		if (current.length > original.length) {
			documentPush(document, path, ...(current.slice(original.length) as JsonValue[]));
		}
		return;
	}

	// Primitive or type changed
	documentSet(document, path, current as JsonValue);
};
