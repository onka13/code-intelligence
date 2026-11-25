# Code Intelligence Roadmap (0.8+)

`v0.7.0` is tagged as the baseline release (incremental Tree-sitter scan, 6 language packs, `brief`, `neighborhood`, `hubs`, `health`, compact indented `map`).

The next architecture tackles the five bottlenecks observed in real agent benchmarks on large codebases:

1. **Scale (Progressive Zoom):** Dumping a full method-level map (~30K+ tokens) into every prompt does not scale and hurts cold-cache cost. Agents need layered zoom (modules → files & top-level symbols → briefs → exact line ranges).
2. **Name ≠ Behavior (Semantic Gap):** Symbol names tell *where* code lives, not what it throws, emits, or enforces. Extract deterministic AST signals first (routes, events, jobs, exceptions, roles); keep synonyms at query time rather than bloating the index.
3. **Hidden Flow (Implicit Wiring):** Static import graphs miss runtime edges (`@OnEvent`, job queues, DI `IInterface → Impl`, MediatR handlers). Agents need a linearized, depth-limited **flow tree** with `file:line` pointers, not raw JSON edges.
4. **Context Rot (Scout Isolation):** Exploration turns and maps belong in a cheap read-only scout agent (e.g., Flash / Hydrogen / Haiku), passing only verified `file:line` pointers and flow summaries to the primary model.
5. **Staleness (Auto-Freshness):** The incremental scanner already rescans in ~55 ms; queries/hooks should auto-refresh changed files before answering.

---

## Phase 1 — Layered Zoom, AST Signals, and Scout Benchmark

**Goal:** Cut initial map size by ~5× and give agents zero-LLM structural signals, then measure primary model vs. primary + cheap scout.

- **Layered map (`map --zoom 0|1|2`):**
  - `--zoom 0`: folders/modules with file counts and dominant roles (~500–1,500 tokens).
  - `--zoom 1`: files + top-level classes/interfaces/functions only (no method lists), excluding test files by default (`--include-tests` to show them). Target: ~4–5K tokens on a ~600-file repo.
  - `--zoom 2`: current method-level compact map (default or explicit).
- **Deterministic AST signals (TypeScript and C# first):**
  - Entrypoints from decorators/attributes (`@Get/@Post`, `[HttpGet]/[Route]`, `@OnEvent`, `@OnJob`).
  - Thrown exceptions (`throw new UnauthorizedException`, etc.).
  - Closed-vocabulary role tags (`http`, `event`, `job`, `db`, `auth`, `ui`, `io`) inferred from AST/imports/decorators.
- **Benchmark:**
  - Compare primary model alone vs. primary model + cheap scout (with Zoom 1 map + `brief` + `neighborhood`) on plain-language tasks (e.g., `immich-server-plain`).
  - Measure total cost, primary-model tokens, turns, and correctness.

**Done when:** `map --zoom 0|1|2` and AST signals have tests, `npm test` passes, and Phase 1 scout benchmark numbers are recorded.

---

## Phase 2 — Execution Flow Graph (`flow` and `impact`)

**Goal:** Answer "where does this flow go end to end?" and "what breaks if I change this?" in one call.

- **Static call & wiring edges (TypeScript and C# first, then Dart):**
  - Resolve `this.dep.method()` / `_dep.Method()` via constructor/field type annotations + imports.
  - Follow `implements` edges (`IOrderService.Place` → `OrderService.Place`).
  - Add virtual bridge nodes for async/indirect wiring:
    - Events (`emit('X')` ↔ `@OnEvent('X')`)
    - Jobs/queues (`queue(JobName.X)` ↔ `@OnJob(JobName.X)`)
    - C# MediatR (`Send(new XCommand())` ↔ `IRequestHandler<XCommand, ...>`)
  - Filter out stdlib/utility noise; tag external boundaries (`[db]`, `[http]`, `[queue]`, `[fs]`).
- **New CLI & library queries:**
  - `codeintel flow <symbol> [--depth 4]` — linearized downstream call/event tree with `file:line` addresses and edge kinds (`calls`, `emits`, `queues`, `impl`, `throws`).
  - `codeintel impact <symbol> [--depth 4]` — upstream callers/entry points reaching `<symbol>`.
- **Benchmark:** Re-run hard trace tasks (`immich-server-hard`, `immich-server-plain`) with `flow` and `impact` enabled on the scout.

**Done when:** `flow` and `impact` work on fixtures + Immich/C# samples with tests and cycle guards, and trace-task turn/cost impact is measured.

---

## Phase 3 — MCP Server, Auto-Freshness, and Release

**Goal:** Make Code Intelligence drop-in usable across coding agents with zero stale indexes.

- **Thin MCP server (`codeintel mcp`):**
  - Expose `map` (with zoom), `brief`, `neighborhood`, `flow`, `impact`, `hubs`, `health` over stdio MCP.
  - Works out of the box with Claude Code, Antigravity, Cursor, and Claude Desktop.
- **Auto-freshness:**
  - Run incremental `scan` automatically before MCP queries (or via `--fresh` on CLI) so changed files are re-parsed in milliseconds.
- **Docs & Publish:**
  - Add setup snippets (Claude Code, Antigravity, Cursor, Claude Desktop) to `README.md`.
  - Publish `@onka13/code-intelligence` to npm and share measured results.

---

## Phase 4 — Deferred / Optional Upgrades (Later)

Explicitly kept out of Phases 1–3 to ship fast:

- **Language-native semantic layer (optional):** Plug into Roslyn (`Microsoft.CodeAnalysis` / `scip-dotnet`), TypeScript Compiler API (`ts.createProgram`), or Dart `analyzer` for 100% resolution of complex generics, multi-level inheritance, and extension methods when the language toolchain is present.
- **Hash-cached 1-line LLM behavior summaries:** Optional sidecar (`.codeintel/summaries.json` keyed by function body hash) capturing non-obvious logic/invariants that AST cannot infer, using a strict schema.
- **Embedded BM25 / FTS5 code search:** Identifier-split lexical search over symbols/signals for very large repos (2,000+ files).
