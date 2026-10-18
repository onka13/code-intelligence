import fs from 'node:fs';

/** Version 1 of the output schemas (`schema/`); a breaking change is a new major version of the library and of this. */
export const SCHEMA_VERSION = 1;

/** The library's own version, from its package.json (two levels above `dist/src`). */
export const GENERATOR_VERSION: string = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

export const OUTPUT_FILES = {
  codeMap: 'ast_code_map.json',
  topology: 'graphify_topology.json',
  topologyText: 'TopologyFULL.txt',
  structure: 'project_structure.md',
} as const;
