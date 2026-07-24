import { readFile } from "node:fs/promises";

import {
  expectedContractTypes,
  expectedFixtureArtifacts,
} from "./generated-content.js";

const expected = {
  ...(await expectedContractTypes()),
  ...(await expectedFixtureArtifacts()),
};
let stale = false;

for (const [path, content] of Object.entries(expected)) {
  let current: string | undefined;
  try {
    current = await readFile(path, "utf8");
  } catch {
    // Missing output is reported as stale below.
  }
  if (current !== content) {
    stale = true;
    console.error(`${path} is missing or stale`);
  } else {
    console.log(`${path}: current`);
  }
}

if (stale) {
  console.error(
    "Run `npm run contracts:generate` and `npm run fixtures:generate`, then review the diff.",
  );
  process.exitCode = 1;
}
