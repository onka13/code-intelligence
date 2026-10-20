import type { DeclaredDependency, ImportRef, SymbolNode } from '../model.js';

/**
 * The language pack contract (feature 20 FR-04). A pack claims files and turns one file's text into declarations,
 * import specifiers and, for a manifest, declared dependencies. Resolving an import to a project file or a package
 * happens after every file is known, so a new file can resolve an import of an unchanged one.
 */
export interface LanguagePack {
  /** The pack's id; also the `language` of the files it claims. */
  id: string;
  /** Whether the pack reads this file (a path relative to the scan root). */
  claims(path: string): boolean;
  /** A data format (JSON, YAML) rather than code: code health leaves its files out. */
  data?: boolean;
  parse(input: ParseInput): Promise<ParsedFile>;
  /** Where an import points; packs without imports leave it out. A C# `using` can point at several files (one namespace, many files). */
  resolve?(input: ResolveInput): Resolution | Resolution[];
}

export interface ParseInput {
  path: string;
  content: string;
}

export interface RawImport {
  specifier: string;
  line: number;
  typeOnly?: boolean;
}

export interface ParsedFile {
  symbols: SymbolNode[];
  imports: RawImport[];
  /** A pack's own skeleton; the core renders one from the symbols when it is absent. */
  skeleton?: string;
  declares?: DeclaredDependency[];
}

/** What a resolver can see of the project: its scanned files, and their text on demand. */
export interface ProjectView {
  has(path: string): boolean;
  read(path: string): string | undefined;
  /** Every path of the scan, sorted. */
  paths(): readonly string[];
}

export interface ResolveInput {
  from: string;
  raw: RawImport;
  project: ProjectView;
}

export type Resolution = Pick<ImportRef, 'kind' | 'target' | 'package'>;

/** A parse failure the scan records against the file (CIN-04). */
export class ParseError extends Error {}
