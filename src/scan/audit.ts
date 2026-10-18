import path from 'node:path';
import type { AuditEntry, FileRecord } from '../model.js';

/**
 * The dependency audit (CIN-09): every dependency a manifest declares, with the files under the manifest's folder
 * that import it. A runtime dependency nothing imports is dormant. Development tools, type packages (`@types/...`)
 * and SDK dependencies are used without an import, so they are never dormant.
 */

function folderOf(manifest: string): string {
  const dir = path.posix.dirname(manifest);
  return dir === '.' ? '' : dir;
}

/** Whether `file` belongs to the manifest: under its folder and not under a nested manifest of the same name. */
function belongsTo(file: string, manifest: string, sameName: string[]): boolean {
  const dir = folderOf(manifest);
  const inside = (d: string) => d === '' || file.startsWith(`${d}/`);
  if (!inside(dir)) return false;
  return !sameName.some((other) => other !== manifest && folderOf(other).length > dir.length && inside(folderOf(other)));
}

/** The packages each file imports. */
function usage(records: FileRecord[]): Map<string, Set<string>> {
  const byFile = new Map<string, Set<string>>();
  for (const r of records) {
    const packages = r.imports.filter((i) => i.kind === 'package' && i.package).map((i) => i.package as string);
    if (packages.length) byFile.set(r.path, new Set(packages));
  }
  return byFile;
}

export function dependencyAudit(records: FileRecord[]): AuditEntry[] {
  const manifests = records.filter((r) => r.declares?.length);
  const imports = usage(records);
  return manifests.flatMap((m) => {
    const sameName = manifests.filter((o) => path.posix.basename(o.path) === path.posix.basename(m.path)).map((o) => o.path);
    const files = [...imports.keys()].filter((f) => belongsTo(f, m.path, sameName));
    return m.declares!.map((dep) => {
      const using = files.filter((f) => imports.get(f)!.has(dep.name)).sort();
      const usedImplicitly = dep.dev || dep.sdk || dep.name.startsWith('@types/');
      return { name: dep.name, manifest: m.path, version: dep.version, dev: dep.dev, dormant: !usedImplicitly && using.length === 0, importCount: using.length, files: using };
    });
  });
}
