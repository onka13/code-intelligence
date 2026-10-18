import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CodeMap, Topology } from '../src/model.js';

/** Test helpers: temporary folders, and outputs with their run-specific values (times, versions) blanked. */

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function tempDir(prefix = 'codeintel-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
}

/** A code map without the values that change from run to run: times, versions and the parsed/reused split. */
export function stableMap(map: CodeMap): unknown {
  return {
    ...map, generatedAt: '', generatorVersion: '',
    summary: { ...map.summary, durationMs: 0, parsed: 0, reused: 0 },
    files: map.files.map((f) => ({ ...f, mtimeMs: 0 })),
  };
}

export function stableTopology(topology: Topology): unknown {
  return { ...topology, generatedAt: '', generatorVersion: '' };
}

export const read = (file: string) => fs.readFileSync(file, 'utf8');
export const readJson = <T>(file: string): T => JSON.parse(read(file)) as T;
