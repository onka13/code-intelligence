/** The library API: the same functions the `codeintel` command runs. */
export { scan, type ScanOptions, type ScanResult } from './scan/scan.js';
export { renderMap, type MapOptions } from './queries/map.js';
export { neighborhood, UnknownFileError, type Neighborhood, type NeighborhoodEntry } from './queries/neighborhood.js';
export { rankHubs as hubs } from './graph/topology.js';
export { readCodeMap, readTopology, OutputMissingError, OutputVersionError } from './outputs.js';
export { PACKS } from '../packs/index.js';
export { health, checkLimits } from './health/health.js';
export { compareHealth } from './health/compare.js';
export { HealthLimitsError } from './health/types.js';
export type * from './health/types.js';
export type { LanguagePack, ParsedFile, ParseInput, RawImport, ResolveInput, Resolution, ProjectView } from './packs/pack.js';
export { ParseError } from './packs/pack.js';
export { GENERATOR_VERSION, SCHEMA_VERSION, OUTPUT_FILES } from './version.js';
export type * from './model.js';
