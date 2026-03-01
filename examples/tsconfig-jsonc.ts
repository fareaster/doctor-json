/**
 * Edit a tsconfig.json with JSONC features.
 *
 * tsconfig files commonly use comments and trailing commas.
 * drjson preserves both — comments stay attached to their
 * properties, trailing commas survive, and the formatting
 * of untouched sections remains byte-identical.
 */

import { parse, stringify } from 'doctor-json';

const text = `{
  // TypeScript compiler options
  "compilerOptions": {
    "target": "ES2022", // latest LTS
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,

    // Output
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
  },

  "include": ["src"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
  ]
}`;

const config = parse(text);

// Update compiler target
config.compilerOptions.target = 'ES2024';

// Enable a new strict flag
config.compilerOptions.noUncheckedIndexedAccess = true;

// Add a path to exclude
config.exclude.push('coverage');

console.log(stringify(config));
