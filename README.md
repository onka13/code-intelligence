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

## Code health

```bash
node dist/src/cli.js health path/to/project --max-file-lines 300 --max-function-lines 25 --hard-function-lines 40 --min-duplicate-lines 6 --json > after.json
node dist/src/cli.js health-compare before.json after.json --json
```

`health` reads the scan's outputs (`--out`, default `<folder>/.codeintel`) and the files, and reports files over the line limit, functions, methods, constructors, getters and setters over the soft and hard limits (with their line ranges), duplicated blocks (the same run of significant lines, at least `--min-duplicate-lines` long, in two places; blank lines and bracket-only lines do not count, whitespace is collapsed), import cycles, and the totals. Every limit is required: the command names a missing one and assumes none. Data files (JSON, YAML) are left out; files no pack reads, too large or with a syntax error are listed as not measured, never as healthy.

`health-compare` takes two reports made with the same limits (for example of a change's base commit and of its result) and lists what the change did: files and functions that crossed a limit, new duplicated blocks, new import cycles, changed files that could not be measured, and the totals before and after.

## Languages

| Pack | Files | Notes |
| :--- | :--- | :--- |
| `typescript` | `.ts .tsx .mts .cts .js .jsx .mjs .cjs` | `tsconfig.json` `paths` and `baseUrl`; NodeNext `./a.js` imports resolve to `a.ts`; CommonJS exports |
| `dart` | `.dart` | the project's own `package:` imports resolve to `lib/`; Flutter lifecycle methods are marked |
| `csharp` | `.cs` | classes, structs, records (positional parameters as properties), interfaces, enums and delegates, with nested types, methods, constructors, operators, indexers, properties (with their accessors) and fields; `public` and `internal` count as public. A `using` resolves to every project file that declares the namespace (for `using static` and aliases also the namespace the type sits in); any other namespace is a package. Base types named `I` + capital are interfaces. Grammar from `tree-sitter-c-sharp` 0.23.5 (C# 12 and later) |
| `msbuild` | `.csproj .props .targets .sln .slnx` | `PackageReference` entries are dependencies (`PrivateAssets="all"` as development ones; the version is empty with central package management); `ProjectReference` entries and the projects of a solution are imports, so project references are edges of the graph. Read by a small strict XML reader: a malformed file is recorded with its error |
| `json` | `.json` | comments and trailing commas allowed; `package.json` dependencies |
| `yaml` | `.yaml .yml` | `pubspec.yaml` dependencies, including SDK, path and git dependencies |

Adding a language: see `CONTRIBUTING.md`.

## Library

```ts
import { scan, renderMap, neighborhood, hubs, health, compareHealth, readCodeMap, readTopology, PACKS } from 'code-intelligence';

const { map, topology } = await scan({ root: 'path/to/project', out: '.codeintel', packs: PACKS });
console.log(renderMap(map, { fields: true, depth: 4 }));
```

No network access, no telemetry, no model calls.
