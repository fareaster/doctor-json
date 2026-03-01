import type {
	DocumentNode,
	ObjectNode,
	MemberNode,
	ElementNode,
	ValueNode,
} from '@humanwhocodes/momoa';

export const getMemberName = (member: MemberNode): string => (
	member.name.type === 'String'
		? member.name.value
		: (member.name as unknown as { name: string }).name
);

export const findNodeAtPath = (
	ast: DocumentNode,
	segments: readonly (string | number)[],
): { node: ValueNode;
	parent?: MemberNode | ElementNode; } | undefined => {
	let current: ValueNode = ast.body;
	let parentContainer: MemberNode | ElementNode | undefined;

	for (const segment of segments) {
		if (typeof segment === 'number') {
			if (current.type !== 'Array') {
				return undefined;
			}
			const element = current.elements[segment];
			if (!element) {
				return undefined;
			}
			parentContainer = element;
			current = element.value;
		} else {
			if (current.type !== 'Object') {
				return undefined;
			}
			// Use findLast to match JSON.parse last-key-wins semantics
			const member = current.members.findLast(m => getMemberName(m) === segment);
			if (!member) {
				return undefined;
			}
			parentContainer = member;
			current = member.value;
		}
	}

	return {
		node: current,
		parent: parentContainer,
	};
};

export const findObjectAtPath = (
	ast: DocumentNode,
	segments: readonly (string | number)[],
): ObjectNode | undefined => {
	if (segments.length === 0) {
		return ast.body.type === 'Object' ? ast.body : undefined;
	}

	const result = findNodeAtPath(ast, segments);
	if (!result || result.node.type !== 'Object') {
		return undefined;
	}
	return result.node;
};
