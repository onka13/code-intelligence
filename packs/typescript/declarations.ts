import type { Node } from 'web-tree-sitter';
import type { SymbolKind } from '../../src/model.js';
import { oneLine } from '../../src/tokens.js';
import { childOfType, declared, header, splitList, type Declared } from '../../src/packs/symbols.js';

/** Top-level TypeScript and JavaScript declarations. */

const MAX_TYPE_ALIAS = 200;

export interface FileContext {
  source: string;
  /** Names exported by an export list, `export default <name>` or CommonJS. */
  exportedNames: Set<string>;
}

const CONTAINERS: Record<string, SymbolKind> = {
  class_declaration: 'class',
  abstract_class_declaration: 'class',
  interface_declaration: 'interface',
  enum_declaration: 'enum',
};

function isExported(node: Node, name: string, ctx: FileContext): boolean {
  return node.parent?.type === 'export_statement' || ctx.exportedNames.has(name);
}

function topLevel(node: Node, ctx: FileContext, kind: SymbolKind, signature: string, extra: Partial<Declared> = {}): Declared {
  const name = node.childForFieldName('name')?.text ?? 'default';
  const exported = isExported(node, name, ctx);
  return declared(node, { kind, name, signature, exported, visibility: exported ? 'public' : 'private', ...extra });
}

/** `extends A, B<C>` and `implements D` of a class or interface. */
function heritage(node: Node): { extends?: string[]; implements?: string[] } {
  const clause = (n: Node | undefined, keyword: string) => (n ? splitList(oneLine(n.text).replace(new RegExp(`^${keyword}\\s+`), '')) : undefined);
  const classHeritage = childOfType(node, 'class_heritage');
  const ext = clause(childOfType(classHeritage ?? node, 'extends_clause', 'extends_type_clause'), 'extends');
  const impl = clause(classHeritage && childOfType(classHeritage, 'implements_clause'), 'implements');
  return { ...(ext ? { extends: ext } : {}), ...(impl ? { implements: impl } : {}) };
}

function returnType(node: Node): string | undefined {
  const type = node.childForFieldName('return_type');
  return type ? oneLine(type.text).replace(/^:\s*/, '') : undefined;
}

function container(node: Node, ctx: FileContext): Declared {
  return topLevel(node, ctx, CONTAINERS[node.type], header(ctx.source, node, node.childForFieldName('body')), heritage(node));
}

function typeAlias(node: Node, ctx: FileContext): Declared {
  const text = oneLine(node.text).replace(/;$/, '');
  return topLevel(node, ctx, 'type', text.length > MAX_TYPE_ALIAS ? `${text.slice(0, MAX_TYPE_ALIAS)}…` : text);
}

function functionDeclaration(node: Node, ctx: FileContext): Declared {
  const signature = header(ctx.source, node, node.childForFieldName('body'));
  const type = returnType(node);
  return topLevel(node, ctx, 'function', signature, type ? { type } : {});
}

const FUNCTION_VALUES = new Set(['arrow_function', 'function_expression', 'function', 'generator_function']);

/** `const f = (a: A): B => ...` is a function; any other declarator is a variable. A destructuring pattern declares nothing to list. */
function variable(node: Node, ctx: FileContext): Declared | undefined {
  const nameNode = node.childForFieldName('name');
  if (nameNode?.type !== 'identifier') return undefined;
  const keyword = node.parent?.children[0]?.text ?? 'const';
  const name = nameNode.text;
  const annotation = node.childForFieldName('type');
  const value = node.childForFieldName('value');
  const exported = node.parent?.parent?.type === 'export_statement' || ctx.exportedNames.has(name);
  const base = { name, exported, visibility: exported ? 'public' as const : 'private' as const };
  if (value && FUNCTION_VALUES.has(value.type)) {
    const type = returnType(value);
    const signature = `${keyword} ${name} = ${header(ctx.source, value, value.childForFieldName('body'))}`;
    return declared(node, { ...base, kind: 'function', signature, ...(type ? { type } : {}) });
  }
  const type = annotation ? oneLine(annotation.text).replace(/^:\s*/, '') : undefined;
  return declared(node, { ...base, kind: 'variable', signature: `${keyword} ${name}${type ? `: ${type}` : ''}`, ...(type ? { type } : {}) });
}

/** A top-level declaration, or undefined for a node this module does not handle. */
export function describeTopLevel(node: Node, ctx: FileContext): Declared | undefined {
  if (node.type in CONTAINERS) return container(node, ctx);
  if (node.type === 'type_alias_declaration') return typeAlias(node, ctx);
  if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') return functionDeclaration(node, ctx);
  if (node.type === 'variable_declarator') return variable(node, ctx);
  return undefined;
}
