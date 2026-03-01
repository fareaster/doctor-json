import type { ValueNode } from '@humanwhocodes/momoa';

/**
 * Custom evaluate — workaround for momoa's evaluate() using bracket assignment
 * which triggers the __proto__ setter instead of creating an own property.
 * Uses Object.defineProperty for __proto__ keys so objects keep their prototype
 * chain (hasOwnProperty, toString, instanceof Object all work).
 * TODO: Replace with momoa's evaluate() once https://github.com/humanwhocodes/momoa/pull/205 lands
 */
export const evaluate = (node: ValueNode): unknown => {
	switch (node.type) {
		case 'Object': {
			const object: Record<string, unknown> = {};
			for (const member of node.members) {
				const key = member.name.type === 'String'
					? member.name.value
					: (member.name as unknown as { name: string }).name;
				const value = evaluate(member.value);
				if (key === '__proto__') {
					Object.defineProperty(object, key, {
						value,
						writable: true,
						enumerable: true,
						configurable: true,
					});
				} else {
					object[key] = value;
				}
			}
			return object;
		}
		case 'Array': {
			return node.elements.map(element => evaluate(element.value));
		}
		case 'String':
		case 'Number':
		case 'Boolean': {
			return node.value;
		}
		case 'Null': {
			return null;
		}
		default: {
			return undefined;
		}
	}
};
