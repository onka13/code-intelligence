# Contributing

Improvements to a language pack and new packs are the most welcome contributions.

## A language pack

A pack is one folder, `packs/<id>/`, and one entry in `packs/index.ts`. Nothing else changes.

| File | Purpose |
| :--- | :--- |
| `symbols.scm` | A Tree-sitter query that captures each declaration as `@symbol`: top-level declarations, and members inside class bodies |
| `imports.scm` | A query that captures each module specifier as `@source` |
| `pack.ts` | The `LanguagePack` (`src/packs/pack.ts`): which files it claims, `parse`, `resolve` |
| a describe module | Reads one captured node: kind, name, signature, visibility, static, `extends` / `implements` |
| `resolve.ts` | Turns a specifier into a project file, a package or a built-in |
| `fixtures/project/` | Sample sources that cover the language's declarations |
| `fixtures/expected/` | The outputs for the sample, written by `npm run golden:update` |

The core nests members into their containers by syntax range and renders every output, so a pack never formats text. Grammars come from `tree-sitter-wasms` and load through WebAssembly, so every machine uses the same grammar file.

A pack is accepted only with fixtures. CI scans each pack's fixture project and compares the outputs with `fixtures/expected/`. After a deliberate change, run `npm run golden:update` and review the diff of the expected files in your pull request.

## Checks

```bash
npm install
npm test
```

## Sign your commits (DCO)

Contributions are accepted under the Apache License 2.0 (`LICENSE`) and the [Developer Certificate of Origin](https://developercertificate.org/). Sign off every commit:

```bash
git commit -s -m "feat(pack): add the go pack"
```
