import type { Node } from 'web-tree-sitter';
import type { SymbolKind } from '../../src/model.js';
import { oneLine } from '../../src/tokens.js';
import { childOfType, declared, header, splitList, type Declared, type SymbolFields } from '../../src/packs/symbols.js';

/** Top-level Dart declarations. A leading underscore makes a name private to its library. */

const MAX_TYPE_ALIAS = 200;
const CONTAINERS: Record<string, SymbolKind> = {
  class_definition: 'class', mixin_declaration: 'mixin', extension_declaration: 'extension', enum_declaration: 'enum',
};
/** Tokens that may precede a top-level variable's names: modifiers and the type. */
const VARIABLE_PREFIX = new Set([
  'final_builtin', 'const_builtin', 'late', 'var', 'external', 'type_identifier', 'type_arguments', 'nullable_type',
  'function_type', 'void_type', 'record_type', 'inferred_type', '?',
]);
export const MODIFIERS = /\b(static|final|const|late|var|covariant|external)\s+/g;

/** A leading underscore makes a name private; an unnamed extension is private to its library as well. */
export function nameFields(name: string): Pick<SymbolFields, 'name' | 'exported' | 'visibility'> {
  const isPrivate = name === '' || name.split('.').pop()!.startsWith('_');
  return { name, exported: !isPrivate, visibility: isPrivate ? 'private' : 'public' };
}

/** The node a declaration's range ends with: its body when the body is the next sibling. */
export function withBody(node: Node): Node {
  const next = node.nextSibling;
  return next?.type === 'function_body' ? next : node;
}

/** The text after a keyword token inside `node`, split as a list (`with A, B` gives A and B). */
function listAfter(node: Node | undefined, keyword: string, stop?: Node): string[] | undefined {
  if (!node) return undefined;
  const text = oneLine(stop ? node.text.slice(0, stop.startIndex - node.startIndex) : node.text).replace(new RegExp(`^${keyword}\\s+`), '');
  return text ? splitList(text) : undefined;
}

function heritage(node: Node) {
  const superclass = childOfType(node, 'superclass');
  const mixins = childOfType(superclass ?? node, 'mixins');
  const ext = superclass && superclass.children[0]?.type === 'extends' ? listAfter(superclass, 'extends', mixins) : undefined;
  const fields = { extends: ext, mixins: listAfter(mixins, 'with'), implements: listAfter(childOfType(node, 'interfaces'), 'implements') };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v?.length)) as Partial<SymbolFields>;
}

function container(node: Node, source: string): Declared {
  const name = (node.childForFieldName('name') ?? childOfType(node, 'identifier'))?.text ?? '';
  const body = node.childForFieldName('body') ?? childOfType(node, 'class_body', 'extension_body', 'enum_body');
  return declared(node, { kind: CONTAINERS[node.type], signature: header(source, node, body), ...nameFields(name), ...heritage(node) });
}

function typeAlias(node: Node): Declared {
  const text = oneLine(node.text).replace(/;$/, '');
  const name = childOfType(node, 'type_identifier')?.text ?? '';
  return declared(node, { kind: 'type', signature: text.length > MAX_TYPE_ALIAS ? `${text.slice(0, MAX_TYPE_ALIAS)}…` : text, ...nameFields(name) });
}

/** A function, getter or setter signature: its text is the signature, the text before the name its return type. */
export function signatureFields(sig: Node, source: string): Pick<SymbolFields, 'name' | 'signature' | 'type' | 'exported' | 'visibility'> {
  const nameNode = sig.childForFieldName('name') ?? childOfType(sig, 'identifier');
  const before = nameNode ? oneLine(source.slice(sig.startIndex, nameNode.startIndex)).replace(/\b(get|set|static|external)\b/g, '').trim() : '';
  return { signature: oneLine(sig.text), ...(before ? { type: before } : {}), ...nameFields(nameNode?.text ?? '') };
}

function topLevelFunction(node: Node, source: string): Declared {
  return declared(node, { kind: 'function', ...signatureFields(node, source) }, withBody(node));
}

/** `final int a = 1, b = 2;` at top level: the modifiers and type are the siblings before the name list. */
function topLevelVariable(node: Node, source: string): Declared {
  const list = node.parent!;
  let first: Node = list;
  while (first.previousSibling && VARIABLE_PREFIX.has(first.previousSibling.type)) first = first.previousSibling;
  const prefix = first === list ? '' : oneLine(source.slice(first.startIndex, list.startIndex));
  const name = childOfType(node, 'identifier')?.text ?? '';
  const type = prefix.replace(MODIFIERS, '').replace(/^(final|const|late|var)$/, '').trim();
  return declared(node, { kind: 'variable', signature: prefix ? `${prefix} ${name}` : name, ...(type ? { type } : {}), ...nameFields(name) });
}

/** A top-level declaration, or undefined for a node this module does not handle. */
export function describeTopLevel(node: Node, source: string): Declared | undefined {
  if (node.type in CONTAINERS) return container(node, source);
  if (node.type === 'type_alias') return typeAlias(node);
  if (['function_signature', 'getter_signature', 'setter_signature'].includes(node.type)) return topLevelFunction(node, source);
  if (node.type === 'static_final_declaration' || node.type === 'initialized_identifier') return topLevelVariable(node, source);
  return undefined;
}
