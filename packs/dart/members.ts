import type { Node } from 'web-tree-sitter';
import type { SymbolKind } from '../../src/model.js';
import { oneLine } from '../../src/tokens.js';
import { childOfType, declared, hasToken, type Declared } from '../../src/packs/symbols.js';
import { MODIFIERS, nameFields, signatureFields, withBody } from './declarations.js';

/** Members of Dart classes, mixins, extensions and enums. */

/** Flutter framework callbacks. */
const LIFECYCLE = new Set([
  'build', 'initState', 'dispose', 'didUpdateWidget', 'didChangeDependencies', 'createState', 'deactivate',
  'activate', 'reassemble', 'debugFillProperties', 'createElement', 'createRenderObject', 'updateRenderObject',
]);
const CONSTRUCTORS = new Set([
  'constructor_signature', 'constant_constructor_signature', 'factory_constructor_signature',
  'redirecting_factory_constructor_signature',
]);
const SIGNATURE_KIND: Record<string, SymbolKind> = {
  function_signature: 'method', getter_signature: 'getter', setter_signature: 'setter', operator_signature: 'method',
};

function flags(wrapper: Node, name: string) {
  return { ...(hasToken(wrapper, 'static') ? { static: true } : {}), ...(LIFECYCLE.has(name) ? { lifecycle: true } : {}) };
}

/** `Product.fromJson(...)` is the constructor `Product.fromJson`; `SettingsService._()` is private. */
function constructor(wrapper: Node, sig: Node): Declared {
  const name = sig.children.filter((c): c is Node => c?.type === 'identifier').map((c) => c.text).join('.');
  return declared(wrapper, { kind: 'constructor', signature: oneLine(wrapper.text.slice(0, sig.endIndex - wrapper.startIndex)), ...nameFields(name) }, withBody(wrapper));
}

function operator(wrapper: Node, sig: Node): Declared {
  const symbol = childOfType(sig, 'binary_operator', 'unary_operator')?.text ?? '';
  return declared(wrapper, { kind: 'method', signature: oneLine(wrapper.text), name: `operator ${symbol}`, exported: true, visibility: 'public' }, withBody(wrapper));
}

/** A method, getter, setter or operator (with a body when the wrapper is a `method_signature`). */
function callable(wrapper: Node, sig: Node, source: string): Declared {
  if (sig.type === 'operator_signature') return operator(wrapper, sig);
  const fields = signatureFields(sig, source);
  return declared(wrapper, { kind: SIGNATURE_KIND[sig.type], ...fields, signature: oneLine(wrapper.text), ...flags(wrapper, fields.name) }, withBody(wrapper));
}

/** `final String a, b = 'x';` gives the fields `a` and `b`, each with the declaration's modifiers and type. */
function fields(declaration: Node, list: Node, source: string): Declared[] {
  const prefix = oneLine(source.slice(declaration.startIndex, list.startIndex));
  const type = prefix.replace(MODIFIERS, '').replace(/^(final|const|late|var)$/, '').trim();
  return list.namedChildren
    .filter((n): n is Node => !!n && (n.type === 'initialized_identifier' || n.type === 'static_final_declaration'))
    .map((n) => {
      const name = childOfType(n, 'identifier')?.text ?? '';
      return declared(n, { kind: 'field', signature: `${prefix} ${name}`, ...(type ? { type } : {}), ...nameFields(name), ...flags(declaration, name) });
    });
}

function enumConstant(node: Node): Declared {
  const name = childOfType(node, 'identifier')?.text ?? node.text;
  return declared(node, { kind: 'enumMember', signature: oneLine(node.text), name, exported: true, visibility: 'public' });
}

/** A member declaration (a `declaration` or `method_signature` wrapper, or an enum constant). */
export function describeMember(node: Node, source: string): Declared[] {
  if (node.type === 'enum_constant') return [enumConstant(node)];
  const list = childOfType(node, 'initialized_identifier_list', 'static_final_declaration_list');
  if (list) return fields(node, list, source);
  const sig = node.namedChildren.find((c): c is Node => !!c && (CONSTRUCTORS.has(c.type) || c.type in SIGNATURE_KIND));
  if (!sig) return [];
  return [CONSTRUCTORS.has(sig.type) ? constructor(node, sig) : callable(node, sig, source)];
}
