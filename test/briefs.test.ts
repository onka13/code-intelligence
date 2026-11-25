import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { PACKS } from '../packs/index.js';
import { scan } from '../src/scan/scan.js';
import { tempDir, writeFiles } from './helpers.js';

/** CIN-21: a file's brief stays small however large the file is: long enums, constant runs and data are folded. */

async function briefs(files: Record<string, string>) {
  const root = tempDir();
  writeFiles(root, files);
  const { map } = await scan({ root, out: path.join(tempDir(), 'out'), packs: PACKS });
  return (file: string) => map.files.find((f) => f.path === file)!;
}

const names = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

test('CIN-21: a long enum shows its first members with values and counts the rest; a short one is whole', async () => {
  const file = await briefs({
    'src/enum.ts': [
      `export enum JobName { ${names(20, 'Job').map((n) => `${n} = '${n.toLowerCase()}'`).join(', ')} }`,
      "export enum Side { Left = 'left', Right = 'right' }",
      '',
    ].join('\n'),
  });
  assert.equal(file('src/enum.ts').skeleton, [
    "enum JobName { Job0 = 'job0', Job1 = 'job1', Job2 = 'job2', Job3 = 'job3', Job4 = 'job4', Job5 = 'job5', Job6 = 'job6', Job7 = 'job7', ... +12 more }",
    "enum Side { Left = 'left', Right = 'right' }",
  ].join('\n\n'));
});

test('CIN-21: a long run of top-level constants keeps its first ten and counts the rest', async () => {
  const icons = names(25, 'Icon').map((n) => `export const ${n} = '<svg/>';`);
  const file = await briefs({ 'src/icons.ts': [...icons, 'export function icon(name: string): string { return name; }', ''].join('\n') });
  const blocks = file('src/icons.ts').skeleton.split('\n\n');
  assert.equal(blocks.length, 12);
  assert.equal(blocks[9], 'const Icon9;');
  assert.equal(blocks[10], '// ... +15 more constants');
  assert.equal(blocks[11], 'function icon(name: string): string;');
});

test('CIN-21: a large data file is shaped: one item per list with its count, dictionaries folded', async () => {
  const products = Array.from({ length: 5000 }, (_, i) => ({ id: `p${i}`, price: i, tags: ['a', 'b'] }));
  const labels = Object.fromEntries(names(30, 'label').map((n) => [n, 'text']));
  const file = await briefs({
    'data/products.json': JSON.stringify(products, null, 2),
    'data/labels.yaml': Object.entries(labels).map(([k, v]) => `${k}: ${v}`).join('\n'),
  });
  const shaped = file('data/products.json');
  assert.ok(shaped.rawTokens > 50_000);
  assert.equal(shaped.skeleton, '// JSON shape\n[\n  {\n    id: string\n    price: number\n    tags: [string] (2 items)\n  }\n] (5000 items)');
  assert.equal(file('data/labels.yaml').skeleton, '// YAML shape\n{ [key]: string } (30 keys: "label0", "label1", "label2", ...)');
});
