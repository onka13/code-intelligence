import path from 'node:path';
import type { CodeMap } from '../model.js';
import { fullBlock, mapSummary } from '../text/declarations.js';
import { renderTree } from '../text/tree.js';

/** The repo map text of a scanned folder or one of its subfolders, read from the stored code map (CIN-07). */

export interface MapOptions {
  /** A subfolder of the scanned folder; the whole folder when absent. */
  folder?: string;
  /** Include fields and getters in the one-line summaries. */
  fields?: boolean;
  /** Print every public declaration under its file (the TopologyFULL text) instead of a one-line summary. */
  full?: boolean;
  /** Folder levels to print below the root. */
  depth?: number;
}

export function renderMap(map: CodeMap, options: MapOptions = {}): string {
  const folder = (options.folder ?? '').replace(/^\.?\/+|\/+$/g, '');
  const records = map.files.filter((f) => f.language !== 'other' && (!folder || f.path.startsWith(`${folder}/`)));
  const byPath = new Map(records.map((r) => [folder ? r.path.slice(folder.length + 1) : r.path, r]));
  return renderTree([...byPath.keys()], {
    rootName: folder ? path.posix.basename(folder) : map.rootName,
    maxDepth: options.depth,
    describe: (p) => {
      const record = byPath.get(p)!;
      if (!options.full) return { inline: mapSummary(record, options.fields === true) };
      const block = fullBlock(record);
      return block.length ? { block } : {};
    },
  });
}
