import { byName, collapseNames } from './collapse.js';

/** The folder tree text of the map and of TopologyFULL.txt. */

export interface FileText {
  /** Printed after the file name: `📄 a.ts  // class A`. */
  inline?: string;
  /** Printed as lines under the file name. */
  block?: string[];
}

export interface TreeOptions {
  rootName: string;
  /** Folder levels below the root to print; unlimited when absent. */
  maxDepth?: number;
  /** Print folders only. */
  foldersOnly?: boolean;
  describe(path: string): FileText;
}

interface Folder {
  name: string;
  folders: Map<string, Folder>;
  files: Map<string, string>;
}

function buildFolders(paths: string[]): Folder {
  const root: Folder = { name: '', folders: new Map(), files: new Map() };
  for (const path of paths) {
    const parts = path.split('/');
    let folder = root;
    for (const part of parts.slice(0, -1)) {
      if (!folder.folders.has(part)) folder.folders.set(part, { name: part, folders: new Map(), files: new Map() });
      folder = folder.folders.get(part)!;
    }
    folder.files.set(parts[parts.length - 1], path);
  }
  return root;
}

function renderFiles(folder: Folder, prefix: string, opts: TreeOptions, lines: string[]): void {
  const { names } = collapseNames([...folder.files.keys()]);
  names.forEach((name, i) => {
    const last = i === names.length - 1;
    const path = folder.files.get(name);
    const text = path ? opts.describe(path) : {};
    lines.push(`${prefix}${last ? '└── ' : '├── '}📄 ${name}${text.inline ? `  // ${text.inline}` : ''}`);
    for (const line of text.block ?? []) lines.push(`${prefix}${last ? '    ' : '│   '}  ${line}`);
  });
}

function renderFolder(folder: Folder, depth: number, prefix: string, opts: TreeOptions, lines: string[]): void {
  if (opts.maxDepth !== undefined && depth > opts.maxDepth) return;
  const folders = [...folder.folders.values()].sort((a, b) => byName(a.name, b.name));
  const showFiles = !opts.foldersOnly && folder.files.size > 0;
  folders.forEach((sub, i) => {
    const last = i === folders.length - 1 && !showFiles;
    lines.push(`${prefix}${last ? '└── ' : '├── '}📁 ${sub.name}/`);
    renderFolder(sub, depth + 1, prefix + (last ? '    ' : '│   '), opts, lines);
  });
  if (showFiles) renderFiles(folder, prefix, opts, lines);
}

/** The tree of the given file paths under a `📁 <root>/` header. */
export function renderTree(paths: string[], opts: TreeOptions): string {
  const lines = [`📁 ${opts.rootName}/`];
  if (paths.length === 0) lines.push('└── (no files)');
  else renderFolder(buildFolders(paths), 0, '', opts, lines);
  return lines.join('\n');
}
