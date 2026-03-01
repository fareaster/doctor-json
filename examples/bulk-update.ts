/**
 * Update multiple fields at once with Object.assign.
 *
 * Since drjson returns plain JS objects, Object.assign works
 * natively. Each key is set individually — only changed values
 * are patched in the output. Siblings and formatting are untouched.
 */

import { parse, stringify } from 'doctor-json';

const text = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": false,
    "outDir": "./build"
  }
}`;

const config = parse(text);

Object.assign(config.compilerOptions, {
	target: 'ES2024',
	module: 'NodeNext',
	moduleResolution: 'NodeNext',
	strict: true,
});

console.log(stringify(config));
