import type { CodeMap, FileRecord, GraphNode, Topology } from '../model.js';
import { fileId } from '../graph/build.js';

/**
 * The files around a change (CIN-08): the targets, their direct imports and importers (tier 2), then what those
 * import (tier 1). Each file comes with its brief (its skeleton), or is counted at its full size when the caller reads
 * contents instead. Without a budget every tier-2 file is taken and tier 1 is only counted; with one, files are taken
 * tier by tier, most central first, while they fit.
 */

export interface NeighborhoodEntry {
  path: string;
  tier: 1 | 2 | 3;
  reason: string;
  /** Brief tokens, or raw tokens when contents were asked for. */
  tokens: number;
  /** The file's brief; absent when contents were asked for. */
  brief?: string;
}

export interface NeighborhoodOptions {
  /** The most tokens the related files may take; absent: every direct import and importer, and no tier 1. */
  budget?: number;
  /** Count files at their full size, for a caller that reads their contents instead of their briefs. */
  contents?: boolean;
}

export interface Neighborhood {
  targets: NeighborhoodEntry[];
  selected: NeighborhoodEntry[];
  budget?: number;
  selectedTokens: number;
  omitted: { files: number; tokens: number };
}

export class UnknownFileError extends Error {}

interface Candidate {
  path: string;
  tier: 1 | 2;
  reason: string;
}

function adjacency(topology: Topology) {
  const out = new Map<string, string[]>();
  const into = new Map<string, string[]>();
  for (const e of topology.edges.filter((e) => e.type === 'imports')) {
    out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
    into.set(e.target, [...(into.get(e.target) ?? []), e.source]);
  }
  const strip = (ids: string[] | undefined) => (ids ?? []).map((id) => id.slice('file:'.length)).sort();
  return { imports: (p: string) => strip(out.get(fileId(p))), importers: (p: string) => strip(into.get(fileId(p))) };
}

function candidates(targets: string[], topology: Topology): Candidate[] {
  const graph = adjacency(topology);
  const seen = new Map<string, Candidate>(targets.map((t) => [t, { path: t, tier: 2, reason: 'target' }]));
  const add = (path: string, tier: 1 | 2, reason: string) => seen.has(path) || seen.set(path, { path, tier, reason });
  for (const t of targets) {
    graph.imports(t).forEach((p) => add(p, 2, `imported by ${t}`));
    graph.importers(t).forEach((p) => add(p, 2, `imports ${t}`));
  }
  const ring = [...seen.values()].filter((c) => c.tier === 2 && c.reason !== 'target');
  for (const c of ring) graph.imports(c.path).forEach((p) => add(p, 1, `imported by ${c.path}`));
  return [...seen.values()].filter((c) => c.reason !== 'target');
}

function entryOf(record: FileRecord, candidate: Omit<NeighborhoodEntry, 'tokens'>, contents: boolean): NeighborhoodEntry {
  if (contents) return { ...candidate, tokens: record.rawTokens };
  return { ...candidate, tokens: record.skeletonTokens, brief: record.skeleton };
}

export function neighborhood(map: CodeMap, topology: Topology, targetPaths: string[], options: NeighborhoodOptions = {}): Neighborhood {
  const records = new Map(map.files.map((f) => [f.path, f]));
  const targets = targetPaths.map((p) => p.replace(/^\.\//, ''));
  const unknown = targets.filter((t) => !records.has(t));
  if (unknown.length) throw new UnknownFileError(`Not in the code map: ${unknown.join(', ')}`);
  const { budget, contents = false } = options;
  const nodes = new Map<string, GraphNode>(topology.nodes.filter((n) => n.type === 'file').map((n) => [n.path, n]));
  const score = (p: string) => nodes.get(p)?.centralityScore ?? 0;
  const ordered = candidates(targets, topology).sort((a, b) => b.tier - a.tier || score(b.path) - score(a.path) || (a.path < b.path ? -1 : 1));
  const selected: NeighborhoodEntry[] = [];
  let used = 0;
  let omittedTokens = 0;
  for (const c of ordered) {
    const entry = entryOf(records.get(c.path)!, c, contents);
    const fits = budget === undefined ? c.tier === 2 : used + entry.tokens <= budget;
    if (fits) {
      selected.push(entry);
      used += entry.tokens;
    } else omittedTokens += entry.tokens;
  }
  return {
    targets: targets.map((t) => entryOf(records.get(t)!, { path: t, tier: 3, reason: 'target' }, contents)),
    selected, ...(budget === undefined ? {} : { budget }), selectedTokens: used,
    omitted: { files: ordered.length - selected.length, tokens: omittedTokens },
  };
}
