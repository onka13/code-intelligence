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
  const texts = new Map<string, string | undefined>();
  return {
    has: (p) => paths.has(p),
    read: (p) => {
      if (!texts.has(p)) texts.set(p, paths.has(p) ? fs.readFileSync(path.join(root, p), 'utf8') : undefined);
      return texts.get(p);
    },
  };
}

function resolved(imp: ImportRef, from: string, pack: LanguagePack | undefined, project: ProjectView): ImportRef {
  const { specifier, line, typeOnly } = imp;
  const resolution = pack?.resolve?.({ from, raw: { specifier, line, typeOnly }, project }) ?? { kind: 'unresolved' as const };
  return { specifier, line, ...(typeOnly ? { typeOnly } : {}), ...resolution };
}

export function resolveImports(root: string, records: FileRecord[], packs: LanguagePack[]): FileRecord[] {
  const project = projectView(root, records);
  return records.map((r) => {
    if (r.imports.length === 0) return r;
    const pack = packFor(r.path, packs);
    return { ...r, imports: r.imports.map((i) => resolved(i, r.path, pack, project)) };
  });
}
