import type { ProjectView, Resolution, ResolveInput } from '../../src/packs/pack.js';

/**
 * Resolves a `using` to the project's .cs files that declare that namespace (all of them); a namespace no project file
 * declares is a package (`System.Text`, `Serilog`). `using static X.Y.Type;` and `using A = X.Y.Type;` name a type, so
 * the namespace it sits in is tried next.
 */

/** A namespace declaration at the start of a line (file-scoped or block); nested block namespaces count by their own name. */
const NAMESPACE = /^[ \t]*namespace[ \t]+([A-Za-z_][\w.]*)/gm;
const indexes = new WeakMap<ProjectView, Map<string, string[]>>();

function namespaceIndex(project: ProjectView): Map<string, string[]> {
  let index = indexes.get(project);
  if (!index) {
    index = new Map();
    for (const file of project.paths().filter((p) => p.endsWith('.cs'))) {
      for (const match of (project.read(file) ?? '').matchAll(NAMESPACE)) {
        const files = index.get(match[1]) ?? [];
        if (!files.includes(file)) files.push(file);
        index.set(match[1], files);
      }
    }
    indexes.set(project, index);
  }
  return index;
}

export function resolveCSharp({ raw, project }: ResolveInput): Resolution | Resolution[] {
  const name = raw.specifier.replace(/^global::/, '').replace(/<.*$/s, '');
  const index = namespaceIndex(project);
  const parent = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : undefined;
  for (const namespace of parent ? [name, parent] : [name]) {
    const files = index.get(namespace);
    if (files) return files.map((target) => ({ kind: 'file' as const, target }));
  }
  return { kind: 'package', package: name };
}
