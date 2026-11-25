import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { PACKS } from '../packs/index.js';
import { scan } from '../src/scan/scan.js';
import { tempDir, writeFiles } from './helpers.js';

/** CIN-20: current syntax of each language is read, and real syntax errors are still reported. */

async function scanFiles(files: Record<string, string>) {
  const root = tempDir();
  writeFiles(root, files);
  const { map } = await scan({ root, out: path.join(tempDir(), 'out'), packs: PACKS });
  return (file: string) => map.files.find((f) => f.path === file)!;
}

test('CIN-20: Dart 3 records, patterns, switch expressions and class modifiers are read', async () => {
  const file = await scanFiles({
    'lib/shapes.dart': [
      'sealed class Shape {}',
      'final class Square extends Shape {',
      '  final double side;',
      '  Square(this.side);',
      '}',
      '',
      '({String name, int age}) person() => (name: "Ada", age: 36);',
      '',
      'double area(Shape shape) => switch (shape) {',
      '  Square(side: final s) when s > 0 => s * s,',
      '  _ => 0,',
      '};',
      '',
      'String describe(Object value) {',
      '  switch (value) {',
      '    case (int a, int b) when a > b:',
      '      return "pair";',
      '    case _:',
      '      return "other";',
      '  }',
      '}',
      '',
    ].join('\n'),
  });
  const shapes = file('lib/shapes.dart');
  assert.equal(shapes.error, undefined);
  assert.deepEqual(shapes.symbols.map((s) => s.name), ['Shape', 'Square', 'person', 'area', 'describe']);
  assert.match(shapes.skeleton, /\(\{String name, int age\}\) person\(\)/);
});

test('CIN-20: a bare & in JSX text is read; a broken element is still an error', async () => {
  const file = await scanFiles({
    'src/Roles.tsx': [
      'export function Roles({ count }: { count: number }) {',
      '  return (',
      '    <div>',
      '      <h1 className="title">Roles & Permissions</h1>',
      '      <p>Q&A</p>',
      '      <p>{count} & done</p>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'src/Broken.tsx': 'export function Broken() {\n  return <div><h1>Title</div>;\n}\n',
    // Two bare ampersands in one run of text break the grammar's recovery, so the file is reported, never guessed.
    'src/Twice.tsx': 'export const Twice = () => <p>a & b & c</p>;\n',
  });
  const roles = file('src/Roles.tsx');
  assert.equal(roles.error, undefined);
  assert.deepEqual(roles.symbols.map((s) => s.name), ['Roles']);
  assert.match(file('src/Broken.tsx').error ?? '', /^Syntax error at line \d+/);
  assert.match(file('src/Twice.tsx').error ?? '', /^Syntax error at line \d+/);
});

test('CIN-20: a tagged template with type arguments is read; a real missing token is still an error', async () => {
  const file = await scanFiles({
    'src/locks.ts': [
      "import { sql } from 'kysely';",
      '',
      'export async function tryLock(conn: unknown, id: number): Promise<boolean> {',
      '  const { rows } = await sql<{',
      '    locked: boolean;',
      '  }>`SELECT pg_try_advisory_lock(${id}) AS locked`.execute(conn);',
      '  return rows[0].locked;',
      '}',
      '',
      'export const ids = (values: string[]) => sql<string[]>`array[${values}]::uuid[]`;',
      '',
    ].join('\n'),
    'src/View.tsx': 'export const Count = () => <p>{sql<number>`SELECT 1`.compile()}</p>;\n',
    'src/Broken.ts': 'export function broken(a: number) {\n  return (a + 1;\n}\n',
  });
  const locks = file('src/locks.ts');
  assert.equal(locks.error, undefined);
  assert.deepEqual(locks.symbols.map((s) => s.name), ['tryLock', 'ids']);
  assert.equal(file('src/View.tsx').error, undefined);
  assert.match(file('src/Broken.ts').error ?? '', /^Syntax error at line \d+/);
});
