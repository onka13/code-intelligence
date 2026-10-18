/** The shapes of the published outputs (`schema/*.schema.json`). A breaking change is a new major version. */

export type SymbolKind =
  | 'class' | 'interface' | 'enum' | 'mixin' | 'extension' | 'type'
  | 'function' | 'variable'
  | 'method' | 'constructor' | 'field' | 'getter' | 'setter' | 'enumMember';

export type Visibility = 'public' | 'protected' | 'private';

/** One declaration. Containers (class, interface, enum, mixin, extension) hold their members. */
export interface SymbolNode {
  kind: SymbolKind;
  name: string;
  /** The declaration on one line, without its body or initializer. */
  signature: string;
  /** A field's declared type, or a function's return type, when the source states it. */
  type?: string;
  lineStart: number;
  lineEnd: number;
  /** Top level: exported from the file. Members: visible outside the class (public). */
  exported: boolean;
  visibility: Visibility;
  static?: boolean;
  /** A framework callback such as `build` or `render`, left out of the map text. */
  lifecycle?: boolean;
  extends?: string[];
  implements?: string[];
  mixins?: string[];
  members?: SymbolNode[];
}

export type ImportKind = 'file' | 'package' | 'builtin' | 'unresolved';

export interface ImportRef {
  specifier: string;
  line: number;
  typeOnly?: boolean;
  kind: ImportKind;
  /** The project file it resolves to (`kind: file`). */
  target?: string;
  /** The package name (`kind: package`), for the dependency audit. */
  package?: string;
}

export interface DeclaredDependency {
  name: string;
  version: string;
  dev: boolean;
  /** Declared through an SDK (`sdk: flutter`), never imported by name. */
  sdk?: boolean;
}

export interface FileRecord {
  path: string;
  language: string;
  sizeBytes: number;
  mtimeMs: number;
  symbols: SymbolNode[];
  imports: ImportRef[];
  skeleton: string;
  rawTokens: number;
  skeletonTokens: number;
  /** The parse error; the file then has no symbols. */
  error?: string;
  /** Why the file was not parsed (too large). */
  skipped?: string;
  /** Dependencies a manifest file declares. */
  declares?: DeclaredDependency[];
}

export interface AuditEntry {
  name: string;
  manifest: string;
  version: string;
  dev: boolean;
  dormant: boolean;
  importCount: number;
  files: string[];
}

export interface ScanSummary {
  files: number;
  parsed: number;
  reused: number;
  failed: Array<{ path: string; error: string }>;
  /** Files no pack claims, by extension (or file name when it has none). */
  unsupported: Record<string, number>;
  languages: Record<string, number>;
  symbols: number;
  rawTokens: number;
  skeletonTokens: number;
  durationMs: number;
}

export interface Generator {
  schemaVersion: number;
  generatorVersion: string;
  generatedAt: string;
}

export interface CodeMap extends Generator {
  /** The scanned folder's name, the root of the map text. */
  rootName: string;
  summary: ScanSummary;
  files: FileRecord[];
  audit: AuditEntry[];
}

export type NodeType = 'file' | 'class' | 'interface' | 'enum' | 'mixin' | 'extension' | 'type' | 'function';
export type EdgeType = 'imports' | 'defines' | 'extends' | 'implements';

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  type: NodeType;
  language?: string;
  line?: number;
  tokenEstimate?: number;
  inDegree: number;
  outDegree: number;
  /** In-degree twice plus out-degree, over import edges for files. */
  centralityScore: number;
  pageRank: number;
  cluster: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface Hub {
  id: string;
  path: string;
  inDegree: number;
  outDegree: number;
  centralityScore: number;
  pageRank: number;
}

export interface Topology extends Generator {
  summary: {
    totalFiles: number;
    totalSymbols: number;
    totalNodes: number;
    totalEdges: number;
    density: number;
    circularDependencies: Array<{ cycle: string[] }>;
    clusters: Array<{ name: string; nodeCount: number }>;
    topHubs: Hub[];
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
}
