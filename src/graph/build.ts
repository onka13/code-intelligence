import type { EdgeType, FileRecord, GraphEdge, NodeType, SymbolNode } from '../model.js';

/** Nodes and edges of the topology graph: files that import, their top-level declarations, and the links between them. */

export interface RawNode {
  id: string;
  label: string;
  path: string;
  type: NodeType;
  language?: string;
  line?: number;
  tokenEstimate?: number;
}

const SYMBOL_NODE_KINDS = new Set<NodeType>(['class', 'interface', 'enum', 'mixin', 'extension', 'type', 'function']);

export const fileId = (path: string) => `file:${path}`;
const symbolId = (path: string, name: string) => `symbol:${path}#${name}`;
/** `State<HomeScreen>` names the type `State`; `http.Client` names `Client`. */
const typeName = (ref: string) => ref.replace(/<.*$/s, '').split('.').pop()!.trim();

function fileNode(r: FileRecord): RawNode {
  return { id: fileId(r.path), label: r.path.split('/').pop()!, path: r.path, type: 'file', language: r.language, tokenEstimate: r.rawTokens };
}

function symbolNodes(r: FileRecord): RawNode[] {
  return r.symbols
    .filter((s) => SYMBOL_NODE_KINDS.has(s.kind as NodeType))
    .map((s) => ({ id: symbolId(r.path, s.name), label: s.name, path: r.path, type: s.kind as NodeType, line: s.lineStart }));
}

/** Import edges between project files, once per pair. */
function importEdges(r: FileRecord, files: Set<string>): GraphEdge[] {
  const targets = new Set(r.imports.filter((i) => i.kind === 'file' && i.target && files.has(i.target) && i.target !== r.path).map((i) => i.target!));
  return [...targets].sort().map((t) => ({ source: fileId(r.path), target: fileId(t), type: 'imports' }));
}

/** extends, with and implements: to a declaration of the same file or of a file it imports, found by name. */
function heritageEdges(r: FileRecord, byFile: Map<string, Set<string>>): GraphEdge[] {
  const visible = [r.path, ...r.imports.filter((i) => i.kind === 'file' && i.target).map((i) => i.target!)];
  const find = (name: string) => visible.find((p) => byFile.get(p)?.has(name));
  const link = (s: SymbolNode, refs: string[] | undefined, type: EdgeType) =>
    (refs ?? []).map(typeName).flatMap((name) => {
      const at = find(name);
      return at ? [{ source: symbolId(r.path, s.name), target: symbolId(at, name), type }] : [];
    });
  return r.symbols.flatMap((s) => [...link(s, [...(s.extends ?? []), ...(s.mixins ?? [])], 'extends'), ...link(s, s.implements, 'implements')]);
}

/** The graph of the files whose language has imports (`codeLanguages`); data files and unsupported files are not part of it. */
export function buildGraph(records: FileRecord[], codeLanguages: Set<string>): { nodes: RawNode[]; edges: GraphEdge[] } {
  const code = records.filter((r) => codeLanguages.has(r.language));
  const files = new Set(code.map((r) => r.path));
  const declared = new Map(code.map((r) => [r.path, new Set(symbolNodes(r).map((n) => n.label))]));
  const nodes = code.flatMap((r) => [fileNode(r), ...symbolNodes(r)]);
  const edges = code.flatMap((r) => [
    ...importEdges(r, files),
    ...symbolNodes(r).map((n) => ({ source: fileId(r.path), target: n.id, type: 'defines' as const })),
    ...heritageEdges(r, declared),
  ]);
  return { nodes, edges };
}
