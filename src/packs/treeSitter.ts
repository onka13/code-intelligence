import { createRequire } from 'node:module';
import path from 'node:path';
import { Language, Parser, Query, type Node } from 'web-tree-sitter';
import { ParseError } from './pack.js';

/** Tree-sitter through WebAssembly (decision Q51): one grammar file serves every machine. */

const require = createRequire(import.meta.url);
let init: Promise<void> | undefined;
const parsers = new Map<string, Promise<{ parser: Parser; language: Language }>>();
/** Compiled queries per grammar: node ids differ between grammars, so a query never crosses languages. */
const queries = new WeakMap<Language, Map<string, Query>>();

/**
 * Grammars that `tree-sitter-wasms` ships too old for current code come from the grammar's own package, pinned in
 * package.json (C#: tree-sitter-wasms has 0.20, which predates C# 12; TypeScript and TSX: its 0.20 grammar rejects a
 * bare `&` in JSX text).
 */
const OWN_PACKAGE: Record<string, string> = {
  c_sharp: 'tree-sitter-c-sharp',
  typescript: 'tree-sitter-typescript',
  tsx: 'tree-sitter-typescript',
};

function grammarFile(grammar: string): string {
  const own = OWN_PACKAGE[grammar];
  if (own) return path.join(path.dirname(require.resolve(`${own}/package.json`)), `tree-sitter-${grammar}.wasm`);
  return path.join(path.dirname(require.resolve('tree-sitter-wasms/package.json')), 'out', `tree-sitter-${grammar}.wasm`);
}

async function load(grammar: string): Promise<{ parser: Parser; language: Language }> {
  init ??= Parser.init();
  await init;
  const language = await Language.load(grammarFile(grammar));
  const parser = new Parser();
  parser.setLanguage(language);
  return { parser, language };
}

function parserFor(grammar: string) {
  if (!parsers.has(grammar)) parsers.set(grammar, load(grammar));
  return parsers.get(grammar)!;
}

/** A query compiled once per grammar and key. */
export function query(language: Language, key: string, source: string): Query {
  if (!queries.has(language)) queries.set(language, new Map());
  const compiled = queries.get(language)!;
  if (!compiled.has(key)) compiled.set(key, new Query(language, source));
  return compiled.get(key)!;
}

/**
 * Error nodes that are gaps of a pinned grammar, not errors in the code: valid code the grammar cannot read while the
 * rest of the tree stays intact. TSX: a bare `&` in JSX text ("Roles & Permissions"), which TypeScript and React accept;
 * the newest tree-sitter-typescript (0.23.2) still rejects it.
 */
const GRAMMAR_GAPS: Record<string, (error: Node) => boolean> = {
  tsx: (error) => error.parent?.type === 'jsx_element' && /^&[^{}<>]*$/.test(error.text),
};

/** The first syntax error of a tree, as a message with its line, or undefined. */
function firstError(node: Node, isGap?: (error: Node) => boolean): string | undefined {
  if (node.isMissing) return `Syntax error at line ${node.startPosition.row + 1}: missing ${node.type}`;
  if (node.type === 'ERROR') return isGap?.(node) ? undefined : `Syntax error at line ${node.startPosition.row + 1}`;
  if (!node.hasError) return undefined;
  for (const child of node.children) {
    const found = child && firstError(child, isGap);
    if (found) return found;
  }
  return undefined;
}

/**
 * Parses `content` with a grammar and hands the tree to `use`; the tree's WebAssembly memory is freed afterwards.
 * A syntax error anywhere is a ParseError (the file then has no symbols, CIN-04).
 */
export async function withTree<T>(grammar: string, content: string, use: (root: Node, language: Language) => T): Promise<T> {
  const { parser, language } = await parserFor(grammar);
  const tree = parser.parse(content);
  if (!tree) throw new ParseError('The parser returned no tree');
  try {
    const error = firstError(tree.rootNode, GRAMMAR_GAPS[grammar]);
    if (error) throw new ParseError(error);
    return use(tree.rootNode, language);
  } finally {
    tree.delete();
  }
}
