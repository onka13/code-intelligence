/** The shapes of the `health` and `health-compare` results (FR-07, CIN-18). Every limit is an input, never built in. */

export interface HealthLimits {
  /** A file longer than this many lines is over the limit. */
  maxFileLines: number;
  /** A function longer than this many lines is over the soft limit. */
  maxFunctionLines: number;
  /** A function longer than this many lines is over the hard limit. */
  hardFunctionLines: number;
  /** A function whose control-flow blocks nest deeper than this is over the limit. */
  maxNestingDepth: number;
  /** The shortest run of significant lines counted as a duplicated block. */
  minDuplicateLines: number;
}

export const LIMIT_NAMES: Array<keyof HealthLimits> = ['maxFileLines', 'maxFunctionLines', 'hardFunctionLines', 'maxNestingDepth', 'minDuplicateLines'];

export interface FileOverLimit {
  path: string;
  language: string;
  lines: number;
}

export interface FunctionOverLimit {
  path: string;
  /** `Class.method` for a member, the plain name at the top level. */
  name: string;
  kind: string;
  lineStart: number;
  lineEnd: number;
  lines: number;
  limit: 'soft' | 'hard';
}

/** A function whose control-flow blocks nest deeper than `maxNestingDepth`. */
export interface DeepFunction {
  path: string;
  name: string;
  kind: string;
  lineStart: number;
  lineEnd: number;
  nesting: number;
}

export interface DuplicateLocation {
  path: string;
  lineStart: number;
  lineEnd: number;
}

export interface DuplicateBlock {
  /** Hashes of the windows the copies share; a later report's block is new when it shares none of them. */
  keys: string[];
  lines: number;
  locations: DuplicateLocation[];
}

/** A file the report could not measure: no language pack, too large, or a parse error. It is never counted as healthy. */
export interface NotMeasured {
  path: string;
  reason: string;
  lines: number;
}

export interface HealthTotals {
  files: number;
  lines: number;
  filesOverLimit: number;
  functions: number;
  functionsOverSoft: number;
  functionsOverHard: number;
  functionsOverNesting: number;
  /** The deepest nesting of any measured function. */
  deepestNesting: number;
  duplicateBlocks: number;
  duplicatedLines: number;
  cycles: number;
  notMeasured: number;
}

export interface HealthReport {
  generatorVersion: string;
  limits: HealthLimits;
  files: FileOverLimit[];
  functions: FunctionOverLimit[];
  nesting: DeepFunction[];
  duplicates: DuplicateBlock[];
  cycles: string[][];
  notMeasured: NotMeasured[];
  totals: HealthTotals;
}

export interface HealthComparison {
  limits: HealthLimits;
  /** Files over the line limit in `after` that were not over it in `before`. */
  files: FileOverLimit[];
  /** Functions over a limit in `after` that were not over that limit in `before`. */
  functions: FunctionOverLimit[];
  /** Functions over the nesting limit in `after` that were not over it in `before`. */
  nesting: DeepFunction[];
  duplicates: DuplicateBlock[];
  cycles: string[][];
  /** Files in `after` that could not be measured and are new or changed in length. */
  notMeasured: NotMeasured[];
  totals: { before: HealthTotals; after: HealthTotals };
}

/** A limit was not passed, or is not a positive whole number; the message names each one. */
export class HealthLimitsError extends Error {}
