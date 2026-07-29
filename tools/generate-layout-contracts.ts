import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedLayoutContractArtifacts } from "./layout-contract-content.js";

for (const [path, content] of Object.entries(
  await expectedLayoutContractArtifacts(),
)) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
