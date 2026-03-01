import { describe } from 'manten';

describe('drjson', () => {
	// Doc engine tests
	import('./get.ts');
	import('./set.ts');
	import('./remove.ts');
	import('./push.ts');
	import('./insert.ts');
	import('./rename.ts');
	import('./sort.ts');

	// Formatting preservation
	import('./whitespace.ts');
	import('./comments.ts');
	import('./indentation.ts');
	import('./trailing-commas.ts');
	import('./local-formatting.ts');

	// Internals
	import('./member-ranges.ts');
	import('./validation.ts');

	// Integration & stress
	import('./integration.ts');
	import('./stress.ts');

	// Public API (reconcile model)
	import('./reconcile.ts');
});
