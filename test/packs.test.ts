import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { PACKS } from '../packs/index.js';
import { scan } from '../src/scan/scan.js';
import type { LanguagePack } from '../src/packs/pack.js';
import { fixturePaths, goldenOutputs, packFolders } from './golden.js';
import { tempDir, writeFiles } from './helpers.js';

test('CIN-10: every pack has fixtures, and its outputs equal the expected files', async () => {
  assert.deepEqual(packFolders(), PACKS.map((p) => p.id).sort(), 'every pack folder is in the pack list and the other way round');
  for (const pack of packFolders()) {
    const { project, expected } = fixturePaths(pack);
    assert.ok(fs.existsSync(project) && fs.readdirSync(project).length > 0, `pack ${pack} has no fixture project`);
    for (const [name, content] of Object.entries(await goldenOutputs(pack))) {
      const file = path.join(expected, name);
      assert.ok(fs.existsSync(file), `pack ${pack} has no expected ${name}; run npm run golden:update and review it`);
      assert.equal(content, fs.readFileSync(file, 'utf8'), `pack ${pack}: ${name} differs from the expected file`);
    }
  }
});

/** A pack written outside the core: INI files, each [section] a declaration. */
const iniPack: LanguagePack = {
  id: 'ini',
  claims: (file) => file.endsWith('.ini'),
  parse: async ({ content }) => ({
    imports: [],
    symbols: content.split('\n').flatMap((line, i) => {
      const section = /^\[(.+)\]$/.exec(line.trim());
      return section ? [{ kind: 'variable' as const, name: section[1], signature: `[${section[1]}]`, lineStart: i + 1, lineEnd: i + 1, exported: true, visibility: 'public' as const }] : [];
    }),
  }),
};

test('CIN-11: a new language is added through the pack contract, without changing the core', async () => {
  const root = tempDir();
  writeFiles(root, { 'config/app.ini': '[server]\nport=1\n[client]\n', 'src/a.ts': 'export const a = 1;\n' });
  const before = await scan({ root, out: path.join(tempDir(), 'out'), packs: PACKS });
  assert.deepEqual(before.map.summary.unsupported, { '.ini': 1 });
  const after = await scan({ root, out: path.join(tempDir(), 'out'), packs: [...PACKS, iniPack] });
  const ini = after.map.files.find((f) => f.path === 'config/app.ini')!;
  assert.deepEqual([ini.language, ini.symbols.map((s) => s.name)], ['ini', ['server', 'client']]);
  assert.deepEqual(after.map.summary.unsupported, {});
});
