import { builtinModules } from 'node:module';
import path from 'node:path';
import { parseJsonc } from '../../src/jsonc.js';
import type { ProjectView, Resolution, ResolveInput } from '../../src/packs/pack.js';

/** Resolves a module specifier to a project file, a package or a Node.js built-in. */

const EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
/** NodeNext projects import `./a.js` for the source file `./a.ts`. */
const SOURCE_FOR = { '.js': ['.ts', '.tsx'], '.jsx': ['.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] } as Record<string, string[]>;
const BUILTINS = new Set(builtinModules);

interface PathAliases {
  baseUrl?: string;
  paths: Array<{ prefix: string; suffix: string; targets: string[] }>;
}

const aliasCache = new WeakMap<ProjectView, PathAliases>();

/** `compilerOptions.baseUrl` and `paths` of the root tsconfig.json or jsconfig.json. */
function aliases(project: ProjectView): PathAliases {
  const cached = aliasCache.get(project);
  if (cached) return cached;
  const text = project.read('tsconfig.json') ?? project.read('jsconfig.json');
  const options = text ? ((parseJsonc(text) as any)?.compilerOptions ?? {}) : {};
  const baseUrl = typeof options.baseUrl === 'string' ? path.posix.normalize(options.baseUrl) : undefined;
  const paths = Object.entries((options.paths ?? {}) as Record<string, string[]>).map(([pattern, targets]) => {
    const [prefix, suffix = ''] = pattern.split('*');
    return { prefix, suffix, targets };
  });
  const found = { baseUrl, paths };
  aliasCache.set(project, found);
  return found;
}

/** The project file a path stands for: the path itself, its source file, or the path with an extension or /index. */
function findFile(base: string, project: ProjectView): string | undefined {
  const clean = path.posix.normalize(base).replace(/^\.\//, '');
  const ext = path.posix.extname(clean);
  const candidates = [
    clean,
    ...(SOURCE_FOR[ext] ?? []).map((e) => clean.slice(0, -ext.length) + e),
    ...EXTENSIONS.map((e) => clean + e),
    ...EXTENSIONS.map((e) => `${clean}/index${e}`),
  ];
  return candidates.find((c) => !c.startsWith('..') && project.has(c));
}

/** A file through `paths` or `baseUrl`; `null` when a `paths` alias matches but names no project file. */
function viaAliases(spec: string, project: ProjectView): string | null | undefined {
  const { baseUrl, paths } = aliases(project);
  const matching = paths.filter((a) => spec.startsWith(a.prefix) && spec.endsWith(a.suffix));
  for (const alias of matching) {
    const middle = spec.slice(alias.prefix.length, spec.length - alias.suffix.length);
    const found = alias.targets.map((t) => findFile(path.posix.join(baseUrl ?? '.', t.replace('*', middle)), project)).find(Boolean);
    if (found) return found;
  }
  if (matching.length) return null;
  return baseUrl ? findFile(path.posix.join(baseUrl, spec), project) : undefined;
}

function packageName(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function resolveTypeScript({ from, raw, project }: ResolveInput): Resolution {
  const spec = raw.specifier;
  if (spec.startsWith('node:') || BUILTINS.has(spec)) return { kind: 'builtin' };
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const target = findFile(path.posix.join(path.posix.dirname(from), spec), project);
    return target ? { kind: 'file', target } : { kind: 'unresolved' };
  }
  const aliased = viaAliases(spec, project);
  if (aliased === null) return { kind: 'unresolved' };
  return aliased ? { kind: 'file', target: aliased } : { kind: 'package', package: packageName(spec) };
}
