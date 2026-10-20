import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { PACKS } from '../packs/index.js';
import { health } from '../src/health/health.js';
import { scan } from '../src/scan/scan.js';
import type { CodeMap, FileRecord } from '../src/model.js';
import { fixturePaths } from './golden.js';
import { tempDir } from './helpers.js';

const fileOf = (map: CodeMap, file: string) => map.files.find((f) => f.path === file) as FileRecord;
const importsOf = (record: FileRecord) => record.imports.map((i) => `${i.specifier} -> ${i.kind}:${i.target ?? i.package ?? ''}`);

test('CIN-17 C# declarations, using directives, packages and project references are mapped', async () => {
  const { map, topology } = await scan({ root: fixturePaths('csharp').project, out: path.join(tempDir(), 'out'), packs: PACKS });
  const order = fileOf(map, 'src/Domain/Order.cs').symbols.find((s) => s.name === 'Order')!;
  assert.deepEqual([order.kind, order.extends, order.implements], ['class', ['Entity'], ['IComparable<Order>']]);
  const members = Object.fromEntries((order.members ?? []).map((m) => [m.name, `${m.kind} ${m.visibility}${m.static ? ' static' : ''} ${m.type ?? ''}`.trim()]));
  assert.deepEqual(members, {
    _lines: 'field private List<decimal>', MaxLines: 'field public int', Order: 'constructor public', Id: 'field public string',
    Status: 'field public OrderStatus', Total: 'field public decimal', AddLine: 'method public void', CompareTo: 'method public int',
    OnPlaced: 'method protected void', IsValid: 'method private static bool',
  });
  const kinds = map.files.flatMap((f) => f.symbols.map((s) => `${s.kind} ${s.name}`));
  for (const k of ['class Money', 'interface IOrderRepository', 'enum OrderStatus', 'type OrderPlaced']) assert.ok(kinds.includes(k), k);
  assert.deepEqual(importsOf(fileOf(map, 'src/Api/Services/OrderService.cs')).slice(0, 4), [
    'System.Text -> package:System.Text', 'Serilog -> package:Serilog',
    'Shop.Domain -> file:src/Domain/Order.cs', 'Shop.Domain -> file:src/Domain/OrderStatus.cs',
  ]);
  assert.deepEqual(fileOf(map, 'src/Api/Api.csproj').declares, [{ name: 'Serilog', version: '4.2.0', dev: false }]);
  assert.deepEqual(map.audit.map((d) => [d.name, d.dormant, d.files]), [['Serilog', false, ['src/Api/Services/OrderService.cs']]]);
  assert.ok(topology.edges.some((e) => e.source === 'file:src/Api/Api.csproj' && e.target === 'file:src/Domain/Domain.csproj' && e.type === 'imports'));
});

test('CIN-17 a rescan that reuses unchanged files keeps one import per target', async () => {
  const root = tempDir();
  fs.cpSync(fixturePaths('csharp').project, root, { recursive: true });
  const out = path.join(tempDir(), 'out');
  const first = await scan({ root, out, packs: PACKS });
  const again = await scan({ root, out, packs: PACKS });
  assert.equal(again.map.summary.reused, again.map.summary.files);
  assert.deepEqual(importsOf(fileOf(again.map, 'src/Api/Services/OrderService.cs')), importsOf(fileOf(first.map, 'src/Api/Services/OrderService.cs')));
});

test('CIN-17 a malformed .csproj is recorded with its error and the scan goes on', async () => {
  const { map } = await scan({ root: fixturePaths('msbuild').project, out: path.join(tempDir(), 'out'), packs: PACKS });
  assert.deepEqual(map.summary.failed, [{ path: 'src/Broken/Broken.csproj', error: 'Invalid XML at line 4: </ItemGroup> closes <PackageReference>' }]);
  assert.deepEqual(fileOf(map, 'src/App/App.csproj').declares?.map((d) => `${d.name}@${d.version}${d.dev ? ' dev' : ''}`), ['Polly@8.5.0', 'StyleCop.Analyzers@1.1.118 dev', 'Newtonsoft.Json@']);
});

test('CIN-17 C# methods are measured by code health and the manifests are not', async () => {
  const root = fixturePaths('csharp').project;
  const { map, topology } = await scan({ root, out: path.join(tempDir(), 'out'), packs: PACKS });
  const report = health(map, topology, root, { maxFileLines: 30, maxFunctionLines: 4, hardFunctionLines: 40, minDuplicateLines: 6 }, PACKS);
  assert.deepEqual(report.files.map((f) => f.path), ['src/Domain/Order.cs']);
  assert.deepEqual(report.functions.map((f) => `${f.path} ${f.name}`), ['src/Api/Services/OrderService.cs OrderService.DescribeAsync', 'src/Domain/Order.cs Order.AddLine']);
  assert.deepEqual(report.notMeasured, []);
});
