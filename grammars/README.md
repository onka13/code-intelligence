# Grammars built by this project

Most grammars come from npm packages (`tree-sitter-wasms`, `tree-sitter-typescript`, `tree-sitter-c-sharp`), pinned in `package.json`. A grammar is built here only when no package ships a current one as WebAssembly.

| File | Source | Commit | Built with | SHA-256 | License |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tree-sitter-dart.wasm` | [UserNobody14/tree-sitter-dart](https://github.com/UserNobody14/tree-sitter-dart) | `0038280b774b65c1b89ba7fec50624d8baed9fe1` (2026-10-17) | tree-sitter CLI 0.25.10, emscripten 4.0.4 | `69be3d03b4b1e405ce984dc4ba40704a9c50ff81e120b55144499c81986da1f8` | MIT ([LICENSE-tree-sitter-dart](LICENSE-tree-sitter-dart)) |

The npm package `tree-sitter-dart` (1.0.0, February 2023) and the build in `tree-sitter-wasms` predate Dart 3, so they cannot read records, patterns or switch expressions, which freezed output uses.

Rebuild with `scripts/build-dart-grammar.sh` (needs Docker), then run `npm run golden:update` and review the diff. The tree-sitter CLI version must match `web-tree-sitter` in `package.json`.
