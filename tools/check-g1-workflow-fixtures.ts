import { readFile } from "node:fs/promises";

import { expectedG1WorkflowFixtures } from "./g1-workflow-fixture-content.js";

const expected = expectedG1WorkflowFixtures();
const drift: string[] = [];
for (const [path, content] of Object.entries(expected)) {
  try {
    if ((await readFile(path, "utf8")) !== content) drift.push(path);
  } catch {
    drift.push(path);
  }
}
if (drift.length > 0)
  throw new Error(`G1d workflow fixture drift: ${drift.join(", ")}`);
console.log(
  `G1d workflow fixtures match (${Object.keys(expected).length} files)`,
);
