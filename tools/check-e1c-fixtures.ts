import { readFile } from "node:fs/promises";

import { expectedE1cFixtures } from "./e1c-fixture-content.js";

for (const [path, expected] of Object.entries(await expectedE1cFixtures())) {
  const actual = await readFile(path, "utf8").catch(() => "");
  if (actual !== expected) {
    throw new Error(
      `${path} is stale; run npm run evaluator:fixtures:generate`,
    );
  }
}
console.log("E1c end-to-end fixtures are deterministic and current");
