import type { Language, Node } from 'web-tree-sitter';
import type { LanguagePack, ParsedFile, RawImport } from '../../src/packs/pack.js';
import { nest, withNesting } from '../../src/packs/symbols.js';
import { query, withTree } from '../../src/packs/treeSitter.js';
import { readPackFile } from '../../src/packs/packFiles.js';
import { describe } from './declarations.js';
import { resolveCSharp } from './resolve.js';

/** C# (Tree-sitter grammar `c_sharp`, from the pinned tree-sitter-c-sharp package). */

const QUERIES = { symbols: readPackFile(import.meta.url, 'symbols.scm'), imports: readPackFile(import.meta.url, 'imports.scm') };
/** The statements and expressions that open a nesting level (code health, FR-07). */
const BLOCKS = new Set([
  'if_statement', 'for_statement', 'foreach_statement', 'while_statement', 'do_statement', 'switch_statement', 'switch_expression',
  'try_statement', 'using_statement', 'lock_statement',
]);
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
      symbols: nest(withNesting(captured(language, 'symbols', root).flatMap((node) => describe(node, content)), root, BLOCKS)),
      imports: imports(language, root),
    })),
  resolve: resolveCSharp,
};
