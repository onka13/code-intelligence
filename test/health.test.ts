import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { PACKS } from '../packs/index.js';
import { compareHealth } from '../src/health/compare.js';
import { health } from '../src/health/health.js';
import type { HealthLimits } from '../src/health/types.js';
import { scan } from '../src/scan/scan.js';
import { REPO, tempDir, writeFiles } from './helpers.js';

const CLI = path.join(REPO, 'dist', 'src', 'cli.js');
const LIMITS: HealthLimits = { maxFileLines: 300, maxFunctionLines: 25, hardFunctionLines: 40, minDuplicateLines: 6 };

/** A TypeScript class of exactly `lines` lines: 3-line filler methods, one-line fields to fill up, then `extra`. */
function classFile(name: string, lines: number, extra: string[] = []): string {
  const room = lines - extra.length - 2;
  const body: string[] = [];
  for (let i = 0; body.length + 3 <= room; i++) body.push(`  m${i}(): number {`, `    return ${i};`, '  }');
  for (let i = 0; body.length < room; i++) body.push(`  f${i} = ${i};`);
  return [`export class ${name} {`, ...body, ...extra, '}', ''].join('\n');
}

function longMethod(lines: number): string[] {
  return ['  long(): number {', '    let total = 0;', ...Array.from({ length: lines - 4 }, (_, i) => `    total += ${i} * 2;`), '    return total;', '  }'];
}

const COPIED = Array.from({ length: 12 }, (_, i) => `export const shared${i} = compute('${i}', ${i} + 1);`);

const BEFORE = {
  'src/big.ts': classFile('Big', 280),
  'src/a.ts': [...COPIED, ''].join('\n'),
  'src/b.ts': 'export const other = 1;\n',
  'README.md': '# fixture\n',
};
const AFTER = {
  ...BEFORE,
  'src/big.ts': classFile('Big', 320, longMethod(45)),
  'src/b.ts': ['export const other = 1;', ...COPIED, ''].join('\n'),
  'README.md': '# fixture\n\nchanged\n',
};

async function reportOf(files: Record<string, string>, limits = LIMITS) {
  const root = tempDir('health-');
  writeFiles(root, files);
  const { map, topology } = await scan({ root, packs: PACKS });
  return health(map, topology, root, limits, PACKS);
}

test('CIN-18 the comparison lists the crossed file limit, the long method and the new duplicated block', async () => {
  const result = compareHealth(await reportOf(BEFORE), await reportOf(AFTER));
  assert.deepEqual(result.files.map((f) => [f.path, f.lines]), [['src/big.ts', 320]]);
  const long = result.functions.find((f) => f.name === 'Big.long');
  assert.deepEqual(long && [long.path, long.lines, long.limit], ['src/big.ts', 45, 'hard']);
  assert.equal(result.duplicates.length, 1);
  assert.deepEqual(result.duplicates[0].locations.map((l) => [l.path, l.lineEnd - l.lineStart + 1]), [['src/a.ts', 12], ['src/b.ts', 12]]);
  assert.equal(result.totals.before.filesOverLimit, 0);
  assert.equal(result.totals.after.filesOverLimit, 1);
  assert.equal(result.totals.after.functionsOverHard, 1);
  assert.deepEqual(result.notMeasured.map((f) => [f.path, f.reason]), [['README.md', 'no language pack']]);
});

test('CIN-18 other limits give a result for those limits', async () => {
  const strict = { ...LIMITS, maxFileLines: 200, hardFunctionLines: 50 };
  const result = compareHealth(await reportOf(BEFORE, strict), await reportOf(AFTER, strict));
  assert.deepEqual(result.files, [], 'big.ts was already over 200 lines before the change');
  assert.equal(result.functions.find((f) => f.name === 'Big.long')?.limit, 'soft');
});

test('CIN-18 the command assumes no limit and names the missing ones', async () => {
  const root = tempDir('health-cli-');
  writeFiles(root, AFTER);
  execFileSync('node', [CLI, 'scan', root]);
  const run = spawnSync('node', [CLI, 'health', root, '--max-file-lines', '300'], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Missing limit\(s\): maxFunctionLines, hardFunctionLines, minDuplicateLines/);
  const flags = ['--max-file-lines', '300', '--max-function-lines', '25', '--hard-function-lines', '40', '--min-duplicate-lines', '6', '--json'];
  const report = JSON.parse(execFileSync('node', [CLI, 'health', root, ...flags], { encoding: 'utf8' }));
  assert.equal(report.totals.filesOverLimit, 1);
  const reportFile = path.join(root, 'after.json');
  fs.writeFileSync(reportFile, JSON.stringify(report));
  const compared = JSON.parse(execFileSync('node', [CLI, 'health-compare', reportFile, reportFile, '--json'], { encoding: 'utf8' }));
  assert.deepEqual([compared.files, compared.functions, compared.duplicates], [[], [], []]);
});
