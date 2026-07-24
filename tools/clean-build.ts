import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryPrefix = `${repositoryRoot}${sep}`;
const targets = [
  "dist",
  "packages/canonical-json/dist",
  "packages/contracts/dist",
  "packages/obby-compiler/dist",
  "packages/roblox-emitter/dist",
  "apps/orchestrator/dist",
] as const;

for (const relativeTarget of targets) {
  const target = resolve(repositoryRoot, relativeTarget);
  if (!target.startsWith(repositoryPrefix)) {
    throw new Error("Build cleanup path escaped the repository");
  }
  await rm(target, { force: true, recursive: true });
}
