import { readFile } from "node:fs/promises";

import { expectedLayoutProjectionFixtures } from "./layout-projection-fixture-content.js";

let failed = false;
for (const [path, expected] of Object.entries(
  await expectedLayoutProjectionFixtures(),
)) {
  let actual: string;
  try {
    actual = await readFile(path, "utf8");
  } catch {
    actual = "";
  }
  if (actual !== expected) {
    failed = true;
    console.error(`${path}: stale or missing`);
  } else {
    console.log(`${path}: current`);
  }
}
if (failed) process.exitCode = 1;
