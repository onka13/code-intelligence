/**
 * Collapses numbered files in one folder: `quiz_1.json` .. `quiz_45.json` becomes `quiz_{1..45}.json [45 JSON files]`.
 * Only runs of three or more consecutive numbers collapse, so a listing never claims files that do not exist.
 */

interface NumberAt {
  file: string;
  prefix: string;
  suffix: string;
  ext: string;
  digits: string;
  num: number;
  index: number;
}

interface Run {
  files: string[];
  label: string;
  index: number;
}

export const byName = (a: string, b: string): number => a.localeCompare(b, 'en');

function numbersIn(file: string): NumberAt[] {
  const dot = file.lastIndexOf('.');
  const ext = dot === -1 ? '' : file.slice(dot + 1).toLowerCase();
  const base = dot === -1 ? file : file.slice(0, dot);
  return [...base.matchAll(/\d+/g)].map((m) => ({
    file, ext, digits: m[0], num: Number(m[0]), index: m.index!,
    prefix: base.slice(0, m.index), suffix: base.slice(m.index! + m[0].length),
  }));
}

function toRun(items: NumberAt[]): Run {
  const first = items[0];
  const ext = first.ext ? `.${first.ext}` : '';
  const what = first.ext ? `${first.ext.toUpperCase()} files` : 'files';
  const label = `${first.prefix}{${first.digits}..${items[items.length - 1].digits}}${first.suffix}${ext} [${items.length} ${what}]`;
  return { files: items.map((i) => i.file), label, index: first.index };
}

/** Runs of three or more consecutive numbers among files sharing a prefix, suffix and extension. */
function runs(files: string[]): Run[] {
  const groups = new Map<string, NumberAt[]>();
  for (const n of files.flatMap(numbersIn)) {
    const key = `${n.prefix.toLowerCase()}#${n.suffix.toLowerCase()}#${n.ext}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const found: Run[] = [];
  for (const items of groups.values()) {
    items.sort((a, b) => a.num - b.num);
    let current = [items[0]];
    for (const item of [...items.slice(1), undefined]) {
      if (item && item.num === current[current.length - 1].num + 1) current.push(item);
      else {
        if (current.length >= 3) found.push(toRun(current));
        if (item) current = [item];
      }
    }
  }
  return found.sort((a, b) => b.files.length - a.files.length || b.index - a.index);
}

/** The names to show for one folder's files, sorted; `collapsed` maps a group label to the files it stands for. */
export function collapseNames(files: string[]): { names: string[]; collapsed: Map<string, string[]> } {
  const collapsed = new Map<string, string[]>();
  const claimed = new Set<string>();
  for (const run of files.length > 2 ? runs(files) : []) {
    if (run.files.some((f) => claimed.has(f))) continue;
    run.files.forEach((f) => claimed.add(f));
    collapsed.set(run.label, run.files);
  }
  const names = [...collapsed.keys(), ...files.filter((f) => !claimed.has(f))].sort(byName);
  return { names, collapsed };
}
