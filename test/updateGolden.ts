import fs from 'node:fs';
import path from 'node:path';
import { fixturePaths, goldenOutputs, packFolders } from './golden.js';

/** Rewrites every pack's expected outputs from its fixture project. Review the diff before committing it. */
for (const pack of packFolders()) {
  const { project, expected } = fixturePaths(pack);
  if (!fs.existsSync(project)) continue;
  fs.mkdirSync(expected, { recursive: true });
  for (const [name, content] of Object.entries(await goldenOutputs(pack))) fs.writeFileSync(path.join(expected, name), content);
  console.log(`updated ${path.relative(process.cwd(), expected)}`);
}
