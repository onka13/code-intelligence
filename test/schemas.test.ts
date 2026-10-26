import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { test } from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { PACKS } from '../packs/index.js';
import { scan } from '../src/scan/scan.js';
import { SCHEMA_VERSION } from '../src/version.js';
import { packFolders, fixturePaths } from './golden.js';
import { read, readJson, REPO, tempDir } from './helpers.js';

const SCHEMAS = ['ast_code_map.schema.json', 'topology.schema.json'];
const schemaFile = (name: string) => path.join(REPO, 'schema', name);

test('CIN-06: every JSON output carries its versions and follows the published schema', async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = SCHEMAS.map((s) => ajv.compile(readJson(schemaFile(s))));
  for (const pack of packFolders()) {
    const { map, topology } = await scan({ root: fixturePaths(pack).project, out: path.join(tempDir(), 'out'), packs: PACKS });
    for (const [i, doc] of [map, topology].entries()) {
      assert.equal(doc.schemaVersion, SCHEMA_VERSION);
      assert.match(doc.generatorVersion, /^\d+\.\d+\.\d+/);
      assert.ok(validate[i](doc), `${pack} ${SCHEMAS[i]}: ${JSON.stringify(validate[i].errors?.slice(0, 3))}`);
    }
  }
});

test('CIN-06: a schema changes only with a new schema version or a reviewed lock update', () => {
  const lock = readJson<{ schemaVersion: number; sha256: Record<string, string> }>(schemaFile('schema-lock.json'));
  const changed = SCHEMAS.filter((s) => crypto.createHash('sha256').update(read(schemaFile(s))).digest('hex') !== lock.sha256[s]);
  if (SCHEMA_VERSION !== lock.schemaVersion) return;
  assert.deepEqual(changed, [], 'A schema changed but the schema version did not. A breaking change needs a new schema version and a new major release; a change that only adds an optional field updates schema/schema-lock.json in the same pull request.');
});
