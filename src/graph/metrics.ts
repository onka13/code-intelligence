import type { GraphEdge } from '../model.js';

/** Graph measures: degrees, PageRank, cycles and clusters. Every result is deterministic for the same graph. */

const DAMPING = 0.85;
const ITERATIONS = 100;
const TOLERANCE = 1e-10;
const MAX_CYCLES = 20;

/** In- and out-degree per node, counting only the given edge types. */
export function degrees(edges: GraphEdge[], types: Set<string>): { inDegree: Map<string, number>; outDegree: Map<string, number> } {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const e of edges.filter((e) => types.has(e.type))) {
    outDegree.set(e.source, (outDegree.get(e.source) ?? 0) + 1);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }
  return { inDegree, outDegree };
}

/** PageRank over directed edges among `ids` (a node that links nowhere shares its rank with every node), rounded to 6 places. */
export function pageRank(ids: string[], edges: GraphEdge[]): Map<string, number> {
  const n = ids.length;
  const out = new Map(ids.map((id) => [id, [] as string[]]));
  for (const e of edges) if (out.has(e.source) && out.has(e.target)) out.get(e.source)!.push(e.target);
  let rank = new Map(ids.map((id) => [id, 1 / n]));
  for (let i = 0; i < ITERATIONS; i++) {
    const dangling = ids.filter((id) => out.get(id)!.length === 0).reduce((sum, id) => sum + rank.get(id)!, 0);
    const next = new Map(ids.map((id) => [id, (1 - DAMPING) / n + (DAMPING * dangling) / n]));
    for (const id of ids) for (const t of out.get(id)!) next.set(t, next.get(t)! + (DAMPING * rank.get(id)!) / out.get(id)!.length);
    const change = ids.reduce((sum, id) => sum + Math.abs(next.get(id)! - rank.get(id)!), 0);
    rank = next;
    if (change < TOLERANCE) break;
  }
  return new Map(ids.map((id) => [id, Number(rank.get(id)!.toFixed(6))]));
}

/** Import cycles found by a depth-first search in path order, each starting at its smallest file, at most 20. */
export function cycles(ids: string[], edges: GraphEdge[]): string[][] {
  const adj = new Map(ids.map((id) => [id, [] as string[]]));
  for (const e of edges) if (adj.has(e.source) && adj.has(e.target)) adj.get(e.source)!.push(e.target);
  adj.forEach((targets) => targets.sort());
  const found = new Map<string, string[]>();
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const visit = (id: string) => {
    state.set(id, 'open');
    stack.push(id);
    for (const t of adj.get(id)!) {
      if (state.get(t) === 'open') record(found, stack.slice(stack.indexOf(t)));
      else if (!state.has(t)) visit(t);
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of [...ids].sort()) if (!state.has(id)) visit(id);
  return [...found.values()].slice(0, MAX_CYCLES);
}

function record(found: Map<string, string[]>, loop: string[]): void {
  const start = loop.indexOf([...loop].sort()[0]);
  const rotated = [...loop.slice(start), ...loop.slice(0, start)];
  const key = rotated.join('>');
  if (!found.has(key)) found.set(key, [...rotated, rotated[0]]);
}

/** A file's cluster: its folder, at most two levels deep (`src/orders`, `lib/screens`); `.` for the root. */
export function clusterOf(path: string): string {
  const parts = path.split('/').slice(0, -1);
  return parts.length ? parts.slice(0, 2).join('/') : '.';
}
