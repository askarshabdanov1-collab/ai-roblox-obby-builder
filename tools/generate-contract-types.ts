import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedContractTypes } from "./generated-content.js";

for (const [path, content] of Object.entries(await expectedContractTypes())) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
