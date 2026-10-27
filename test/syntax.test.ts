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
