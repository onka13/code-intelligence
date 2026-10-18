import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reads a file of a pack's own folder (a query file). Compiled pack code runs from `dist/packs/<id>/`; its query
 * files stay in `packs/<id>/`.
 */
export function readPackFile(moduleUrl: string, name: string): string {
  const dir = path.dirname(fileURLToPath(moduleUrl));
  const source = dir.replace(`${path.sep}dist${path.sep}packs${path.sep}`, `${path.sep}packs${path.sep}`);
  return fs.readFileSync(path.join(source, name), 'utf8');
}
