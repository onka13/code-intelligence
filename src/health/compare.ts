import { LIMIT_NAMES, HealthLimitsError, type FunctionOverLimit, type HealthComparison, type HealthReport } from './types.js';

/**
 * What a change did to code health (FR-07, CIN-18): of two reports of the same project made with the same limits, the
 * files and functions that crossed a limit, the new duplicated blocks and import cycles, and the totals before and after.
 */

const RANK = { soft: 1, hard: 2 } as const;

const functionKey = (f: FunctionOverLimit) => `${f.path}\u0000${f.name}`;

/** A cycle in a stable form, so the same cycle found from another start file is the same cycle. */
function cycleKey(cycle: string[]): string {
  const nodes = cycle[0] === cycle[cycle.length - 1] ? cycle.slice(0, -1) : cycle;
  const start = nodes.indexOf([...nodes].sort()[0]);
  return [...nodes.slice(start), ...nodes.slice(0, start)].join('\u0000');
}

function sameLimits(before: HealthReport, after: HealthReport): void {
  const differ = LIMIT_NAMES.filter((name) => before.limits[name] !== after.limits[name]);
  if (differ.length) throw new HealthLimitsError(`The two reports were made with different limits (${differ.join(', ')}); make both with the same limits.`);
}

export function compareHealth(before: HealthReport, after: HealthReport): HealthComparison {
  sameLimits(before, after);
  const filesBefore = new Set(before.files.map((f) => f.path));
  const functionsBefore = new Map(before.functions.map((f) => [functionKey(f), RANK[f.limit]]));
  const keysBefore = new Set(before.duplicates.flatMap((d) => d.keys));
  const cyclesBefore = new Set(before.cycles.map(cycleKey));
  const linesBefore = new Map(before.notMeasured.map((f) => [f.path, f.lines]));
  return {
    limits: after.limits,
    files: after.files.filter((f) => !filesBefore.has(f.path)),
    functions: after.functions.filter((f) => (functionsBefore.get(functionKey(f)) ?? 0) < RANK[f.limit]),
    duplicates: after.duplicates.filter((d) => !d.keys.some((k) => keysBefore.has(k))),
    cycles: after.cycles.filter((c) => !cyclesBefore.has(cycleKey(c))),
    notMeasured: after.notMeasured.filter((f) => linesBefore.get(f.path) !== f.lines),
    totals: { before: before.totals, after: after.totals },
  };
}
