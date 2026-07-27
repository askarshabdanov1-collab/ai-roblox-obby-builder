import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedGeneratorFixtures } from "./generator-fixture-content.js";

for (const [path, content] of Object.entries(expectedGeneratorFixtures())) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
