# doctor-json

Surgically edit JSON & JSONC strings — preserving whitespace, comments, and formatting.

## Why?

JSON files have formatting that matters — comments, indentation style, trailing commas, hand-organized sections. `JSON.parse` + `JSON.stringify` destroys all of it.

_Doctor JSON_ lets you edit JSON like a normal object. When you stringify, only what you changed is different. Everything else is byte-identical.

```ts
import { parse, stringify } from 'doctor-json'

const config = parse(tsconfigText)
config.compilerOptions.target = 'ES2024'

await fs.writeFile('tsconfig.json', stringify(config))
```

With `JSON.stringify`, one field change destroys the entire file:

```json
{"compilerOptions":{"target":"ES2024","strict":true},"include":["src"]}
```

With _Doctor JSON_, only the value you touched is different:

```jsonc
{
  // Compiler options
  "compilerOptions": {
    "target": "ES2024", // latest stable
    "strict": true,
  },
  "include": ["src"]
}
```

## Install

```sh
npm install doctor-json
```

## Usage

`parse()` returns a plain JavaScript object. Mutate it with standard JS. `stringify()` diffs your changes against the original and patches the text.

```ts
import { parse, stringify, sortKeys, rename } from 'doctor-json'

const pkg = parse(text)

pkg.version = '2.0.0'
pkg.keywords.push('json', 'ast')
delete pkg.deprecated

sortKeys(pkg.dependencies)
rename(pkg.scripts, 'build', 'compile')

const result = stringify(pkg)
```

No proxies, no special APIs. `Array.isArray`, `Object.keys`, `for...of`, spread, destructuring — everything works natively because it's a real object.

## Examples

### Edit a package.json with formatting

Real package.json files often have tabs, blank-line section separators, and `"// comment"` keys as comment workarounds. _Doctor JSON_ preserves all of it:

```ts
import { parse, stringify, sortKeys, rename } from 'doctor-json'

const pkg = parse(packageJsonText)

pkg.version = '2.0.0'
rename(pkg.scripts, 'build', 'compile')
pkg.dependencies.pinia = '^2.1.0'
sortKeys(pkg.dependencies)

await fs.writeFile('package.json', stringify(pkg))
// Tabs, blank-line groups, "// comment" keys — all preserved
```

> See [examples/package-json.ts](examples/package-json.ts) for the full before/after with tabs, grouped sections, and comment keys.

### Update a tsconfig.json (JSONC)

Comments and trailing commas survive all operations:

```ts
const config = parse(tsconfigText)
config.compilerOptions.target = 'ES2024'
config.compilerOptions.noUncheckedIndexedAccess = true
config.exclude.push('coverage')
// Line comments, block comments, trailing commas — all preserved
```

> See [examples/tsconfig-jsonc.ts](examples/tsconfig-jsonc.ts) for a full JSONC editing example.

### Rename a key (preserving position and comments)

`rename` changes the key name without moving it or losing its surrounding formatting:

```jsonc
// Before
{
  "scripts": {
    // Compile TypeScript
    "build": "tsc",
    "test": "vitest"
  }
}
```

```ts
rename(pkg.scripts, 'build', 'compile')
```

```jsonc
// After
{
  "scripts": {
    // Compile TypeScript
    "compile": "tsc",
    "test": "vitest"
  }
}
```

Only the key name changed. The comment, value, and position are all preserved. With `delete` + re-add, the key moves to the end and the comment is lost.

### More examples

- [Bulk update with Object.assign](examples/bulk-update.ts)
- [Array manipulation (splice, push, sort)](examples/array-manipulation.ts)

## API

```ts
import { parse, stringify, sortKeys, rename } from 'doctor-json'
```

### `parse(text)`

Parse a JSON/JSONC string. Returns a plain JavaScript object.

### `stringify(obj)`

Produce the edited text. Unchanged content keeps its original formatting, comments, and whitespace.

```ts
const result = stringify(pkg)
await fs.writeFile('package.json', result)
```

### `sortKeys(obj, comparator?)`

Sort object keys. Comments travel with their keys. Blank lines between members create independent [sort groups](#sort-groups) — members never cross group boundaries.

```ts
sortKeys(pkg.dependencies)                // alphabetical
sortKeys(pkg, (a, b) => customOrder(a, b)) // custom comparator
```

### `rename(obj, oldKey, newKey)`

Rename a key in place. Position, value, and surrounding comments are preserved.

```ts
rename(pkg.scripts, 'build', 'compile')
```

## Behavior

### Formatting preservation

_Doctor JSON_ detects formatting per-object — indentation style, colon spacing, inline vs multiline, trailing commas. New content matches the style of the object it's inserted into.

```ts
// Minified input → minified output
parse('{"a":1}').b = 2     // → '{"a":1,"b":2}'

// 4-space indent → 4-space output
parse('{\n    "a": 1\n}')  // new keys get 4-space indent
```

### JSONC support

Comments and trailing commas are preserved through all operations, including comments between key and value:

```ts
const config = parse('{"key": /* important */ "old"}')
config.key = 'new'
stringify(config) // '{"key": /* important */ "new"}'
```

### Comment association

When sorting or removing members, comments travel with their associated member:

- **Same-line comments** (`// note` after a value) stay with that member
- **Above-line comments** (comment on the line above) stay with the member below

To pin a comment as a section header that doesn't move during sort, separate it with a blank line.

### Sort groups

Blank lines between members create independent sort groups. `sortKeys` sorts within each group but never moves members across group boundaries:

```jsonc
{
  // These two sort together
  "b": 1,
  "a": 2,

  // These two sort together (separately)
  "d": 3,
  "c": 4
}
```

After `sortKeys`: `a, b` in group 1, `c, d` in group 2. The blank line keeps them apart.

## Notes

- `stringify(pkg)` is the surgical output. `JSON.stringify(pkg)` re-serializes from scratch (comments and formatting lost).
- `parse()` returns plain objects with normal prototypes — `instanceof Object`, `hasOwnProperty`, and `toString` all work.
- Duplicate keys use last-key-wins (matching `JSON.parse`).
- Value coercion follows `JSON.stringify` semantics — `Date` calls `toJSON()`, `undefined`/functions are omitted, `NaN`/`Infinity` become `null`.

## How it works

```
1. parse(text)
   ├─ Parse text → AST (preserves comments, whitespace)
   ├─ Evaluate AST → plain JS object
   └─ Snapshot the object state

2. Mutate with normal JS
   obj.key = 'new value'

3. stringify(obj)
   ├─ Diff current object vs snapshot → find what changed
   ├─ Patch only the changed parts in the original text
   └─ Return the patched text
```

Unchanged text is never touched, so formatting, comments, and whitespace survive.
