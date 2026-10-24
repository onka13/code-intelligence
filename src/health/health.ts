import fs from 'node:fs';
import path from 'node:path';
import type { CodeMap, FileRecord, SymbolNode, Topology } from '../model.js';
import type { LanguagePack } from '../packs/pack.js';
import { FUNCTION_KINDS } from '../packs/symbols.js';
import { GENERATOR_VERSION } from '../version.js';
import { findDuplicates, type SourceFile } from './duplicates.js';
import {
  LIMIT_NAMES, HealthLimitsError, type DeepFunction, type FunctionOverLimit, type HealthLimits, type HealthReport, type NotMeasured,
} from './types.js';

/**
 * The code health of a scanned folder (FR-07, CIN-18): files over the line limit, functions over the soft and hard
 * limits and over the nesting limit, duplicated blocks and import cycles, from the scan's outputs and the files themselves. Only files a code pack
 * declares are measured; data files (JSON, YAML) are left out, and files no pack reads are listed as not measured.
 */

/** Checks that every limit was passed as a positive whole number; no limit is ever assumed. */
export function checkLimits(input: Partial<Record<keyof HealthLimits, unknown>>): HealthLimits {
  const missing = LIMIT_NAMES.filter((name) => input[name] === undefined);
  if (missing.length) throw new HealthLimitsError(`Missing limit(s): ${missing.join(', ')}. Health needs every limit; none is assumed.`);
  const invalid = LIMIT_NAMES.filter((name) => !Number.isInteger(input[name]) || (input[name] as number) < 1);
  if (invalid.length) throw new HealthLimitsError(`Limit(s) must be positive whole numbers: ${invalid.join(', ')}.`);
  return Object.fromEntries(LIMIT_NAMES.map((name) => [name, input[name]])) as unknown as HealthLimits;
}

const lineCount = (content: string) => (content === '' ? 0 : content.replace(/\n$/, '').split('\n').length);

interface FunctionSymbol {
  path: string;
  name: string;
  node: SymbolNode;
}

/** Every function-like declaration of a file, members named `Class.member`. */
function functionSymbols(file: FileRecord): FunctionSymbol[] {
  const walk = (nodes: SymbolNode[], owner?: string): FunctionSymbol[] => nodes.flatMap((node) => {
    const name = owner ? `${owner}.${node.name}` : node.name;
    const inner = node.members ? walk(node.members, node.name) : [];
    return FUNCTION_KINDS.has(node.kind) ? [{ path: file.path, name, node }, ...inner] : inner;
  });
  return walk(file.symbols);
}

function overLength({ path: p, name, node }: FunctionSymbol, limits: HealthLimits): FunctionOverLimit[] {
  const lines = node.lineEnd - node.lineStart + 1;
  if (lines <= limits.maxFunctionLines) return [];
  const limit = lines > limits.hardFunctionLines ? 'hard' as const : 'soft' as const;
  return [{ path: p, name, kind: node.kind, lineStart: node.lineStart, lineEnd: node.lineEnd, lines, limit }];
}

/** The nesting depth the scan recorded; outputs of a version before 0.4.0 have none and must be scanned again. */
function nestingOf({ path: p, name, node }: FunctionSymbol): number {
  if (node.nesting === undefined) throw new Error(`${p}: ${name} has no nesting depth; the scan outputs predate it, scan again.`);
  return node.nesting;
}

function overNesting(fn: FunctionSymbol, limits: HealthLimits): DeepFunction[] {
  const nesting = nestingOf(fn);
  if (nesting <= limits.maxNestingDepth) return [];
  return [{ path: fn.path, name: fn.name, kind: fn.node.kind, lineStart: fn.node.lineStart, lineEnd: fn.node.lineEnd, nesting }];
}

function notMeasuredReason(file: FileRecord): string | null {
  if (file.language === 'other') return 'no language pack';
  if (file.skipped) return `not parsed: ${file.skipped}`;
  if (file.error) return `parse error: ${file.error}`;
  return null;
}

interface Measured {
  code: Array<FileRecord & { lines: number; content: string }>;
  notMeasured: NotMeasured[];
}

function measure(map: CodeMap, root: string, dataLanguages: Set<string>): Measured {
  const result: Measured = { code: [], notMeasured: [] };
  for (const file of map.files) {
    if (dataLanguages.has(file.language)) continue;
    const content = fs.readFileSync(path.join(root, file.path), 'utf8');
    const reason = notMeasuredReason(file);
    if (reason) result.notMeasured.push({ path: file.path, reason, lines: lineCount(content) });
    else result.code.push({ ...file, lines: lineCount(content), content });
  }
  return result;
}

/** The health report of `root`, whose scan outputs are `map` and `topology`. */
export function health(map: CodeMap, topology: Topology, root: string, limits: HealthLimits, packs: LanguagePack[]): HealthReport {
  checkLimits(limits);
  const { code, notMeasured } = measure(map, root, new Set(packs.filter((p) => p.data).map((p) => p.id)));
  const files = code.filter((f) => f.lines > limits.maxFileLines).map(({ path: p, language, lines }) => ({ path: p, language, lines }));
  const symbols = code.flatMap(functionSymbols);
  const functions = symbols.flatMap((f) => overLength(f, limits));
  const nesting = symbols.flatMap((f) => overNesting(f, limits));
  const duplicates = findDuplicates(code.map((f): SourceFile => ({ path: f.path, content: f.content })), limits.minDuplicateLines);
  const cycles = topology.summary.circularDependencies.map((c) => c.cycle);
  return {
    generatorVersion: GENERATOR_VERSION, limits, files, functions, nesting, duplicates, cycles, notMeasured,
    totals: {
      files: code.length, lines: code.reduce((n, f) => n + f.lines, 0), filesOverLimit: files.length, functions: symbols.length,
      functionsOverSoft: functions.filter((f) => f.limit === 'soft').length, functionsOverHard: functions.filter((f) => f.limit === 'hard').length,
      functionsOverNesting: nesting.length, deepestNesting: symbols.reduce((n, f) => Math.max(n, nestingOf(f)), 0),
      duplicateBlocks: duplicates.length, duplicatedLines: duplicates.reduce((n, d) => n + d.lines * (d.locations.length - 1), 0),
      cycles: cycles.length, notMeasured: notMeasured.length,
    },
  };
}
