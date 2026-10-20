import fs from 'node:fs';
import path from 'node:path';
import type { FileRecord, ImportRef } from '../model.js';
import type { LanguagePack, ProjectView } from '../packs/pack.js';
import { packFor } from './records.js';

/**
 * Resolves every import of every record against the files of this scan. It runs on every scan, also for files that
 * were not parsed again, so an import of an unchanged file follows a file that was added or removed.
 */

function projectView(root: string, records: FileRecord[]): ProjectView {
  const paths = new Set(records.map((r) => r.path));
  const sorted = [...paths].sort();
  const texts = new Map<string, string | undefined>();
  return {
    has: (p) => paths.has(p),
    paths: () => sorted,
    read: (p) => {
      if (!texts.has(p)) texts.set(p, paths.has(p) ? fs.readFileSync(path.join(root, p), 'utf8') : undefined);
      return texts.get(p);
    },
  };
}

/** A reused record holds resolved imports, one per target; each import statement is resolved once again. */
function rawImports(imports: ImportRef[]): ImportRef[] {
  const seen = new Set<string>();
  return imports.filter((i) => {
    const key = `${i.line}\u0000${i.specifier}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One import, or one per target when it points at several files. */
function resolved(imp: ImportRef, from: string, pack: LanguagePack | undefined, project: ProjectView): ImportRef[] {
  const { specifier, line, typeOnly } = imp;
  const resolution = pack?.resolve?.({ from, raw: { specifier, line, typeOnly }, project }) ?? { kind: 'unresolved' as const };
  return (Array.isArray(resolution) ? resolution : [resolution]).map((r) => ({ specifier, line, ...(typeOnly ? { typeOnly } : {}), ...r }));
}

export function resolveImports(root: string, records: FileRecord[], packs: LanguagePack[]): FileRecord[] {
  const project = projectView(root, records);
  return records.map((r) => {
    if (r.imports.length === 0) return r;
    const pack = packFor(r.path, packs);
    return { ...r, imports: rawImports(r.imports).flatMap((i) => resolved(i, r.path, pack, project)) };
  });
}
