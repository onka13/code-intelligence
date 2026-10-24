import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PACKS } from '../packs/index.js';
import { compareHealth } from '../src/health/compare.js';
import { health } from '../src/health/health.js';
import type { HealthLimits } from '../src/health/types.js';
import type { CodeMap, SymbolNode } from '../src/model.js';
import { scan } from '../src/scan/scan.js';
import { tempDir, writeFiles } from './helpers.js';

const LIMITS: HealthLimits = { maxFileLines: 300, maxFunctionLines: 25, hardFunctionLines: 40, maxNestingDepth: 3, minDuplicateLines: 6 };

/** Each function's depth is in its name: `d4` nests four blocks, the `else if` chain and the lambda add no level. */
const TS = `export function d0(): number { return 1; }
export function d4(xs: number[]): void {
  for (const x of xs) {
    if (x > 1) {
      while (x > 2) {
        try { console.log(x); } catch { break; }
      }
    } else if (x > 0) {
      switch (x) { case 1: break; }
    } else if (x < 0) {
      console.log(x);
    }
  }
}
export class Box {
  d2(xs: number[]): number[] { return xs.map((x) => { if (x) { for (;;) { break; } } return x; }); }
}
`;
const DART = `int d0() => 1;
void d3(List<int> xs) {
  for (var x in xs) {
    if (x > 1) {
      while (x > 2) { x--; }
    } else if (x > 0) {
      print(x);
    }
  }
}
class Box {
  void d1(int x) { if (x > 0) { print(x); } }
}
`;
const CS = `namespace App;
public class Box {
    public int D0() => 1;
    public void D4(int[] xs) {
        foreach (var x in xs) {
            using (var s = Open()) {
                lock (s) {
                    if (x > 0) { Log(x); } else if (x < 0) { Log(-x); }
                }
            }
        }
    }
    private System.IDisposable Open() => null;
    private void Log(int x) { }
}
`;

const FILES = { 'src/nest.ts': TS, 'lib/nest.dart': DART, 'src/Nest.cs': CS };

async function scanned(files: Record<string, string>) {
  const root = tempDir('nesting-');
  writeFiles(root, files);
  return { root, ...(await scan({ root, packs: PACKS })) };
}

function depths(map: CodeMap): Record<string, number | undefined> {
  const walk = (nodes: SymbolNode[]): Array<[string, number | undefined]> =>
    nodes.flatMap((n) => [...(n.kind === 'class' ? [] : [[n.name, n.nesting] as [string, number | undefined]]), ...walk(n.members ?? [])]);
  return Object.fromEntries(map.files.flatMap((f) => walk(f.symbols)));
}

test('CIN-19 every function records its deepest nesting; an else if and a lambda add no level', async () => {
  const { map } = await scanned(FILES);
  assert.deepEqual(depths(map), { d0: 0, d4: 4, d2: 2, d3: 3, d1: 1, D0: 0, D4: 4, Open: 0, Log: 0 });
});

test('CIN-19 health lists the functions nested deeper than the limit, with the count and the deepest nesting', async () => {
  const { root, map, topology } = await scanned(FILES);
  const report = health(map, topology, root, LIMITS, PACKS);
  assert.deepEqual(report.nesting.map((f) => [f.path, f.name, f.lineStart, f.lineEnd, f.nesting]), [
    ['src/Nest.cs', 'Box.D4', 4, 12, 4],
    ['src/nest.ts', 'd4', 2, 14, 4],
  ]);
  assert.deepEqual([report.totals.functionsOverNesting, report.totals.deepestNesting], [2, 4]);
  assert.deepEqual(health(map, topology, root, { ...LIMITS, maxNestingDepth: 4 }, PACKS).nesting, []);
});

test('CIN-19 the comparison lists only the functions that newly crossed the nesting limit', async () => {
  const before = await scanned({ 'src/nest.ts': TS });
  const after = await scanned({ 'src/nest.ts': TS.replace('if (x) { for (;;) { break; } }', 'if (x) { for (;;) { while (x) { if (x) { break; } } } }') });
  const result = compareHealth(health(before.map, before.topology, before.root, LIMITS, PACKS), health(after.map, after.topology, after.root, LIMITS, PACKS));
  assert.deepEqual(result.nesting.map((f) => [f.name, f.nesting]), [['Box.d2', 4]]);
});

test('CIN-19 health refuses outputs that predate the nesting depth', async () => {
  const { root, map, topology } = await scanned({ 'src/nest.ts': TS });
  const old: CodeMap = { ...map, files: map.files.map((f) => ({ ...f, symbols: f.symbols.map(({ nesting, ...s }) => s) })) };
  assert.throws(() => health(old, topology, root, LIMITS, PACKS), /d0 has no nesting depth; the scan outputs predate it, scan again/);
});
