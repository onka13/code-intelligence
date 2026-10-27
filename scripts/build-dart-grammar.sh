#!/usr/bin/env bash
# Rebuilds grammars/tree-sitter-dart.wasm from a pinned commit of the upstream Dart grammar.
# No npm package ships a current Dart grammar as WebAssembly, so the library ships its own build.
# Needs git, Node.js and Docker (the tree-sitter CLI compiles with the emscripten/emsdk image).
# After a rebuild: update the commit and checksum in grammars/README.md, run `npm run golden:update` and review the diff.
set -euo pipefail

REPO_URL="https://github.com/UserNobody14/tree-sitter-dart.git"
COMMIT="0038280b774b65c1b89ba7fec50624d8baed9fe1"
# Must match the web-tree-sitter version in package.json.
CLI_VERSION="0.25.10"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK:?}"' EXIT

git clone --quiet "$REPO_URL" "$WORK/tree-sitter-dart"
git -C "$WORK/tree-sitter-dart" checkout --quiet "$COMMIT"
rm -f "$WORK/tree-sitter-dart/tree-sitter-dart.wasm"
(cd "$WORK/tree-sitter-dart" && npx -y "tree-sitter-cli@$CLI_VERSION" build --wasm -o tree-sitter-dart.wasm .)
cp "$WORK/tree-sitter-dart/tree-sitter-dart.wasm" "$ROOT/grammars/tree-sitter-dart.wasm"
cp "$WORK/tree-sitter-dart/LICENSE" "$ROOT/grammars/LICENSE-tree-sitter-dart"
shasum -a 256 "$ROOT/grammars/tree-sitter-dart.wasm"
