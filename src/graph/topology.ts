import type { FileRecord, GraphNode, Hub, Topology } from '../model.js';
import type { Generator } from '../model.js';
import { buildGraph } from './build.js';
import { clusterOf, cycles, degrees, pageRank } from './metrics.js';

/**
 * The topology graph (graphify_topology.json). File degrees count import edges; a declaration's degrees count the
 * extends and implements edges. `centralityScore` is twice the in-degree plus the out-degree; `pageRank` ranks files
 * by the import graph.
 */

const TOP_HUBS = 10;
const FILE_EDGES = new Set(['imports']);
const SYMBOL_EDGES = new Set(['extends', 'implements']);

const toHub = (n: GraphNode): Hub => ({ id: n.id, path: n.path, inDegree: n.inDegree, outDegree: n.outDegree, centralityScore: n.centralityScore, pageRank: n.pageRank });

/** Files by centrality score, then PageRank, then path. */
export function rankHubs(nodes: GraphNode[], top: number): Hub[] {
  return nodes
    .filter((n) => n.type === 'file')
    .sort((a, b) => b.centralityScore - a.centralityScore || b.pageRank - a.pageRank || (a.path < b.path ? -1 : 1))
    .slice(0, top)
    .map(toHub);
}

function clusters(nodes: GraphNode[]): Array<{ name: string; nodeCount: number }> {
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.cluster, (counts.get(n.cluster) ?? 0) + 1);
  return [...counts].map(([name, nodeCount]) => ({ name, nodeCount })).sort((a, b) => b.nodeCount - a.nodeCount || (a.name < b.name ? -1 : 1));
}

export function buildTopology(records: FileRecord[], codeLanguages: Set<string>, generator: Generator): Topology {
  const { nodes: raw, edges } = buildGraph(records, codeLanguages);
  const fileIds = raw.filter((n) => n.type === 'file').map((n) => n.id);
  const fileDegrees = degrees(edges, FILE_EDGES);
  const symbolDegrees = degrees(edges, SYMBOL_EDGES);
  const ranks = pageRank(fileIds, edges.filter((e) => e.type === 'imports'));
  const nodes: GraphNode[] = raw.map((n) => {
    const d = n.type === 'file' ? fileDegrees : symbolDegrees;
    const inDegree = d.inDegree.get(n.id) ?? 0;
    const outDegree = d.outDegree.get(n.id) ?? 0;
    return { ...n, inDegree, outDegree, centralityScore: inDegree * 2 + outDegree, pageRank: ranks.get(n.id) ?? 0, cluster: clusterOf(n.path) };
  });
  const count = nodes.length;
  return {
    ...generator,
    summary: {
      totalFiles: fileIds.length,
      totalSymbols: count - fileIds.length,
      totalNodes: count,
      totalEdges: edges.length,
      density: count > 1 ? Number((edges.length / (count * (count - 1))).toFixed(5)) : 0,
      circularDependencies: cycles(fileIds, edges.filter((e) => e.type === 'imports')).map((c) => ({ cycle: c.map((id) => id.replace(/^file:/, '')) })),
      clusters: clusters(nodes),
      topHubs: rankHubs(nodes, TOP_HUBS),
    },
    nodes,
    edges,
  };
}
