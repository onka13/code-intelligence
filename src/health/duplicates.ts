import crypto from 'node:crypto';
import type { DuplicateBlock } from './types.js';

/**
 * Duplicated blocks: the same normalized run of significant lines in two places. Blank lines and lines of brackets or
 * separators only are not significant; whitespace inside a line is collapsed. Each window of `minLines` significant
 * lines is hashed; consecutive duplicated windows of one file form a block, and blocks sharing a window are copies.
 */

export interface SourceFile {
  path: string;
  content: string;
}

interface Line {
  text: string;
  number: number;
}

interface Block {
  path: string;
  lineStart: number;
  lineEnd: number;
  keys: string[];
}

const TRIVIAL = /^[\s{}()[\];,]*$/;

function significantLines(content: string): Line[] {
  return content.split('\n').flatMap((raw, i) => {
    const text = raw.trim().replace(/\s+/g, ' ');
    return TRIVIAL.test(text) ? [] : [{ text, number: i + 1 }];
  });
}

const hashOf = (lines: Line[]) => crypto.createHash('sha1').update(lines.map((l) => l.text).join('\n')).digest('hex').slice(0, 12);

function windowsOf(file: SourceFile, minLines: number): string[] {
  const lines = significantLines(file.content);
  return Array.from({ length: Math.max(0, lines.length - minLines + 1) }, (_, i) => hashOf(lines.slice(i, i + minLines)));
}

/** Where each window hash starts; a hash is duplicated when it starts in two files or twice without overlapping. */
function duplicatedHashes(windows: Map<string, string[]>, minLines: number): Set<string> {
  const starts = new Map<string, Array<{ path: string; index: number }>>();
  for (const [path, hashes] of windows) hashes.forEach((h, index) => starts.set(h, [...(starts.get(h) ?? []), { path, index }]));
  const duplicated = new Set<string>();
  for (const [hash, at] of starts) {
    const apart = at.some((a, i) => at.slice(i + 1).some((b) => b.path !== a.path || Math.abs(b.index - a.index) >= minLines));
    if (apart) duplicated.add(hash);
  }
  return duplicated;
}

/** Runs of consecutive duplicated windows in one file, as blocks with their line range. */
function blocksOf(file: SourceFile, hashes: string[], duplicated: Set<string>, minLines: number): Block[] {
  const lines = significantLines(file.content);
  const blocks: Block[] = [];
  let open: { first: number; keys: string[] } | null = null;
  const close = (last: number) => {
    if (open) blocks.push({ path: file.path, lineStart: lines[open.first].number, lineEnd: lines[last + minLines - 1].number, keys: open.keys });
    open = null;
  };
  hashes.forEach((h, i) => {
    if (!duplicated.has(h)) return close(i - 1);
    open = open ?? { first: i, keys: [] };
    open.keys.push(h);
  });
  close(hashes.length - 1);
  return blocks;
}

/** Blocks that share a window are copies of each other (union of the blocks by shared keys). */
function groupCopies(blocks: Block[]): DuplicateBlock[] {
  const groups: Block[][] = [];
  for (const block of blocks) {
    const keys = new Set(block.keys);
    const joined = groups.filter((g) => g.some((b) => b.keys.some((k) => keys.has(k))));
    const merged = [...joined.flat(), block];
    groups.splice(0, groups.length, ...groups.filter((g) => !joined.includes(g)), merged);
  }
  return groups.filter((g) => g.length > 1).map((g) => ({
    keys: [...new Set(g.flatMap((b) => b.keys))].sort(),
    lines: Math.max(...g.map((b) => b.lineEnd - b.lineStart + 1)),
    locations: g.map(({ path, lineStart, lineEnd }) => ({ path, lineStart, lineEnd })).sort((a, b) => a.path.localeCompare(b.path) || a.lineStart - b.lineStart),
  }));
}

export function findDuplicates(files: SourceFile[], minLines: number): DuplicateBlock[] {
  const windows = new Map(files.map((f) => [f.path, windowsOf(f, minLines)] as const));
  const duplicated = duplicatedHashes(windows, minLines);
  const blocks = files.flatMap((f) => blocksOf(f, windows.get(f.path)!, duplicated, minLines));
  return groupCopies(blocks).sort((a, b) => a.locations[0].path.localeCompare(b.locations[0].path) || a.locations[0].lineStart - b.locations[0].lineStart);
}
