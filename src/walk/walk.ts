import fs from 'node:fs';
import path from 'node:path';
import { IgnoreRules } from './ignoreRules.js';

export interface WalkedFile {
  /** Relative to the scan root, with forward slashes. */
  path: string;
  sizeBytes: number;
  mtimeMs: number;
}

/**
 * Every file under `root` that the ignore rules keep, sorted by path. Symbolic links are not followed, so a link
 * can never lead the scan outside the folder.
 */
export function walk(root: string, excludedPaths: string[] = []): WalkedFile[] {
  const rules = new IgnoreRules(root, excludedPaths);
  const found: WalkedFile[] = [];
  const visit = (absDir: string, relDir: string) => {
    if (relDir) rules.addFolder(absDir);
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        if (!rules.ignores(rel, true)) visit(abs, rel);
      } else if (entry.isFile() && !rules.ignores(rel, false)) {
        const stat = fs.statSync(abs);
        found.push({ path: rel, sizeBytes: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  };
  visit(root, '');
  return found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
