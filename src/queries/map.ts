import path from 'node:path';
import type { CodeMap, FileRecord } from '../model.js';
import { fullBlock, mapSummary } from '../text/declarations.js';
import { renderTree } from '../text/tree.js';
import { UnknownFileError } from './neighborhood.js';

/**
 * The repo map text of a scanned folder, one of its subfolders, or one file, read from the stored code map (CIN-07).
 * For one file it prints only that file's declarations: its one-line summary, or with `full` its full declarations.
 */

export interface MapOptions {
  /** A subfolder or a file of the scanned folder; the whole folder when absent. */
  folder?: string;
  /** Include fields and getters in the one-line summaries. */
  fields?: boolean;
  /** Print every public declaration under its file (the TopologyFULL text) instead of a one-line summary. */
  full?: boolean;
  /** Folder levels to print below the root. */
  depth?: number;
  /** Print the folders only. */
  foldersOnly?: boolean;
}

function renderFile(record: FileRecord, options: MapOptions): string {
  if (options.full) return fullBlock(record).join('\n');
  return mapSummary(record, options.fields === true) ?? '';
}

export function renderMap(map: CodeMap, options: MapOptions = {}): string {
  const folder = (options.folder ?? '').replace(/^\.?\/+|\/+$/g, '');
  const file = map.files.find((f) => f.path === folder);
  if (file) return renderFile(file, options);
  const records = map.files.filter((f) => f.language !== 'other' && (!folder || f.path.startsWith(`${folder}/`)));
  if (folder && records.length === 0 && !map.files.some((f) => f.path.startsWith(`${folder}/`))) throw new UnknownFileError(`Not in the code map: ${folder}`);
  const byPath = new Map(records.map((r) => [folder ? r.path.slice(folder.length + 1) : r.path, r]));
  return renderTree([...byPath.keys()], {
    rootName: folder ? path.posix.basename(folder) : map.rootName,
    maxDepth: options.depth,
    foldersOnly: options.foldersOnly,
    describe: (p) => {
      const record = byPath.get(p)!;
      if (!options.full) return { inline: mapSummary(record, options.fields === true) };
      const block = fullBlock(record);
      return block.length ? { block } : {};
    },
  });
}
