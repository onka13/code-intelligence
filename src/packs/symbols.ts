import type { Node } from 'web-tree-sitter';
import type { SymbolKind, SymbolNode } from '../model.js';
import { oneLine } from '../tokens.js';

/** Shared helpers for Tree-sitter packs: declaration text, and nesting members into their containers. */

export const CONTAINER_KINDS = new Set<SymbolKind>(['class', 'interface', 'enum', 'mixin', 'extension']);
const MEMBER_KINDS = new Set<SymbolKind>(['method', 'constructor', 'field', 'getter', 'setter', 'enumMember']);

/** A declaration with its source range, before nesting. */
export interface Declared extends Omit<SymbolNode, 'members'> {
  start: number;
  end: number;
}

export type SymbolFields = Omit<SymbolNode, 'lineStart' | 'lineEnd' | 'members'>;

/** A declaration spanning `node` (to `last` when the body is a separate sibling, as in Dart). */
export function declared(node: Node, fields: SymbolFields, last: Node = node): Declared {
  return { ...fields, lineStart: node.startPosition.row + 1, lineEnd: last.endPosition.row + 1, start: node.startIndex, end: last.endIndex };
}

/**
 * Nests declarations by their source ranges: a declaration inside a container becomes its member, one inside a
 * function or method is local and left out, any other is top level. Syntax ranges nest exactly, so membership is
 * never guessed from line numbers. A member outside any captured container (a class inside a namespace) is left out.
 * A field declared by a constructor (TypeScript parameter properties) belongs to the constructor's class.
 */
export function nest(items: Declared[]): SymbolNode[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const top: SymbolNode[] = [];
  const open: Array<{ item: Declared; node: SymbolNode }> = [];
  for (const item of sorted) {
    while (open.length && open[open.length - 1].item.end <= item.start) open.pop();
    const declaredByConstructor = item.kind === 'field' && open[open.length - 1]?.item.kind === 'constructor';
    const parent = declaredByConstructor ? open[open.length - 2] : open[open.length - 1];
    const node = toNode(item);
    if (!parent && MEMBER_KINDS.has(item.kind)) continue;
    if (!parent) top.push(node);
    else if (CONTAINER_KINDS.has(parent.item.kind)) (parent.node.members ??= []).push(node);
    else continue;
    open.push({ item, node });
  }
  return top;
}

function toNode(item: Declared): SymbolNode {
  const { start, end, ...symbol } = item;
  return CONTAINER_KINDS.has(item.kind) ? { ...symbol, members: [] } : symbol;
}

const LEADING = new Set(['decorator', 'annotation', 'comment']);

/**
 * The text of `node` from its first real token (decorators and comments skipped) up to `stop`, on one line,
 * without a trailing `{`, `;`, `=>` or `=`.
 */
export function header(source: string, node: Node, stop?: Node | null): string {
  const first = node.children.find((c) => c && !LEADING.has(c.type)) ?? node;
  const end = stop ? stop.startIndex : node.endIndex;
  return oneLine(source.slice(first.startIndex, end)).replace(/\s*(\{|;|=>|=)$/, '');
}

/** Splits a list on commas that are not inside brackets: `A<B, C>, D` gives `A<B, C>` and `D`. */
export function splitList(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if ('<([{'.includes(ch)) depth++;
    if ('>)]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** The first child of one of the given types. */
export function childOfType(node: Node, ...types: string[]): Node | undefined {
  return node.children.find((c): c is Node => !!c && types.includes(c.type));
}

/** Whether a keyword token (such as `static`) is a direct child. */
export function hasToken(node: Node, token: string): boolean {
  return node.children.some((c) => c?.type === token);
}
