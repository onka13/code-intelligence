#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PACKS } from '../packs/index.js';
import { rankHubs } from './graph/topology.js';
import { compareHealth } from './health/compare.js';
import { checkLimits, health } from './health/health.js';
import { HealthLimitsError, type HealthReport } from './health/types.js';
import { readCodeMap, readTopology } from './outputs.js';
import { renderMap } from './queries/map.js';
import { neighborhood } from './queries/neighborhood.js';
import { scan } from './scan/scan.js';
import { briefsText, neighborhoodList, neighborhoodText } from './text/briefs.js';
import type { ScanSummary } from './model.js';

const USAGE = `Usage: codeintel <command> [options]

  scan <folder> [--out <dir>] [--exclude <path>]... [--full] [--json]
        Scan a folder and write ast_code_map.json, topology.json, TopologyFULL.txt and
        project_structure.md to --out (default <folder>/.codeintel). Unchanged files are not parsed
        again unless --full is given.
  map [<subfolder or file>] [--out <dir>] [--fields] [--full] [--depth <n>] [--folders]
        Print the repo map of the scanned folder, a subfolder, or one file's declarations.
  neighborhood <file>... [--budget <tokens>] [--contents [--root <folder>]] [--list] [--out <dir>] [--json]
        The files around the given ones with their briefs (declarations without bodies, data shapes).
        Without --budget: every file they import and every file importing them. With --budget: also
        the next ring, most central first, while they fit. --contents prints whole files instead,
        read from --root (default: the folder that holds --out). --list prints only the paths.
  brief <file>... [--out <dir>]
        The briefs of the given files.
  hubs [--top <n>] [--out <dir>] [--json]
        The most connected files.
  health <folder> --max-file-lines <n> --max-function-lines <n> --hard-function-lines <n>
         --max-nesting-depth <n> --min-duplicate-lines <n> [--out <dir>] [--json]
        Files and functions over the limits (length and nesting depth), duplicated blocks and import cycles of the scanned folder
        (--out defaults to <folder>/.codeintel). Every limit is required; none is assumed.
  health-compare <before.json> <after.json> [--json]
        What changed between two health reports made with the same limits: limits crossed, new
        duplicates, new cycles, and the totals before and after.

Queries read the outputs in --out (default ./.codeintel) and never parse again.
`;

const LIMIT_FLAGS = {
  maxFileLines: 'max-file-lines', maxFunctionLines: 'max-function-lines', hardFunctionLines: 'hard-function-lines',
  maxNestingDepth: 'max-nesting-depth', minDuplicateLines: 'min-duplicate-lines',
} as const;
const VALUE_FLAGS = new Set(['out', 'exclude', 'depth', 'budget', 'top', 'root', ...Object.values(LIMIT_FLAGS)]);

interface Args {
  positional: string[];
  values: Map<string, string[]>;
  flags: Set<string>;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { positional: [], values: new Map(), flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].startsWith('--') ? argv[i].slice(2) : undefined;
    if (!name) args.positional.push(argv[i]);
    else if (VALUE_FLAGS.has(name)) args.values.set(name, [...(args.values.get(name) ?? []), argv[++i]]);
    else args.flags.add(name);
  }
  return args;
}

const value = (args: Args, name: string) => args.values.get(name)?.[0];
const numberValue = (args: Args, name: string) => (value(args, name) === undefined ? undefined : Number(value(args, name)));
const outDir = (args: Args) => path.resolve(value(args, 'out') ?? '.codeintel');

function printSummary(s: ScanSummary): void {
  console.log(`Scanned ${s.files} files (${s.parsed} parsed, ${s.reused} unchanged) in ${s.durationMs} ms; ${s.symbols} declarations.`);
  for (const f of s.failed) console.log(`  failed  ${f.path}: ${f.error}`);
  const unsupported = Object.entries(s.unsupported).map(([ext, n]) => `${ext} (${n})`);
  if (unsupported.length) console.log(`  unsupported (listed without declarations): ${unsupported.join(', ')}`);
}

async function runScan(args: Args): Promise<number> {
  const folder = args.positional[1];
  if (!folder) { console.error('scan needs a folder.'); return 2; }
  const out = value(args, 'out');
  const result = await scan({ root: folder, out: out && path.resolve(out), exclude: args.values.get('exclude'), full: args.flags.has('full'), packs: PACKS });
  if (args.flags.has('json')) console.log(JSON.stringify({ out: result.out, generatorVersion: result.map.generatorVersion, schemaVersion: result.map.schemaVersion, summary: result.map.summary }, null, 2));
  else printSummary(result.map.summary);
  return 0;
}

function runNeighborhood(args: Args): number {
  const budget = numberValue(args, 'budget');
  const files = args.positional.slice(1);
  if (!files.length || Number.isNaN(budget)) { console.error('neighborhood needs files, and --budget <tokens> must be a number.'); return 2; }
  const contents = args.flags.has('contents');
  const result = neighborhood(readCodeMap(outDir(args)), readTopology(outDir(args)), files, { budget, contents });
  if (args.flags.has('json')) console.log(JSON.stringify(result, null, 2));
  else if (args.flags.has('list')) console.log(neighborhoodList(result));
  else console.log(neighborhoodText(result, contents ? { root: path.resolve(value(args, 'root') ?? path.dirname(outDir(args))) } : undefined));
  return 0;
}

function runBrief(args: Args): number {
  const files = args.positional.slice(1);
  if (!files.length) { console.error('brief needs files.'); return 2; }
  console.log(briefsText(readCodeMap(outDir(args)), files));
  return 0;
}

function runHubs(args: Args): number {
  const hubs = rankHubs(readTopology(outDir(args)).nodes, numberValue(args, 'top') ?? 10);
  if (args.flags.has('json')) console.log(JSON.stringify(hubs, null, 2));
  else hubs.forEach((h, i) => console.log(`#${i + 1}  ${h.path}  score ${h.centralityScore}  in ${h.inDegree}  out ${h.outDegree}  pagerank ${h.pageRank}`));
  return 0;
}

function runHealth(args: Args): number {
  const folder = args.positional[1];
  if (!folder) { console.error('health needs a folder.'); return 2; }
  const limits = checkLimits(Object.fromEntries(Object.entries(LIMIT_FLAGS).map(([name, flag]) => [name, numberValue(args, flag)])));
  const out = path.resolve(value(args, 'out') ?? path.join(folder, '.codeintel'));
  const report = health(readCodeMap(out), readTopology(out), path.resolve(folder), limits, PACKS);
  if (args.flags.has('json')) { console.log(JSON.stringify(report, null, 2)); return 0; }
  const t = report.totals;
  console.log(`${t.files} files, ${t.lines} lines; ${t.filesOverLimit} files over ${limits.maxFileLines} lines; ${t.functionsOverSoft} functions over ${limits.maxFunctionLines} and ${t.functionsOverHard} over ${limits.hardFunctionLines} lines; ${t.functionsOverNesting} functions nested deeper than ${limits.maxNestingDepth}; ${t.duplicateBlocks} duplicated blocks; ${t.cycles} import cycles; ${t.notMeasured} files not measured.`);
  return 0;
}

function runHealthCompare(args: Args): number {
  const [before, after] = args.positional.slice(1);
  if (!before || !after) { console.error('health-compare needs two health reports.'); return 2; }
  const readReport = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as HealthReport;
  const result = compareHealth(readReport(before), readReport(after));
  if (args.flags.has('json')) { console.log(JSON.stringify(result, null, 2)); return 0; }
  console.log(`${result.files.length} files and ${result.functions.length} functions crossed a length limit; ${result.nesting.length} functions crossed the nesting limit; ${result.duplicates.length} new duplicated blocks; ${result.cycles.length} new import cycles; ${result.notMeasured.length} changed files not measured.`);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  switch (args.positional[0]) {
    case 'scan': return runScan(args);
    case 'map':
      console.log(renderMap(readCodeMap(outDir(args)), { folder: args.positional[1], fields: args.flags.has('fields'), full: args.flags.has('full'), depth: numberValue(args, 'depth'), foldersOnly: args.flags.has('folders') }));
      return 0;
    case 'neighborhood': return runNeighborhood(args);
    case 'brief': return runBrief(args);
    case 'hubs': return runHubs(args);
    case 'health': return runHealth(args);
    case 'health-compare': return runHealthCompare(args);
    default:
      console.log(USAGE);
      return args.positional[0] ? 2 : 0;
  }
}

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (err: Error) => { console.error(`codeintel: ${err.message}`); process.exitCode = err instanceof HealthLimitsError ? 2 : 1; },
);
