import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { expectedGeneratorContractArtifacts } from "./generator-contract-content.js";

for (const [path, content] of Object.entries(
  await expectedGeneratorContractArtifacts(),
)) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`generated ${path}`);
}
