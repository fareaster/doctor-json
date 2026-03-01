/**
 * Manipulate arrays with native JS methods.
 *
 * push, splice, sort, reverse, unshift — all work natively.
 * drjson detects the changes at stringify time and patches
 * the text to match, preserving formatting for untouched elements.
 */

import { parse, stringify } from 'doctor-json';

const text = `{
  "plugins": [
    "@babel/plugin-transform-runtime",
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-optional-chaining"
  ],

  "keywords": [
    "babel",
    "compiler",
    "javascript"
  ]
}`;

const config = parse(text);

// Remove a deprecated plugin
const index = config.plugins.indexOf('@babel/plugin-proposal-optional-chaining');
if (index !== -1) {
	config.plugins.splice(index, 1);
}

// Add new keywords
config.keywords.push('transpiler', 'toolchain');

// Sort keywords
config.keywords.sort();

console.log(stringify(config));
