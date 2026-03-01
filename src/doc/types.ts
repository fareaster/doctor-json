import {
	parse as momoaParse,
	type DocumentNode,
} from '@humanwhocodes/momoa';

export type Document = {
	text: string;
	readonly ast: DocumentNode;
};

export const createDocument = (text: string): Document => {
	let _text = text;
	let _ast: DocumentNode | null = null;
	return {
		get text() { return _text; },
		set text(value: string) { _text = value; _ast = null; },
		get ast() {
			if (!_ast) {
				_ast = momoaParse(_text, {
					mode: 'jsonc',
					ranges: true,
					tokens: true,
					allowTrailingCommas: true,
				});
			}
			return _ast;
		},
	} as Document;
};
