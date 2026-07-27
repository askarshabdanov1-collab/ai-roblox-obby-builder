import { readFile } from "node:fs/promises";

import { expectedGeneratorFixtures } from "./generator-fixture-content.js";

for (const [path, expected] of Object.entries(expectedGeneratorFixtures())) {
  const actual = await readFile(path, "utf8");
  if (actual !== expected)
    throw new Error(
      `${path} is stale; run npm run generator:fixtures:generate`,
    );
  if (actual.includes(`sha256:${"0".repeat(64)}`))
    throw new Error(`${path} contains ZERO_HASH`);
}
console.log(
  "generator fixtures are current, content-addressed, and contain no ZERO_HASH",
);
