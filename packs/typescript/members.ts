import type { Node } from 'web-tree-sitter';
import type { SymbolKind, Visibility } from '../../src/model.js';
import { oneLine } from '../../src/tokens.js';
import { childOfType, declared, hasToken, header, type Declared } from '../../src/packs/symbols.js';

/** Members of TypeScript and JavaScript classes, interfaces and enums. */

/** Framework callbacks: React class components and Angular lifecycle hooks. */
const LIFECYCLE = new Set([
  'render', 'componentDidMount', 'componentDidUpdate', 'componentWillUnmount', 'shouldComponentUpdate',
  'getSnapshotBeforeUpdate', 'componentDidCatch', 'getDerivedStateFromProps',
  'ngOnInit', 'ngOnChanges', 'ngDoCheck', 'ngAfterContentInit', 'ngAfterContentChecked', 'ngAfterViewInit',
  'ngAfterViewChecked', 'ngOnDestroy',
]);

function visibility(node: Node, name: string): Visibility {
  if (name.startsWith('#')) return 'private';
  const modifier = childOfType(node, 'accessibility_modifier')?.text;
  return modifier === 'private' || modifier === 'protected' ? modifier : 'public';
}

function typeOf(node: Node): string | undefined {
  const annotation = node.childForFieldName('type') ?? childOfType(node, 'type_annotation');
  return annotation ? oneLine(annotation.text).replace(/^\??:\s*/, '') : undefined;
}

function member(node: Node, kind: SymbolKind, signature: string, type?: string): Declared {
  const name = node.childForFieldName('name')?.text ?? '';
  const vis = visibility(node, name);
  return declared(node, {
    kind, name, signature, exported: vis === 'public', visibility: vis,
    ...(type ? { type } : {}),
    ...(hasToken(node, 'static') ? { static: true } : {}),
    ...(LIFECYCLE.has(name) ? { lifecycle: true } : {}),
  });
}

function methodKind(node: Node, name: string): SymbolKind {
  if (name === 'constructor') return 'constructor';
  if (hasToken(node, 'get')) return 'getter';
  return hasToken(node, 'set') ? 'setter' : 'method';
}

/** `constructor(private readonly repo: Repo)` declares the field `repo`. */
function parameterProperties(ctor: Node, source: string): Declared[] {
  const params = ctor.childForFieldName('parameters')?.namedChildren ?? [];
  return params
    .filter((p): p is Node => !!p && (childOfType(p, 'accessibility_modifier') !== undefined || hasToken(p, 'readonly')))
    .map((p) => {
      const name = p.childForFieldName('pattern')?.text ?? '';
      const vis = visibility(p, name);
      const value = p.childForFieldName('value');
      const signature = value ? oneLine(source.slice(p.startIndex, value.startIndex)).replace(/\s*=$/, '') : oneLine(p.text);
      const type = typeOf(p);
      return declared(p, { kind: 'field', name, signature, exported: vis === 'public', visibility: vis, ...(type ? { type } : {}) });
    });
}

function method(node: Node, source: string): Declared[] {
  const name = node.childForFieldName('name')?.text ?? '';
  const kind = methodKind(node, name);
  const returns = node.childForFieldName('return_type');
  const self = member(node, kind, header(source, node, node.childForFieldName('body')), returns ? oneLine(returns.text).replace(/^:\s*/, '') : undefined);
  return kind === 'constructor' ? [self, ...parameterProperties(node, source)] : [self];
}

const FUNCTION_VALUES = new Set(['arrow_function', 'function_expression']);

/** A field; one that holds an arrow function (`increment = (): void => ...`) is a method. */
function field(node: Node, source: string): Declared {
  const value = node.childForFieldName('value');
  const head = header(source, node, value);
  if (!value || !FUNCTION_VALUES.has(value.type)) return member(node, 'field', head, typeOf(node));
  const returns = value.childForFieldName('return_type');
  return member(node, 'method', `${head} = ${header(source, value, value.childForFieldName('body'))}`, returns ? oneLine(returns.text).replace(/^:\s*/, '') : undefined);
}

/** An interface member or an abstract method: its whole text is the signature. */
function signatureOnly(node: Node): Declared {
  const kind: SymbolKind = node.type === 'property_signature' ? 'field' : 'method';
  const returns = node.childForFieldName('return_type');
  const type = kind === 'field' ? typeOf(node) : returns && oneLine(returns.text).replace(/^:\s*/, '');
  return member(node, kind, oneLine(node.text).replace(/[;,]$/, ''), type || undefined);
}

function enumMember(node: Node): Declared {
  const name = node.type === 'enum_assignment' ? node.childForFieldName('name')?.text ?? '' : node.text;
  return declared(node, { kind: 'enumMember', name, signature: oneLine(node.text), exported: true, visibility: 'public' });
}

/** A member declaration, or undefined for a node this module does not handle. */
export function describeMember(node: Node, source: string): Declared[] | undefined {
  switch (node.type) {
    case 'method_definition': return method(node, source);
    case 'public_field_definition': return [field(node, source)];
    case 'abstract_method_signature':
    case 'method_signature':
    case 'property_signature': return [signatureOnly(node)];
    case 'property_identifier':
    case 'enum_assignment': return [enumMember(node)];
    default: return undefined;
  }
}
