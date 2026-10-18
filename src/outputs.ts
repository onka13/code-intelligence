import fs from 'node:fs';
import path from 'node:path';
import type { CodeMap, Topology } from './model.js';
import { renderMap } from './queries/map.js';
import { renderStructure } from './text/structure.js';
import { OUTPUT_FILES, SCHEMA_VERSION } from './version.js';

/** The four output files of a scan, written to and read from one output folder. */

/** Outputs made by another major schema version are never read or converted (CIN-15). */
export class OutputVersionError extends Error {
  constructor(file: string, found: unknown) {
    super(`${file} was made with schema version ${String(found)}; this version reads ${SCHEMA_VERSION}. Scan the folder again.`);
  }
}

export class OutputMissingError extends Error {
  constructor(file: string) {
    super(`${file} does not exist. Run "codeintel scan" first.`);
  }
}

export function writeOutputs(out: string, map: CodeMap, topology: Topology): void {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, OUTPUT_FILES.codeMap), `${JSON.stringify(map, null, 2)}\n`);
  fs.writeFileSync(path.join(out, OUTPUT_FILES.topology), `${JSON.stringify(topology, null, 2)}\n`);
  fs.writeFileSync(path.join(out, OUTPUT_FILES.topologyText), `${renderMap(map, { full: true })}\n`);
  fs.writeFileSync(path.join(out, OUTPUT_FILES.structure), renderStructure(map));
}

function readJson<T extends { schemaVersion?: unknown }>(out: string, name: string): T {
  const file = path.join(out, name);
  if (!fs.existsSync(file)) throw new OutputMissingError(file);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  if (doc.schemaVersion !== SCHEMA_VERSION) throw new OutputVersionError(file, doc.schemaVersion);
  return doc;
}

export const readCodeMap = (out: string): CodeMap => readJson<CodeMap>(out, OUTPUT_FILES.codeMap);
export const readTopology = (out: string): Topology => readJson<Topology>(out, OUTPUT_FILES.topology);

/** The previous code map for an incremental scan; none when there is no file or it was made by another version. */
export function previousCodeMap(out: string, generatorVersion: string): CodeMap | undefined {
  const file = path.join(out, OUTPUT_FILES.codeMap);
  if (!fs.existsSync(file)) return undefined;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as CodeMap;
  return doc.schemaVersion === SCHEMA_VERSION && doc.generatorVersion === generatorVersion ? doc : undefined;
}
