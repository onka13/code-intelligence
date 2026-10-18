import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { PACKS } from '../packs/index.js';
import { readCodeMap, readTopology } from '../src/outputs.js';
import { neighborhood } from '../src/queries/neighborhood.js';
import { scan } from '../src/scan/scan.js';
import { REPO, tempDir, writeFiles } from './helpers.js';

const CLI = path.join(REPO, 'dist', 'src', 'cli.js');

/** A project scanned once; the source folder is removed afterwards, so a query that parsed again would fail. */
async function scannedProject(files: Record<string, string>): Promise<string> {
  const root = tempDir();
  writeFiles(root, files);
  const out = path.join(tempDir(), 'out');
  await scan({ root, out, packs: PACKS });
  fs.rmSync(root, { recursive: true, force: true });
  return out;
}

test('CIN-07: the map of a subfolder, with fields and a depth limit, from the stored outputs', async () => {
  const out = await scannedProject({
    'src/orders/order.ts': 'export class Order {\n  id: string = "";\n  private secret = 1;\n  total(): number { return 0; }\n}\n',
    'src/orders/deep/a/b/c/d/far.ts': 'export function far() {}\n',
    'src/other.ts': 'export const other = 1;\n',
  });
  const printed = execFileSync('node', [CLI, 'map', 'src/orders', '--out', out, '--fields', '--depth', '2'], { encoding: 'utf8' });
  assert.equal(printed, [
    '📁 orders/',
    '├── 📁 deep/',
    '│   └── 📁 a/',
    '│       └── 📁 b/',
    '└── 📄 order.ts  // class Order { id: string, total() }',
    '',
  ].join('\n'));
  const full = execFileSync('node', [CLI, 'map', '--out', out, '--full'], { encoding: 'utf8' });
  assert.ok(full.includes('class Order { id: string; total(): number; }') && full.includes('function far();'));
});

test('CIN-08: a neighborhood within a token budget, with reasons, the same every time', async () => {
  const files: Record<string, string> = {
    'src/orders/orderService.ts': "import { Repo } from './repo';\nimport { Order } from './types';\nexport class OrderService { constructor(private repo: Repo) {} find(id: string): Order | undefined { return undefined; } }\n",
    'src/orders/repo.ts': "import { Db } from '../db/db';\nexport class Repo { db = new Db(); get(id: string) { return id; } }\n",
    'src/orders/types.ts': 'export interface Order { id: string; total: number; lines: string[] }\n',
    'src/db/db.ts': 'export class Db { query(sql: string): unknown[] { return []; } }\n',
    'src/api/controller.ts': "import { OrderService } from '../orders/orderService';\nexport class Controller { constructor(private s: OrderService) {} handle(): void {} }\n",
    'src/unrelated.ts': 'export class Unrelated { a(): void {} }\n',
  };
  const out = await scannedProject(files);
  const map = readCodeMap(out);
  const topology = readTopology(out);
  const wide = neighborhood(map, topology, ['src/orders/orderService.ts'], 8000);
  assert.deepEqual(wide.targets.map((t) => [t.path, t.tier]), [['src/orders/orderService.ts', 3]]);
  assert.deepEqual(wide.selected.map((s) => [s.path, s.tier, s.reason]), [
    ['src/orders/repo.ts', 2, 'imported by src/orders/orderService.ts'],
    ['src/orders/types.ts', 2, 'imported by src/orders/orderService.ts'],
    ['src/api/controller.ts', 2, 'imports src/orders/orderService.ts'],
    ['src/db/db.ts', 1, 'imported by src/orders/repo.ts'],
  ]);
  assert.equal(wide.omitted.files, 0);

  const tokens = (p: string) => map.files.find((f) => f.path === p)!.skeletonTokens;
  const budget = tokens('src/orders/repo.ts') + tokens('src/orders/types.ts');
  const tight = neighborhood(map, topology, ['src/orders/orderService.ts'], budget);
  assert.ok(tight.selectedTokens <= budget);
  assert.equal(tight.omitted.files, 4 - tight.selected.length);
  assert.deepEqual(neighborhood(map, topology, ['src/orders/orderService.ts'], budget), tight);
  assert.throws(() => neighborhood(map, topology, ['src/missing.ts'], 100), /Not in the code map: src\/missing\.ts/);
});

test('CIN-09: the dependency audit finds dormant packages and counts every use', async () => {
  const out = await scannedProject({
    'package.json': JSON.stringify({ dependencies: { lodash: '4.17.21', express: '4.21.2', zod: '3.24.1' }, devDependencies: { typescript: '5.8.3', '@types/node': '22.10.2' } }),
    'src/a.ts': "import express from 'express';\nimport { z } from 'zod/v4';\n",
    'src/b.ts': "const e = require('express');\nimport fs from 'node:fs';\n",
  });
  const audit = readCodeMap(out).audit.map((a) => [a.name, a.dormant, a.importCount, a.files.join(',')]);
  assert.deepEqual(audit, [
    ['lodash', true, 0, ''],
    ['express', false, 2, 'src/a.ts,src/b.ts'],
    ['zod', false, 1, 'src/a.ts'],
    ['typescript', false, 0, ''],
    ['@types/node', false, 0, ''],
  ]);
});
