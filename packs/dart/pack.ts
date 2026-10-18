import type { Language, Node } from 'web-tree-sitter';
import type { LanguagePack, ParsedFile, RawImport } from '../../src/packs/pack.js';
import { nest, type Declared } from '../../src/packs/symbols.js';
import { query, withTree } from '../../src/packs/treeSitter.js';
import { readPackFile } from '../../src/packs/packFiles.js';
import { describeTopLevel } from './declarations.js';
import { describeMember } from './members.js';
import { resolveDart } from './resolve.js';

/** Dart and Flutter (Tree-sitter grammar `dart`). */

const QUERIES = { symbols: readPackFile(import.meta.url, 'symbols.scm'), imports: readPackFile(import.meta.url, 'imports.scm') };
const MEMBER_PARENTS = new Set(['class_body', 'extension_body', 'enum_body']);

function captured(language: Language, key: keyof typeof QUERIES, root: Node): Node[] {
  return query(language, `dart-${key}`, QUERIES[key]).captures(root).filter((c) => !c.name.startsWith('_')).map((c) => c.node);
}

function imports(language: Language, root: Node): RawImport[] {
  return captured(language, 'imports', root).map((node) => ({ specifier: node.text.replace(/^r?(['"]{1,3})|(['"]{1,3})$/g, ''), line: node.startPosition.row + 1 }));
}

function symbols(language: Language, root: Node, source: string) {
  const found: Declared[] = [];
  for (const node of captured(language, 'symbols', root)) {
    if (MEMBER_PARENTS.has(node.parent?.type ?? '')) found.push(...describeMember(node, source));
    else {
      const top = describeTopLevel(node, source);
      if (top) found.push(top);
    }
  }
  return nest(found);
}

export const dartPack: LanguagePack = {
  id: 'dart',
  claims: (file) => file.endsWith('.dart'),
  parse: ({ content }) =>
    withTree('dart', content, (root, language): ParsedFile => ({ symbols: symbols(language, root, content), imports: imports(language, root) })),
  resolve: resolveDart,
};
