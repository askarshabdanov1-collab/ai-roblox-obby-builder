import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedG2RuntimeFixtures } from "./g2-runtime-fixture-content.js";

for (const [path, content] of Object.entries(expectedG2RuntimeFixtures())) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
