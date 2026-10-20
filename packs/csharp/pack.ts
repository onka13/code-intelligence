import type { Language, Node } from 'web-tree-sitter';
import type { LanguagePack, ParsedFile, RawImport } from '../../src/packs/pack.js';
import { nest } from '../../src/packs/symbols.js';
import { query, withTree } from '../../src/packs/treeSitter.js';
import { readPackFile } from '../../src/packs/packFiles.js';
import { describe } from './declarations.js';
import { resolveCSharp } from './resolve.js';

/** C# (Tree-sitter grammar `c_sharp`, from the pinned tree-sitter-c-sharp package). */

const QUERIES = { symbols: readPackFile(import.meta.url, 'symbols.scm'), imports: readPackFile(import.meta.url, 'imports.scm') };
/** The name a using directive imports: its last name node that is not the alias. */
const NAME_TYPES = new Set(['identifier', 'qualified_name', 'generic_name', 'alias_qualified_name']);

function captured(language: Language, key: keyof typeof QUERIES, root: Node): Node[] {
  return query(language, `csharp-${key}`, QUERIES[key]).captures(root).map((c) => c.node);
}

function imports(language: Language, root: Node): RawImport[] {
  return captured(language, 'imports', root).flatMap((node) => {
    const alias = node.childForFieldName('name');
    const target = node.namedChildren.filter((c): c is Node => !!c && NAME_TYPES.has(c.type) && c.id !== alias?.id).pop();
    return target ? [{ specifier: target.text.replace(/\s+/g, ''), line: node.startPosition.row + 1 }] : [];
  });
}

export const csharpPack: LanguagePack = {
  id: 'csharp',
  claims: (file) => file.endsWith('.cs'),
  parse: ({ content }) =>
    withTree('c_sharp', content, (root, language): ParsedFile => ({
      symbols: nest(captured(language, 'symbols', root).flatMap((node) => describe(node, content))),
      imports: imports(language, root),
    })),
  resolve: resolveCSharp,
};
