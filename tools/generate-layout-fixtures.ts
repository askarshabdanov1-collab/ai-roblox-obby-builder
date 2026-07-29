import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedLayoutFixtures } from "./layout-fixture-content.js";

for (const [path, content] of Object.entries(expectedLayoutFixtures())) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
