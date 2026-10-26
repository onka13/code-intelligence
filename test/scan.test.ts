import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { PACKS } from '../packs/index.js';
import { scan } from '../src/scan/scan.js';
import type { SymbolNode } from '../src/model.js';
import { read, REPO, stableMap, stableTopology, tempDir, writeFiles } from './helpers.js';

const CLI = path.join(REPO, 'dist', 'src', 'cli.js');

const MIXED = {
  'package.json': JSON.stringify({ name: 'mixed', dependencies: { express: '4.21.2' } }),
  'pubspec.yaml': 'name: mixed_app\ndependencies:\n  http: 1.2.2\n',
  'src/orders/orderService.ts': [
    "import { Order } from './types';",
    "import express from 'express';",
    'export class OrderService extends Base implements Service {',
    '  private readonly cache = new Map<string, Order>();',
    '  public count: number = 0;',
    '  find(id: string): Order | undefined {',
    '    const local = this.cache.get(id);',
    '    return local;',
    '  }',
    '}',
    '',
  ].join('\n'),
  'src/orders/types.ts': 'export interface Order { id: string }\nexport enum Status { New, Done }\n',
  'lib/widget.dart': [
    "import 'package:http/http.dart';",
    "import 'model.dart';",
    'class Screen extends StatelessWidget {',
    '  final String title;',
    '  Screen(this.title);',
    '  Widget build(BuildContext context) {',
    '    final pending = 1;',
    '    return Text(title);',
    '  }',
    '}',
    '',
  ].join('\n'),
  'lib/model.dart': 'class Model {\n  int size = 0;\n}\n',
};

const names = (symbols: SymbolNode[] = []) => symbols.map((s) => s.name);

test('CIN-01: a scan writes the published outputs with members, imports and a summary', async () => {
  const root = tempDir();
  writeFiles(root, MIXED);
  const out = path.join(tempDir(), 'out');
  const { map, topology } = await scan({ root, out, packs: PACKS });

  for (const file of ['ast_code_map.json', 'topology.json', 'TopologyFULL.txt', 'project_structure.md']) assert.ok(fs.existsSync(path.join(out, file)), file);
  for (const file of Object.keys(MIXED)) assert.ok(map.files.some((f) => f.path === file), file);
  const service = map.files.find((f) => f.path === 'src/orders/orderService.ts')!;
  assert.equal(service.language, 'typescript');
  const cls = service.symbols[0];
  assert.deepEqual([cls.kind, cls.extends, cls.implements], ['class', ['Base'], ['Service']]);
  assert.deepEqual(names(cls.members), ['cache', 'count', 'find']);
  assert.deepEqual(cls.members!.map((m) => m.visibility), ['private', 'public', 'public']);
  assert.ok(service.skeleton.includes('find(id: string): Order | undefined;') && service.rawTokens > service.skeletonTokens);
  assert.deepEqual(names(map.files.find((f) => f.path === 'lib/widget.dart')!.symbols[0].members), ['title', 'Screen', 'build']);

  const text = read(path.join(out, 'TopologyFULL.txt'));
  assert.ok(text.includes('class OrderService extends Base implements Service { public count: number; find(id: string): Order | undefined; }'));
  assert.ok(!/\blocal\b|\bpending\b|\bcache\b/.test(text), 'no local variable or private field in TopologyFULL.txt');
  const imports = topology.edges.filter((e) => e.type === 'imports').map((e) => `${e.source} > ${e.target}`);
  assert.deepEqual(imports, ['file:lib/widget.dart > file:lib/model.dart', 'file:src/orders/orderService.ts > file:src/orders/types.ts']);

  const printed = execFileSync('node', [CLI, 'scan', root, '--out', out], { encoding: 'utf8' });
  assert.match(printed, /Scanned 6 files \(0 parsed, 6 unchanged\) in \d+ ms/);
});

test('CIN-02: ignore files, excluded paths, the default list and secret files are honoured', async () => {
  const root = tempDir();
  writeFiles(root, {
    '.gitignore': 'generated/\n',
    '.contextignore': 'legacy/\n',
    'src/keep.ts': 'export const a = 1;\n',
    'src/nested/.gitignore': 'local.ts\n',
    'src/nested/local.ts': 'export const b = 1;\n',
    'src/nested/shared.ts': 'export const c = 1;\n',
    'node_modules/x/index.js': 'module.exports = 1;\n',
    'generated/client.ts': 'export class Client {}\n',
    'legacy/old.ts': 'export class Old {}\n',
    'docs/guide.ts': 'export class Guide {}\n',
    'build/out.js': 'x();\n',
    'dist/out.js': 'x();\n',
    '.dart_tool/cache.dart': 'class C {}\n',
    '.agency/app/x.json': '{}\n',
    '.git/HEAD': 'ref\n',
    'config/credentials.json': '{ "token": "x" }\n',
    'config/secrets.json': '{ "key": "x" }\n',
    'config/firebase-serviceAccountKey.json': '{ "private_key": "x" }\n',
    'certs/server.pem': 'x\n',
  });
  const { map } = await scan({ root, out: path.join(tempDir(), 'out'), exclude: ['docs/'], packs: PACKS });
  assert.deepEqual(map.files.map((f) => f.path), ['src/keep.ts', 'src/nested/shared.ts']);
});

test('CIN-03: a rescan parses only what changed and equals a full scan', async () => {
  const root = tempDir();
  const files: Record<string, string> = {};
  for (let i = 0; i < 30; i++) files[`src/m${i}.ts`] = `import { v${(i + 1) % 30} } from './m${(i + 1) % 30}';\nexport const v${i} = ${i};\n`;
  writeFiles(root, files);
  const out = path.join(tempDir(), 'out');
  await scan({ root, out, packs: PACKS });

  for (const i of [3, 7, 11]) fs.appendFileSync(path.join(root, `src/m${i}.ts`), `export function changed${i}() {}\n`);
  fs.rmSync(path.join(root, 'src/m20.ts'));
  const again = await scan({ root, out, packs: PACKS });
  assert.equal(again.map.summary.parsed, 3);
  assert.equal(again.map.summary.reused, 26);
  assert.ok(!again.map.files.some((f) => f.path === 'src/m20.ts'));
  assert.ok(!again.topology.edges.some((e) => e.source.includes('m20') || e.target.includes('m20')));
  assert.ok(again.map.files.find((f) => f.path === 'src/m19.ts')!.imports[0].kind === 'unresolved', 'an unchanged file follows the deletion');

  const full = await scan({ root, out: path.join(tempDir(), 'out'), full: true, packs: PACKS });
  assert.equal(full.map.summary.parsed, 29);
  assert.deepEqual(stableMap(again.map), stableMap(full.map));
  assert.deepEqual(stableTopology(again.topology), stableTopology(full.topology));
});

test('CIN-04: one broken file is recorded and does not stop the scan', async () => {
  const root = tempDir();
  writeFiles(root, { 'lib/good.dart': 'class Good {}\n', 'lib/broken.dart': 'class Broken {\n  void m( {\n' });
  const out = path.join(tempDir(), 'out');
  const { map } = await scan({ root, out, packs: PACKS });
  const broken = map.files.find((f) => f.path === 'lib/broken.dart')!;
  assert.match(broken.error ?? '', /^Syntax error at line \d+/);
  assert.deepEqual(broken.symbols, []);
  assert.deepEqual(names(map.files.find((f) => f.path === 'lib/good.dart')!.symbols), ['Good']);
  assert.deepEqual(map.summary.failed.map((f) => f.path), ['lib/broken.dart']);
  const printed = execFileSync('node', [CLI, 'scan', root, '--out', out, '--full'], { encoding: 'utf8' });
  assert.match(printed, /failed {2}lib\/broken\.dart: Syntax error/);
});

test('CIN-05: unsupported languages are listed and reported, never guessed', async () => {
  const root = tempDir();
  writeFiles(root, { 'app/main.py': 'class Service:\n    def run(self): pass\n', 'app/util.py': 'import os\n', 'src/a.ts': 'export const a = 1;\n' });
  const { map, topology } = await scan({ root, out: path.join(tempDir(), 'out'), packs: PACKS });
  const py = map.files.filter((f) => f.path.endsWith('.py'));
  assert.deepEqual(py.map((f) => [f.language, f.symbols.length, f.imports.length]), [['other', 0, 0], ['other', 0, 0]]);
  assert.deepEqual(map.summary.unsupported, { '.py': 2 });
  assert.ok(!topology.nodes.some((n) => n.path.endsWith('.py')));
});
