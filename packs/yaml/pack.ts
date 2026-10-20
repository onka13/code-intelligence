import path from 'node:path';
import YAML from 'yaml';
import type { DeclaredDependency } from '../../src/model.js';
import { dataSkeleton } from '../../src/packs/dataShape.js';
import { ParseError, type LanguagePack } from '../../src/packs/pack.js';

/** YAML files, and the dependencies a pubspec.yaml declares. */

/** `http: 1.2.2`, `flutter: { sdk: flutter }`, `local: { path: ../local }`. */
function dependency(name: string, spec: unknown, dev: boolean): DeclaredDependency {
  if (spec && typeof spec === 'object') {
    const entries = spec as Record<string, unknown>;
    if ('sdk' in entries) return { name, version: `sdk: ${entries.sdk}`, dev, sdk: true };
    return { name, version: Object.entries(entries).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', '), dev };
  }
  return { name, version: spec === null || spec === undefined ? 'any' : String(spec), dev };
}

function pubspecDependencies(doc: any): DeclaredDependency[] {
  const section = (key: string, dev: boolean) => Object.entries((doc?.[key] ?? {}) as Record<string, unknown>).map(([n, s]) => dependency(n, s, dev));
  return [...section('dependencies', false), ...section('dev_dependencies', true)];
}

export const yamlPack: LanguagePack = {
  id: 'yaml',
  data: true,
  claims: (file) => file.endsWith('.yaml') || file.endsWith('.yml'),
  parse: async ({ path: file, content }) => {
    let parsed: unknown;
    try {
      parsed = YAML.parse(content);
    } catch (err) {
      throw new ParseError(`Invalid YAML: ${(err as Error).message.split('\n')[0]}`);
    }
    const declares = path.posix.basename(file) === 'pubspec.yaml' ? pubspecDependencies(parsed) : undefined;
    return { symbols: [], imports: [], skeleton: dataSkeleton('YAML', content, parsed), ...(declares ? { declares } : {}) };
  },
};
