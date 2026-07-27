import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedE1cFixtures } from "./e1c-fixture-content.js";

for (const [path, content] of Object.entries(await expectedE1cFixtures())) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
