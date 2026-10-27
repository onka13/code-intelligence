# Code Intelligence

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-strict-3178c6.svg?logo=typescript&logoColor=white)](tsconfig.json)
[![Tests](https://github.com/onka13/code-intelligence/actions/workflows/ci.yml/badge.svg)](https://github.com/onka13/code-intelligence/actions/workflows/ci.yml)
[![Node: >=22](https://img.shields.io/badge/node-%3E%3D22-339933.svg?logo=node.js&logoColor=white)](package.json)

**Give your AI coding tool a map of the codebase, not a pile of files.**

Code Intelligence scans a project and produces every file's declarations with their members and signatures, the import graph, the most central files, and the files around a change within a token budget. One Tree-sitter **language pack** per language, so anyone can add one. No network access, no telemetry, no model calls.

> **Why not embeddings?**
> Vector search is fuzzy and semantic; it misses structural dependencies and import graphs. Text search (grep) has no concept of scopes or ASTs. Code Intelligence gives agents deterministic, language-level structural awareness with zero embedding costs.
>
> Embeddings are still the better tool for fuzzy questions such as "where do we handle retries?" when you do not know the names. The two complement each other: use search to find where to look, and Code Intelligence to see what surrounds it.

> **Status:** version 0.5. The command-line interface and the library are usable today, and the output schemas are versioned. Details may still change before 1.0.

## What it does, in one example

An AI tool that changes `orderService.ts` needs to know what the file declares and what is around it. It does not need every line of every file. The scan keeps each file's **skeleton**: its declarations and signatures, without the bodies.

<table>
<tr><th>Source: 28 lines, 259 tokens</th><th>Skeleton: 93 tokens</th></tr>
<tr><td>

```ts
import { randomUUID } from 'node:crypto';
import { IOrderRepository } from './orderRepository';
import { Order, OrderItem, MAX_ITEMS } from './types';
import { OrderEvents } from './orderEvents';
import { Result } from '../shared/result';

export interface IOrderService {
  find(id: string): Promise<Order | undefined>;
  place(items: OrderItem[]): Promise<Result<Order>>;
}

export class OrderService implements IOrderService {
  private readonly events = new OrderEvents();

  constructor(private readonly repository: IOrderRepository) {}

  async find(id: string): Promise<Order | undefined> {
    return this.repository.findById(id);
  }

  async place(items: OrderItem[]): Promise<Result<Order>> {
    if (items.length > MAX_ITEMS) return Result.fail(`At most ${MAX_ITEMS} items`);
    const order: Order = { id: randomUUID(), items, status: 'NEW' };
    const saved = await this.repository.save(order);
    this.events.placed(saved, this);
    return Result.ok(saved);
  }
}
```

</td><td>

```ts
interface IOrderService {
  find(id: string): Promise<Order | undefined>;
  place(items: OrderItem[]): Promise<Result<Order>>;
}

class OrderService implements IOrderService {
  constructor(private readonly repository: IOrderRepository);
  async find(id: string): Promise<Order | undefined>;
  async place(items: OrderItem[]): Promise<Result<Order>>;
}
```

</td></tr>
</table>

That is **64% fewer tokens** for this file (259 down to 93). The scan also resolves every import to a project file or a package. That gives a dependency graph, so a tool can ask which files matter most and which files surround a change, and get answers that fit a token budget.

## On a real project

A production app with three tiers: a Flutter mobile app, a TypeScript API and a React admin panel. Measured on an Apple M4 Pro with Node 22.

| Tier | Files scanned | Declarations | Source tokens | Skeleton tokens | Saved | First scan | Rescan |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Flutter app (Dart) | 613 | 5,616 | 456,709 | 68,777 | 85% | 792 ms | 32 ms |
| API (TypeScript) | 194 | 2,326 | 172,827 | 29,337 | 83% | 263 ms | 15 ms |
| Admin (React) | 41 | 2,204 | 124,354 | 19,132 | 85% | 204 ms | 8 ms |
| **Total** | **848** | **10,146** | **753,890** | **117,246** | **84%** | **1.3 s** | **55 ms** |

Token columns count the 758 source files that parsed, without data files. 30 Dart files did not parse and are left out: the bundled Dart grammar predates Dart 3 records and patterns, which freezed output uses, and is being replaced. A rescan with no changes reads only file sizes and modification times.

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

## A tour on a sample project

Every language pack ships a small project and the outputs expected from it (`packs/<pack>/fixtures/project` and `fixtures/expected`). The TypeScript one is a 19-file order service. The commands below run on it after `npm install && npm run build`, and every output shown is real.

**Scan it.**

```console
$ node dist/src/cli.js scan packs/typescript/fixtures/project --out /tmp/demo
Scanned 19 files (19 parsed, 0 unchanged) in 219 ms; 90 declarations.
$ node dist/src/cli.js scan packs/typescript/fixtures/project --out /tmp/demo
Scanned 19 files (0 parsed, 19 unchanged) in 3 ms; 90 declarations.
```

**Read the map** of a folder: one line per file with its declarations. `--fields` adds fields and constants, and `--full` prints whole signatures.

```console
$ node dist/src/cli.js map src/orders --out /tmp/demo
📁 orders/
├── 📄 orderEvents.ts  // class OrderEvents { placed() }
├── 📄 orderRepository.ts  // interface IOrderRepository { findById(), save() } | class InMemoryOrderRepository { findById(), save() }
├── 📄 orderService.ts  // interface IOrderService { find(), place() } | class OrderService { find(), place() }
├── 📄 types.ts  // enum PaymentMethod | interface OrderItem | interface Order | type OrderStatus
└── 📄 validation.ts  // type Validation, validateOrder()

$ node dist/src/cli.js map src/orders/orderService.ts --full --out /tmp/demo
interface IOrderService { find(id: string): Promise<Order | undefined>; place(items: OrderItem[]): Promise<Result<Order>>; }
class OrderService implements IOrderService { async find(id: string): Promise<Order | undefined>; async place(items: OrderItem[]): Promise<Result<Order>>; }
```

**Find the hubs**, the files most of the project depends on. The score is twice the number of files importing the file plus the number of files it imports. PageRank also counts how central those importers are.

```console
$ node dist/src/cli.js hubs --top 5 --out /tmp/demo
#1  src/orders/orderService.ts  score 14  in 5  out 4  pagerank 0.102784
#2  src/orders/types.ts  score 12  in 6  out 0  pagerank 0.209998
#3  src/shared/logger.ts  score 8  in 4  out 0  pagerank 0.097353
#4  src/orders/orderRepository.ts  score 7  in 3  out 1  pagerank 0.077725
#5  src/orders/orderEvents.ts  score 5  in 1  out 3  pagerank 0.0524
```

**Pick the context for a change.** The target is read in full (tier 3). Then come the files it imports and the files that import it (tier 2), then what those import (tier 1). Within each tier the most central files come first, and they are added as skeletons while they fit the budget. A tool puts exactly this list into its prompt.

```console
$ node dist/src/cli.js neighborhood src/orders/orderService.ts --budget 400 --out /tmp/demo
tier 3  src/orders/orderService.ts  (259 tokens; target)
tier 2  src/orders/types.ts  (79 tokens; imported by src/orders/orderService.ts)
tier 2  src/orders/orderRepository.ts  (75 tokens; imported by src/orders/orderService.ts)
tier 2  src/app.ts  (8 tokens; imports src/orders/orderService.ts)
tier 2  src/controllers/OrderController.ts  (60 tokens; imports src/orders/orderService.ts)
tier 2  src/orders/orderEvents.ts  (20 tokens; imported by src/orders/orderService.ts)
tier 2  src/routes/orderRoutes.ts  (14 tokens; imports src/orders/orderService.ts)
tier 2  src/shared/result.ts  (46 tokens; imported by src/orders/orderService.ts)
tier 1  src/shared/logger.ts  (43 tokens; imported by src/orders/orderEvents.ts)
tier 1  src/orders/validation.ts  (43 tokens; imported by src/controllers/OrderController.ts)
388 of 400 tokens used; 2 files left out (172 tokens).
```

**Check its health** against your own limits. The sample has one import cycle on purpose: `orderService.ts` and `orderEvents.ts` import each other.

```console
$ node dist/src/cli.js health packs/typescript/fixtures/project --out /tmp/demo --max-file-lines 300 --max-function-lines 25 --hard-function-lines 40 --max-nesting-depth 4 --min-duplicate-lines 6
17 files, 280 lines; 0 files over 300 lines; 0 functions over 25 and 0 over 40 lines; 0 functions nested deeper than 4; 0 duplicated blocks; 1 import cycles; 0 files not measured.
```

Every command except `map` takes `--json` for the same answer as data.

## Outputs

| File | What it holds | Schema |
| :--- | :--- | :--- |
| `ast_code_map.json` | Every file: language, declarations as a tree (classes hold their fields, methods, getters and constructors, with signatures and visibility), imports resolved to project files or packages, a skeleton, token estimates, parse errors; the scan summary; the dependency audit | `schema/ast_code_map.schema.json` |
| `topology.json` | Files and their top-level declarations as nodes; `imports`, `defines`, `extends`, `implements` edges; in- and out-degree, centrality score, PageRank, clusters, import cycles, top hubs | `schema/topology.schema.json` |
| `TopologyFULL.txt` | The folder tree with every public declaration and its public members under each file | text |
| `project_structure.md` | The same declarations as Markdown, one section per file | text |

The excerpts below come from the tour's scan of `orderService.ts`. The complete expected outputs of every sample project are in `packs/<pack>/fixtures/expected/`, for example [C#](packs/csharp/fixtures/expected/), where a solution's project references are edges too.

`ast_code_map.json`: one record per file, with nested declarations, resolved imports and token counts (trimmed):

```json
{
  "path": "src/orders/orderService.ts",
  "language": "typescript",
  "symbols": [
    { "kind": "class", "name": "OrderService", "signature": "class OrderService implements IOrderService",
      "implements": ["IOrderService"], "lineStart": 12, "lineEnd": 28,
      "members": [
        { "kind": "method", "name": "place", "signature": "async place(items: OrderItem[]): Promise<Result<Order>>",
          "visibility": "public", "type": "Promise<Result<Order>>", "lineStart": 21, "lineEnd": 27, "nesting": 1 }
      ] }
  ],
  "imports": [
    { "specifier": "node:crypto", "line": 1, "kind": "builtin" },
    { "specifier": "./orderRepository", "line": 2, "kind": "file", "target": "src/orders/orderRepository.ts" }
  ],
  "rawTokens": 259,
  "skeletonTokens": 93
}
```

`topology.json`: the same file as a node, and its edges (trimmed):

```json
{
  "nodes": [
    { "id": "file:src/orders/orderService.ts", "type": "file", "language": "typescript", "tokenEstimate": 259,
      "inDegree": 5, "outDegree": 4, "centralityScore": 14, "pageRank": 0.102784, "cluster": "src/orders" }
  ],
  "edges": [
    { "source": "file:src/orders/orderService.ts", "target": "file:src/orders/types.ts", "type": "imports" },
    { "source": "file:src/orders/orderService.ts", "target": "symbol:src/orders/orderService.ts#OrderService", "type": "defines" },
    { "source": "symbol:src/orders/orderService.ts#OrderService", "target": "symbol:src/orders/orderService.ts#IOrderService", "type": "implements" }
  ]
}
```

Every JSON output carries `schemaVersion` and `generatorVersion`. A breaking change to a schema is a new schema version and a new major release; readers refuse outputs of another schema version instead of converting them.

What the scan leaves out: dot folders and files, a default list of dependency, build and platform-shell folders (`node_modules`, `build`, `dist`, `ios`, `android`, ...), everything `.gitignore` and `.contextignore` exclude (at every level, up to the repository root), and the paths given with `--exclude`. Files no pack claims are listed as `other` with no declarations, and the summary counts them by extension; nothing is guessed. A file with a syntax error is recorded with the error and no declarations, and the scan goes on.

## Code health

```bash
node dist/src/cli.js health path/to/project --max-file-lines 300 --max-function-lines 25 --hard-function-lines 40 --max-nesting-depth 4 --min-duplicate-lines 6 --json > after.json
node dist/src/cli.js health-compare before.json after.json --json
```

`health` reads the scan's outputs (`--out`, default `<folder>/.codeintel`) and the files, and reports files over the line limit, functions, methods, constructors, getters and setters over the soft and hard limits (with their line ranges), those nested deeper than `--max-nesting-depth` (the most if, loop, switch and try blocks inside each other; an `else if` stays on its `if`'s level and a lambda adds no level, its statements count; the code map records each function's `nesting`), duplicated blocks (the same run of significant lines, at least `--min-duplicate-lines` long, in two places; blank lines and bracket-only lines do not count, whitespace is collapsed), import cycles, and the totals (with the deepest nesting). Every limit is required: the command names a missing one and assumes none. Data files (JSON, YAML) are left out; files no pack reads, too large or with a syntax error are listed as not measured, never as healthy.

`health-compare` takes two reports made with the same limits (for example of a change's base commit and of its result) and lists what the change did: files and functions that crossed a limit (length or nesting), new duplicated blocks, new import cycles, changed files that could not be measured, and the totals before and after.

## Languages

| Pack | Files | Notes |
| :--- | :--- | :--- |
| `typescript` | `.ts .tsx .mts .cts .js .jsx .mjs .cjs` | Grammar from `tree-sitter-typescript` 0.23.2; a bare `&` in JSX text is read; `tsconfig.json` `paths` and `baseUrl`; NodeNext `./a.js` imports resolve to `a.ts`; CommonJS exports |
| `dart` | `.dart` | the project's own `package:` imports resolve to `lib/`; Flutter lifecycle methods are marked |
| `csharp` | `.cs` | Classes, structs, records, interfaces, enums and delegates with all their members; `using` resolves to project files ([details](packs/csharp/README.md)) |
| `msbuild` | `.csproj .props .targets .sln .slnx` | Package dependencies, and project references as graph edges ([details](packs/msbuild/README.md)) |
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
