import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedLayoutProjectionFixtures } from "./layout-projection-fixture-content.js";

for (const [path, content] of Object.entries(
  await expectedLayoutProjectionFixtures(),
)) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
