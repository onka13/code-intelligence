import type { FileRecord, SymbolNode } from '../model.js';
import { CONTAINER_KINDS } from '../packs/symbols.js';

/**
 * What the text outputs print for a file. Only the public surface is shown: exported top-level declarations and
 * their public and protected members. Constructors are left out; the map also leaves out framework callbacks.
 */

const LIMITS = { containers: 4, methods: 15, fields: 25, topLevel: 6 };
const MODIFIER = /^(public|protected|private|readonly|static|final|const|late|var|abstract|override|covariant|external|declare|async)\s+/;
const FIELD_KINDS = new Set(['field', 'getter']);
const METHOD_KINDS = new Set(['method', 'setter']);

function visibleMembers(symbol: SymbolNode, withLifecycle: boolean): SymbolNode[] {
  return (symbol.members ?? []).filter((m) => m.visibility !== 'private' && m.kind !== 'constructor' && (withLifecycle || !m.lifecycle));
}

/** A field or getter as `name: Type` or `Type name`, without modifiers: `readonly id: string` gives `id: string`. */
function fieldLabel(member: SymbolNode): string {
  let label = member.signature;
  while (MODIFIER.test(label)) label = label.replace(MODIFIER, '');
  return label.replace(/\bget\s+/, '').replace(/\(\)\s*:/, ':');
}

function unique(items: string[], limit: number): string[] {
  return [...new Set(items)].slice(0, limit);
}

function containerSummary(symbol: SymbolNode, fields: boolean): string {
  if (symbol.kind === 'enum') return `enum ${symbol.name}`;
  const members = visibleMembers(symbol, false);
  const fieldList = fields ? unique(members.filter((m) => FIELD_KINDS.has(m.kind)).map(fieldLabel), LIMITS.fields) : [];
  const methods = unique(members.filter((m) => METHOD_KINDS.has(m.kind)).map((m) => `${m.name}()`), LIMITS.methods);
  const details = [...fieldList, ...methods].join(', ');
  return `${symbol.kind} ${symbol.name}${details ? ` { ${details} }` : ''}`;
}

/** The one-line summary of a file in the map: its containers, then its other declarations. */
export function mapSummary(record: FileRecord, fields: boolean): string | undefined {
  const exported = record.symbols.filter((s) => s.exported && !s.lifecycle);
  const containers = exported.filter((s) => CONTAINER_KINDS.has(s.kind)).slice(0, LIMITS.containers).map((s) => containerSummary(s, fields));
  const others = exported.filter((s) => !CONTAINER_KINDS.has(s.kind) && (fields || s.kind !== 'variable'));
  const topLevel = others.slice(0, LIMITS.topLevel).map((s) => (s.kind === 'function' ? `${s.name}()` : s.kind === 'type' ? `type ${s.name}` : fieldLabel(s)));
  const parts = [...containers, ...(topLevel.length ? [topLevel.join(', ')] : [])];
  return parts.length ? parts.join(' | ') : undefined;
}

function containerBlock(symbol: SymbolNode): string {
  const members = visibleMembers(symbol, true);
  if (symbol.kind === 'enum') {
    const constants = members.filter((m) => m.kind === 'enumMember').map((m) => m.name).join(', ');
    const others = members.filter((m) => m.kind !== 'enumMember').map((m) => ` ${m.signature};`).join('');
    return `${symbol.signature} { ${constants}${others ? `;${others}` : ''} }`;
  }
  return members.length ? `${symbol.signature} { ${members.map((m) => `${m.signature};`).join(' ')} }` : `${symbol.signature} {}`;
}

/** The full public declarations of a file, one line per top-level declaration (TopologyFULL.txt). */
export function fullBlock(record: FileRecord): string[] {
  return record.symbols.filter((s) => s.exported).map((s) => (CONTAINER_KINDS.has(s.kind) ? containerBlock(s) : `${s.signature};`));
}

/** The skeleton of a file: its declarations without bodies (non-private members), or its first lines when it declares nothing. */
export function skeletonOf(symbols: SymbolNode[], content: string): string {
  if (symbols.length === 0) return content.split('\n').slice(0, 30).join('\n');
  return symbols
    .map((s) => {
      if (!CONTAINER_KINDS.has(s.kind)) return `${s.signature};`;
      const members = (s.members ?? []).filter((m) => m.visibility !== 'private').map((m) => `  ${m.signature};`);
      return members.length ? `${s.signature} {\n${members.join('\n')}\n}` : `${s.signature} {}`;
    })
    .join('\n\n');
}
