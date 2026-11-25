import path from 'node:path';
import type { CodeMap, FileRecord, Generator, ScanSummary, Topology } from '../model.js';
import type { LanguagePack } from '../packs/pack.js';
import { buildTopology } from '../graph/topology.js';
import { previousCodeMap, writeOutputs } from '../outputs.js';
import { GENERATOR_VERSION, SCHEMA_VERSION } from '../version.js';
import { walk, type WalkedFile } from '../walk/walk.js';
import { dependencyAudit } from './audit.js';
import { DEFAULT_MAX_DATA_FILE_BYTES, DEFAULT_MAX_FILE_BYTES, packFor, parsedRecord, unsupportedRecord } from './records.js';
import { resolveImports } from './resolveImports.js';

/** A scan (FR-01): walk the folder, parse what changed, resolve imports, build the graph, write the four outputs. */

export interface ScanOptions {
  /** The folder to scan. */
  root: string;
  /** The output folder; `<root>/.codeintel` when absent. */
  out?: string;
  /** Paths relative to `root` that are left out, as if they were ignored. */
  exclude?: string[];
  /** Parse every file again instead of reusing the records of unchanged ones. */
  full?: boolean;
  /** Files larger than this are listed without being parsed; 200 KB when absent. */
  maxFileBytes?: number;
  /** The same for data files (JSON, YAML), which are only shaped; 20 MB when absent. */
  maxDataFileBytes?: number;
  packs: LanguagePack[];
}

export interface ScanResult {
  map: CodeMap;
  topology: Topology;
  out: string;
}

/** Records of the previous scan that still match the file's size and modification time. */
function reusable(previous: CodeMap | undefined): Map<string, FileRecord> {
  return new Map((previous?.files ?? []).map((f) => [f.path, f]));
}

function sizeLimit(options: ScanOptions, pack: LanguagePack): number {
  return pack.data ? (options.maxDataFileBytes ?? DEFAULT_MAX_DATA_FILE_BYTES) : (options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES);
}

async function recordsOf(options: ScanOptions, files: WalkedFile[], previous: Map<string, FileRecord>) {
  const records: FileRecord[] = [];
  let parsed = 0;
  for (const file of files) {
    const old = previous.get(file.path);
    const pack = packFor(file.path, options.packs);
    if (old && old.sizeBytes === file.sizeBytes && old.mtimeMs === file.mtimeMs) records.push(old);
    else if (!pack) records.push(unsupportedRecord(file));
    else {
      records.push(await parsedRecord(options.root, file, pack, sizeLimit(options, pack)));
      parsed++;
    }
  }
  return { records, parsed };
}

function extensionOf(file: string): string {
  const ext = path.posix.extname(file);
  return ext || path.posix.basename(file);
}

function summarize(records: FileRecord[], parsed: number, durationMs: number): ScanSummary {
  const count = (key: (r: FileRecord) => string, list: FileRecord[]) => list.reduce<Record<string, number>>((acc, r) => ({ ...acc, [key(r)]: (acc[key(r)] ?? 0) + 1 }), {});
  const countSymbols = (list: FileRecord[]): number => list.reduce((sum, r) => sum + r.symbols.length + r.symbols.reduce((m, s) => m + (s.members?.length ?? 0), 0), 0);
  return {
    files: records.length, parsed, reused: records.length - parsed,
    failed: records.filter((r) => r.error).map((r) => ({ path: r.path, error: r.error! })),
    unsupported: count((r) => extensionOf(r.path), records.filter((r) => r.language === 'other')),
    languages: count((r) => r.language, records),
    symbols: countSymbols(records),
    rawTokens: records.reduce((s, r) => s + r.rawTokens, 0),
    skeletonTokens: records.reduce((s, r) => s + r.skeletonTokens, 0),
    durationMs,
  };
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const started = Date.now();
  const root = path.resolve(options.root);
  const out = path.resolve(options.out ?? path.join(root, '.codeintel'));
  const files = walk(root, options.exclude);
  const previous = options.full ? new Map() : reusable(previousCodeMap(out, GENERATOR_VERSION));
  const { records: raw, parsed } = await recordsOf({ ...options, root }, files, previous);
  const records = resolveImports(root, raw, options.packs);
  const generator: Generator = { schemaVersion: SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION, generatedAt: new Date().toISOString() };
  const codeLanguages = new Set(options.packs.filter((p) => p.resolve).map((p) => p.id));
  const map: CodeMap = { ...generator, rootName: path.basename(root), summary: summarize(records, parsed, Date.now() - started), files: records, audit: dependencyAudit(records) };
  const topology = buildTopology(records, codeLanguages, generator);
  writeOutputs(out, map, topology);
  return { map, topology, out };
}
