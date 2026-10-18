import path from 'node:path';
import type { Language, Node } from 'web-tree-sitter';
import type { LanguagePack, ParsedFile, RawImport } from '../../src/packs/pack.js';
import { nest, type Declared } from '../../src/packs/symbols.js';
import { query, withTree } from '../../src/packs/treeSitter.js';
import { readPackFile } from '../../src/packs/packFiles.js';
import { describeTopLevel, type FileContext } from './declarations.js';
import { describeMember } from './members.js';
import { resolveTypeScript } from './resolve.js';

/** TypeScript and JavaScript, including TSX and JSX (Tree-sitter grammars `typescript` and `tsx`). */

const QUERIES = {
  symbols: readPackFile(import.meta.url, 'symbols.scm'),
  imports: readPackFile(import.meta.url, 'imports.scm'),
  exports: readPackFile(import.meta.url, 'exports.scm'),
};
const GRAMMAR: Record<string, string> = {
  '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.tsx': 'tsx', '.js': 'tsx', '.jsx': 'tsx', '.mjs': 'tsx', '.cjs': 'tsx',
};

function captures(language: Language, key: keyof typeof QUERIES, root: Node, name: string): Node[] {
  return query(language, `ts-${key}`, QUERIES[key]).captures(root).filter((c) => c.name === name).map((c) => c.node);
}

function imports(language: Language, root: Node): RawImport[] {
  return captures(language, 'imports', root, 'source').map((node) => {
    const statement = node.parent?.parent;
    const typeOnly = statement?.type === 'import_statement' && statement.children.some((c) => c?.type === 'type');
    return { specifier: node.text, line: node.startPosition.row + 1, ...(typeOnly ? { typeOnly } : {}) };
  });
}

function symbols(language: Language, root: Node, source: string) {
  const ctx: FileContext = { source, exportedNames: new Set(captures(language, 'exports', root, 'name').map((n) => n.text)) };
  const found: Declared[] = [];
  for (const node of captures(language, 'symbols', root, 'symbol')) {
    const top = describeTopLevel(node, ctx);
    found.push(...(top ? [top] : describeMember(node, source) ?? []));
  }
  return nest(found);
}

export const typescriptPack: LanguagePack = {
  id: 'typescript',
  claims: (file) => path.posix.extname(file) in GRAMMAR,
  parse: ({ path: file, content }) =>
    withTree(GRAMMAR[path.posix.extname(file)], content, (root, language): ParsedFile => ({
      symbols: symbols(language, root, content),
      imports: imports(language, root),
    })),
  resolve: resolveTypeScript,
};
