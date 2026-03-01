/**
 * Edit a package.json with unconventional formatting.
 *
 * This file has tabs, grouped sections separated by blank lines,
 * "// comment": "" keys used as comment alternatives in scripts,
 * and hand-sorted dependency groups. drjson preserves all of it —
 * only the values you touch change. Everything else is byte-identical.
 */

import {
	parse, stringify, sortKeys, rename,
} from 'doctor-json';

const text = `{
	"name": "my-app",
	"version": "1.0.0",
	"private": true,

	"scripts": {
		"// dev": "",
		"dev": "vite",
		"preview": "vite preview",

		"// build": "",
		"build": "tsc && vite build",
		"postbuild": "node scripts/verify.js",

		"// test": "",
		"test": "vitest",
		"lint": "eslint src/"
	},

	"dependencies": {
		"vue": "^3.5.0",
		"zod": "^3.22.0",
		"axios": "^1.6.0"
	},

	"devDependencies": {
		"vite": "^6.0.0",
		"vitest": "^3.0.0",
		"typescript": "^5.7.0",
		"eslint": "^9.0.0"
	}
}`;

const pkg = parse(text);

// Bump version
pkg.version = '2.0.0';

// Rename a script
rename(pkg.scripts, 'build', 'compile');

// Add a new dependency
pkg.dependencies.pinia = '^2.1.0';

// Sort dependencies alphabetically
sortKeys(pkg.dependencies);
sortKeys(pkg.devDependencies);

// Add a keyword
pkg.keywords = ['vue', 'app'];

console.log(stringify(pkg));
