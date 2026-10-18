import fs from 'node:fs';
import path from 'node:path';
import { PACKS } from '../packs/index.js';
import { scan } from '../src/scan/scan.js';
import { REPO, stableMap, stableTopology, tempDir } from './helpers.js';

/** Golden files of the language packs (CIN-10): each pack folder holds fixtures/project and fixtures/expected. */

export const PACKS_DIR = path.join(REPO, 'packs');

export function packFolders(): string[] {
  return fs.readdirSync(PACKS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export const fixturePaths = (pack: string) => ({
  project: path.join(PACKS_DIR, pack, 'fixtures', 'project'),
  expected: path.join(PACKS_DIR, pack, 'fixtures', 'expected'),
});

/** The outputs of a fixture project, with run-specific values blanked, as the expected files hold them. */
export async function goldenOutputs(pack: string): Promise<Record<string, string>> {
  const { map, topology, out } = await scan({ root: fixturePaths(pack).project, out: path.join(tempDir(), 'out'), packs: PACKS });
  return {
    'ast_code_map.json': `${JSON.stringify({ ...(stableMap(map) as object), rootName: 'project' }, null, 2)}\n`,
    'graphify_topology.json': `${JSON.stringify(stableTopology(topology), null, 2)}\n`,
    'TopologyFULL.txt': fs.readFileSync(path.join(out, 'TopologyFULL.txt'), 'utf8'),
  };
}
