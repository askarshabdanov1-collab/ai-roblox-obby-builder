import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedG1WorkflowFixtures } from "./g1-workflow-fixture-content.js";

for (const [path, content] of Object.entries(expectedG1WorkflowFixtures())) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
