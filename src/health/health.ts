import fs from 'node:fs';
import path from 'node:path';
import type { CodeMap, FileRecord, SymbolNode, Topology } from '../model.js';
import type { LanguagePack } from '../packs/pack.js';
import { GENERATOR_VERSION } from '../version.js';
import { findDuplicates, type SourceFile } from './duplicates.js';
import { LIMIT_NAMES, HealthLimitsError, type FunctionOverLimit, type HealthLimits, type HealthReport, type NotMeasured } from './types.js';

/**
 * The code health of a scanned folder (FR-07, CIN-18): files over the line limit, functions over the soft and hard
 * limits, duplicated blocks and import cycles, from the scan's outputs and the files themselves. Only files a code pack
 * declares are measured; data files (JSON, YAML) are left out, and files no pack reads are listed as not measured.
 */

const FUNCTION_KINDS = new Set(['function', 'method', 'constructor', 'getter', 'setter']);

/** Checks that every limit was passed as a positive whole number; no limit is ever assumed. */
export function checkLimits(input: Partial<Record<keyof HealthLimits, unknown>>): HealthLimits {
  const missing = LIMIT_NAMES.filter((name) => input[name] === undefined);
  if (missing.length) throw new HealthLimitsError(`Missing limit(s): ${missing.join(', ')}. Health needs every limit; none is assumed.`);
  const invalid = LIMIT_NAMES.filter((name) => !Number.isInteger(input[name]) || (input[name] as number) < 1);
  if (invalid.length) throw new HealthLimitsError(`Limit(s) must be positive whole numbers: ${invalid.join(', ')}.`);
  return Object.fromEntries(LIMIT_NAMES.map((name) => [name, input[name]])) as unknown as HealthLimits;
}

const lineCount = (content: string) => (content === '' ? 0 : content.replace(/\n$/, '').split('\n').length);

function functionsOf(file: FileRecord, limits: HealthLimits): FunctionOverLimit[] {
  const walk = (nodes: SymbolNode[], owner?: string): FunctionOverLimit[] => nodes.flatMap((node) => {
    const name = owner ? `${owner}.${node.name}` : node.name;
    const inner = node.members ? walk(node.members, node.name) : [];
    const lines = node.lineEnd - node.lineStart + 1;
    if (!FUNCTION_KINDS.has(node.kind) || lines <= limits.maxFunctionLines) return inner;
    const limit = lines > limits.hardFunctionLines ? 'hard' as const : 'soft' as const;
    return [{ path: file.path, name, kind: node.kind, lineStart: node.lineStart, lineEnd: node.lineEnd, lines, limit }, ...inner];
  });
  return walk(file.symbols);
}

function countFunctions(nodes: SymbolNode[]): number {
  return nodes.reduce((n, node) => n + (FUNCTION_KINDS.has(node.kind) ? 1 : 0) + countFunctions(node.members ?? []), 0);
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
  const functions = code.flatMap((f) => functionsOf(f, limits));
  const duplicates = findDuplicates(code.map((f): SourceFile => ({ path: f.path, content: f.content })), limits.minDuplicateLines);
  const cycles = topology.summary.circularDependencies.map((c) => c.cycle);
  return {
    generatorVersion: GENERATOR_VERSION, limits, files, functions, duplicates, cycles, notMeasured,
    totals: {
      files: code.length, lines: code.reduce((n, f) => n + f.lines, 0), filesOverLimit: files.length,
      functions: code.reduce((n, f) => n + countFunctions(f.symbols), 0),
      functionsOverSoft: functions.filter((f) => f.limit === 'soft').length, functionsOverHard: functions.filter((f) => f.limit === 'hard').length,
      duplicateBlocks: duplicates.length, duplicatedLines: duplicates.reduce((n, d) => n + d.lines * (d.locations.length - 1), 0),
      cycles: cycles.length, notMeasured: notMeasured.length,
    },
  };
}
