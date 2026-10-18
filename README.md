# Code Intelligence

A map of a codebase for AI tools: every file's declarations with their members and signatures, the import graph, the most central files, and the files around a change within a token budget. One Tree-sitter **language pack** per language, so anyone can add one.

> Working name until the project is published. License: Apache-2.0.

## Quick start

```bash
npm install
npm run build
node dist/src/cli.js scan path/to/project --out path/to/project/.codeintel
node dist/src/cli.js map --out path/to/project/.codeintel --fields --depth 4
node dist/src/cli.js neighborhood src/orders/orderService.ts --budget 8000 --out path/to/project/.codeintel
node dist/src/cli.js hubs --top 10 --out path/to/project/.codeintel
```

A second `scan` parses only files whose size or modification time changed (`--full` parses everything). Queries read the stored outputs and never parse again.

## Outputs

| File | What it holds | Schema |
| :--- | :--- | :--- |
| `ast_code_map.json` | Every file: language, declarations as a tree (classes hold their fields, methods, getters and constructors, with signatures and visibility), imports resolved to project files or packages, a skeleton, token estimates, parse errors; the scan summary; the dependency audit | `schema/ast_code_map.schema.json` |
| `graphify_topology.json` | Files and their top-level declarations as nodes; `imports`, `defines`, `extends`, `implements` edges; in- and out-degree, centrality score, PageRank, clusters, import cycles, top hubs | `schema/graphify_topology.schema.json` |
| `TopologyFULL.txt` | The folder tree with every public declaration and its public members under each file | text |
| `project_structure.md` | The same declarations as Markdown, one section per file | text |

Every JSON output carries `schemaVersion` and `generatorVersion`. A breaking change to a schema is a new schema version and a new major release; readers refuse outputs of another schema version instead of converting them.

What the scan leaves out: dot folders and files, a default list of dependency, build and platform-shell folders (`node_modules`, `build`, `dist`, `ios`, `android`, ...), everything `.gitignore` and `.contextignore` exclude (at every level, up to the repository root), and the paths given with `--exclude`. Files no pack claims are listed as `other` with no declarations, and the summary counts them by extension; nothing is guessed. A file with a syntax error is recorded with the error and no declarations, and the scan goes on.

## Languages

| Pack | Files | Notes |
| :--- | :--- | :--- |
| `typescript` | `.ts .tsx .mts .cts .js .jsx .mjs .cjs` | `tsconfig.json` `paths` and `baseUrl`; NodeNext `./a.js` imports resolve to `a.ts`; CommonJS exports |
| `dart` | `.dart` | the project's own `package:` imports resolve to `lib/`; Flutter lifecycle methods are marked |
| `json` | `.json` | comments and trailing commas allowed; `package.json` dependencies |
| `yaml` | `.yaml .yml` | `pubspec.yaml` dependencies, including SDK, path and git dependencies |

Adding a language: see `CONTRIBUTING.md`.

## Library

```ts
import { scan, renderMap, neighborhood, hubs, readCodeMap, readTopology, PACKS } from 'code-intelligence';

const { map, topology } = await scan({ root: 'path/to/project', out: '.codeintel', packs: PACKS });
console.log(renderMap(map, { fields: true, depth: 4 }));
```

No network access, no telemetry, no model calls.
