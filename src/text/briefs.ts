import fs from 'node:fs';
import path from 'node:path';
import type { CodeMap } from '../model.js';
import { UnknownFileError, type Neighborhood, type NeighborhoodEntry } from '../queries/neighborhood.js';

/** The text the CLI prints for `neighborhood` and `brief`: each file under a header line, as a brief or as its contents. */

/** Where the scanned files are read from for `--contents`: the given root, or the folder that holds the outputs. */
export interface ContentSource {
  root: string;
}

function body(entry: NeighborhoodEntry, source: ContentSource | undefined): string {
  if (!source) return (entry.brief ?? '').trimEnd();
  return fs.readFileSync(path.join(source.root, entry.path), 'utf8').trimEnd();
}

function header(entry: NeighborhoodEntry): string {
  return `## tier ${entry.tier}  ${entry.path}  (${entry.tokens} tokens; ${entry.reason})`;
}

function footer(result: Neighborhood): string {
  const files = result.targets.length + result.selected.length;
  const left = result.omitted.files;
  if (result.budget === undefined) {
    const more = left ? `; ${left} files one ring further left out (${result.omitted.tokens} tokens; give --budget to include them)` : '';
    return `${result.selectedTokens} tokens in ${files} files${more}.`;
  }
  return `${result.selectedTokens} of ${result.budget} tokens used; ${left} files left out (${result.omitted.tokens} tokens).`;
}

/** One header line per file, without briefs or contents. */
export function neighborhoodList(result: Neighborhood): string {
  const lines = [...result.targets, ...result.selected].map((e) => `tier ${e.tier}  ${e.path}  (${e.tokens} tokens; ${e.reason})`);
  return [...lines, footer(result)].join('\n');
}

/** Each file's header, then its brief, or its contents when a source is given. */
export function neighborhoodText(result: Neighborhood, source?: ContentSource): string {
  const blocks = [...result.targets, ...result.selected].map((e) => `${header(e)}\n${body(e, source)}`);
  return [...blocks, footer(result)].join('\n\n');
}

/** The briefs of the given files, each under its path. */
export function briefsText(map: CodeMap, files: string[]): string {
  const records = new Map(map.files.map((f) => [f.path, f]));
  const paths = files.map((p) => p.replace(/^\.\//, ''));
  const unknown = paths.filter((p) => !records.has(p));
  if (unknown.length) throw new UnknownFileError(`Not in the code map: ${unknown.join(', ')}`);
  return paths.map((p) => `## ${p}  (${records.get(p)!.skeletonTokens} tokens)\n${records.get(p)!.skeleton}`).join('\n\n');
}
