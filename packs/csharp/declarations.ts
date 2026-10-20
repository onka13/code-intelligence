import type { Node } from 'web-tree-sitter';
import type { SymbolKind, Visibility } from '../../src/model.js';
import { oneLine } from '../../src/tokens.js';
import { childOfType, declared, hasToken, type Declared, type SymbolFields } from '../../src/packs/symbols.js';

/** C# declarations: types (top level or nested in a type) and their members, with modifiers and types. */

const TYPE_KINDS: Record<string, SymbolKind> = {
  class_declaration: 'class', struct_declaration: 'class', record_declaration: 'class',
  interface_declaration: 'interface', enum_declaration: 'enum',
};
const CALLABLE_KINDS: Record<string, SymbolKind> = {
  method_declaration: 'method', operator_declaration: 'method', conversion_operator_declaration: 'method',
  destructor_declaration: 'method', indexer_declaration: 'method', constructor_declaration: 'constructor',
};
/** Where a callable's signature ends. */
const CALLABLE_BODIES = new Set(['block', 'arrow_expression_clause', 'accessor_list']);
const LEADING = new Set(['attribute_list', 'comment']);
/** Members of an interface or enum are public without a modifier; those of a class, struct or record are private. */
const PUBLIC_BY_DEFAULT = new Set(['interface_declaration', 'enum_declaration']);
/** `IOrderService` in a base list names an interface, by the .NET naming convention. */
const INTERFACE_NAME = /^I[A-Z]/;

const modifiers = (node: Node) => node.children.filter((c): c is Node => c?.type === 'modifier').map((c) => c.text);

/** The text from the first real token (attributes and comments skipped) to `stop`, on one line, without a trailing `{`, `;`, `=>` or `=`. */
function header(source: string, node: Node, stop?: Node | null): string {
  const first = node.children.find((c): c is Node => !!c && !LEADING.has(c.type)) ?? node;
  return oneLine(source.slice(first.startIndex, stop ? stop.startIndex : node.endIndex)).replace(/\s*(\{|;|=>|=)$/, '');
}

/** protected (any combination) and private as written; public and internal are visible to other files of the project. */
function visibilityOf(mods: string[], fallback: Visibility): Visibility {
  if (mods.includes('protected')) return 'protected';
  if (mods.includes('private')) return 'private';
  if (mods.includes('public') || mods.includes('internal')) return 'public';
  return fallback;
}

/** The type a member declaration sits in, or undefined for a top-level type. */
function ownerOf(node: Node): Node | undefined {
  const owner = node.parent?.parent;
  return owner && (owner.type in TYPE_KINDS) ? owner : undefined;
}

function access(node: Node): Pick<SymbolFields, 'exported' | 'visibility'> & { static?: true } {
  const mods = modifiers(node);
  const owner = ownerOf(node);
  const visibility = visibilityOf(mods, !owner || PUBLIC_BY_DEFAULT.has(owner.type) ? 'public' : 'private');
  return { visibility, exported: visibility !== 'private', ...(mods.includes('static') ? { static: true as const } : {}) };
}

/** The last part of a base type's name, without type arguments or a namespace. */
const simpleName = (ref: string) => ref.replace(/[<(].*$/s, '').split('.').pop()!.trim();

/** A base list splits into extends and implements: interfaces extend interfaces, structs only implement. */
function heritage(node: Node): Partial<SymbolFields> {
  const list = childOfType(node, 'base_list');
  if (!list) return {};
  const bases = list.namedChildren.filter((c): c is Node => !!c).map((c) => oneLine(c.type === 'primary_constructor_base_type' ? c.text.replace(/\(.*$/s, '') : c.text));
  const isStruct = node.type === 'struct_declaration' || hasToken(node, 'struct');
  const isInterface = (ref: string) => isStruct || INTERFACE_NAME.test(simpleName(ref));
  if (node.type === 'interface_declaration') return { extends: bases };
  const ext = bases.filter((b) => !isInterface(b));
  const impl = bases.filter(isInterface);
  return { ...(ext.length ? { extends: ext } : {}), ...(impl.length ? { implements: impl } : {}) };
}

function typeDeclaration(node: Node, source: string): Declared {
  const body = node.childForFieldName('body');
  const name = node.childForFieldName('name')?.text ?? '';
  return declared(node, { kind: TYPE_KINDS[node.type], name, signature: header(source, node, body?.type === ';' ? null : body), ...access(node), ...heritage(node) });
}

function delegate(node: Node, source: string): Declared {
  const type = (node.childForFieldName('returns') ?? node.childForFieldName('type'))?.text;
  return declared(node, { kind: 'type', name: node.childForFieldName('name')?.text ?? '', signature: header(source, node), ...(type ? { type } : {}), ...access(node) });
}

function callableName(node: Node): string {
  const name = node.childForFieldName('name')?.text ?? '';
  if (node.type === 'destructor_declaration') return `~${name}`;
  if (node.type === 'indexer_declaration') return 'this[]';
  if (node.type === 'operator_declaration') return `operator ${node.childForFieldName('operator')?.text ?? ''}`;
  if (node.type === 'conversion_operator_declaration') return `operator ${node.childForFieldName('type')?.text ?? ''}`;
  return name;
}

function callable(node: Node, source: string): Declared {
  const body = node.children.find((c): c is Node => !!c && CALLABLE_BODIES.has(c.type));
  const type = node.type === 'constructor_declaration' || node.type === 'destructor_declaration' ? undefined : (node.childForFieldName('returns') ?? node.childForFieldName('type'))?.text;
  return declared(node, { kind: CALLABLE_KINDS[node.type], name: callableName(node), signature: header(source, node, body), ...(type ? { type } : {}), ...access(node) });
}

/** `{ get; private set; }` from the accessors, without their bodies; an expression-bodied property is `{ get; }`. */
function accessors(node: Node): string {
  const list = node.childForFieldName('accessors');
  if (!list) return '{ get; }';
  const each = list.namedChildren.filter((c): c is Node => c?.type === 'accessor_declaration')
    .map((a) => [...modifiers(a), a.childForFieldName('name')?.text ?? ''].join(' '));
  return `{ ${each.map((a) => `${a};`).join(' ')} }`;
}

/** A property is a field of the map with its accessors in the signature. */
function property(node: Node, source: string): Declared {
  const type = node.childForFieldName('type')?.text;
  const name = node.childForFieldName('name')?.text ?? '';
  const signature = `${header(source, node, node.childForFieldName('name'))} ${name} ${accessors(node)}`;
  return declared(node, { kind: 'field', name, signature, ...(type ? { type } : {}), ...access(node) });
}

/** `private readonly int a = 1, b;` gives the fields `a` and `b`, each with the declaration's modifiers and type. */
function fields(node: Node, source: string): Declared[] {
  const variables = childOfType(node, 'variable_declaration');
  if (!variables) return [];
  const type = variables.childForFieldName('type');
  const prefix = header(source, node, type ? type.nextSibling : variables).replace(/\s*\{$/, '');
  return variables.namedChildren.filter((c): c is Node => c?.type === 'variable_declarator').map((v) => {
    const name = v.childForFieldName('name')?.text ?? childOfType(v, 'identifier')?.text ?? '';
    return declared(v, { kind: 'field', name, signature: `${prefix} ${name}`, ...(type ? { type: type.text } : {}), ...access(node) });
  });
}

function enumMember(node: Node): Declared {
  return declared(node, { kind: 'enumMember', name: node.childForFieldName('name')?.text ?? '', signature: oneLine(node.text), exported: true, visibility: 'public' });
}

/** A positional record parameter is a public property of the record. */
function recordParameter(node: Node): Declared {
  const type = node.childForFieldName('type')?.text;
  const name = node.childForFieldName('name')?.text ?? '';
  return declared(node, { kind: 'field', name, signature: oneLine(node.text), ...(type ? { type } : {}), exported: true, visibility: 'public' });
}

/** The declarations one captured node gives (a field declaration gives one per variable). */
export function describe(node: Node, source: string): Declared[] {
  if (node.type in TYPE_KINDS) return [typeDeclaration(node, source)];
  if (node.type === 'delegate_declaration') return [delegate(node, source)];
  if (node.type in CALLABLE_KINDS) return [callable(node, source)];
  if (node.type === 'property_declaration' || node.type === 'event_declaration') return [property(node, source)];
  if (node.type === 'field_declaration' || node.type === 'event_field_declaration') return fields(node, source);
  if (node.type === 'enum_member_declaration') return [enumMember(node)];
  if (node.type === 'parameter') return [recordParameter(node)];
  return [];
}
