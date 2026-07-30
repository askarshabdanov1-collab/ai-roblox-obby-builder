import { readFile } from "node:fs/promises";

import { expectedG2RuntimeFixtures } from "./g2-runtime-fixture-content.js";

const expected = expectedG2RuntimeFixtures();
const drift: string[] = [];
for (const [path, content] of Object.entries(expected)) {
  try {
    if ((await readFile(path, "utf8")) !== content) drift.push(path);
  } catch {
    drift.push(path);
  }
}
if (drift.length > 0)
  throw new Error(`G2 runtime fixture drift: ${drift.join(", ")}`);
console.log(
  `G2 runtime fixtures match (${Object.keys(expected).length} files)`,
);
