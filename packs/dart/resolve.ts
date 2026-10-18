import path from 'node:path';
import YAML from 'yaml';
import type { ProjectView, Resolution, ResolveInput } from '../../src/packs/pack.js';

/** Resolves a Dart URI: `dart:` libraries, the project's own `package:` URIs (its `lib/` folder), other packages, relative files. */

const ownNames = new WeakMap<ProjectView, string | undefined>();

/** The `name` of the scan root's pubspec.yaml; an unreadable pubspec gives no name. */
function ownPackage(project: ProjectView): string | undefined {
  if (!ownNames.has(project)) {
    const text = project.read('pubspec.yaml');
    let name: string | undefined;
    try {
      name = text ? (YAML.parse(text) as { name?: unknown } | null)?.name as string | undefined : undefined;
    } catch {
      name = undefined; // The pubspec's own parse error is recorded against pubspec.yaml by the YAML pack.
    }
    ownNames.set(project, typeof name === 'string' ? name : undefined);
  }
  return ownNames.get(project);
}

function file(target: string, project: ProjectView): Resolution {
  const clean = path.posix.normalize(target);
  return !clean.startsWith('..') && project.has(clean) ? { kind: 'file', target: clean } : { kind: 'unresolved' };
}

export function resolveDart({ from, raw, project }: ResolveInput): Resolution {
  const uri = raw.specifier;
  if (uri.startsWith('dart:')) return { kind: 'builtin' };
  const pkg = /^package:([^/]+)\/(.+)$/.exec(uri);
  if (pkg) return pkg[1] === ownPackage(project) ? file(`lib/${pkg[2]}`, project) : { kind: 'package', package: pkg[1] };
  return file(path.posix.join(path.posix.dirname(from), uri), project);
}
