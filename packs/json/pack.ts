import path from 'node:path';
import type { DeclaredDependency } from '../../src/model.js';
import { parseJsonc } from '../../src/jsonc.js';
import { dataSkeleton } from '../../src/packs/dataShape.js';
import { ParseError, type LanguagePack } from '../../src/packs/pack.js';

/** JSON files (comments and trailing commas allowed, as in tsconfig.json), and the dependencies a package.json declares. */

const SECTIONS: Array<[string, boolean]> = [['dependencies', false], ['peerDependencies', false], ['optionalDependencies', false], ['devDependencies', true]];

function packageDependencies(json: any): DeclaredDependency[] {
  return SECTIONS.flatMap(([section, dev]) =>
    Object.entries((json?.[section] ?? {}) as Record<string, unknown>).map(([name, version]) => ({ name, version: String(version), dev })),
  );
}

export const jsonPack: LanguagePack = {
  id: 'json',
  data: true,
  claims: (file) => file.endsWith('.json'),
  parse: async ({ path: file, content }) => {
    let parsed: unknown;
    try {
      parsed = parseJsonc(content);
    } catch (err) {
      // Node 24 and later append "(line N column M)"; drop it so outputs match on every Node version.
      const message = (err as Error).message.replace(/ \(line \d+ column \d+\)$/, '');
      throw new ParseError(`Invalid JSON: ${message}`);
    }
    const declares = path.posix.basename(file) === 'package.json' ? packageDependencies(parsed) : undefined;
    return { symbols: [], imports: [], skeleton: dataSkeleton('JSON', content, parsed), ...(declares ? { declares } : {}) };
  },
};
