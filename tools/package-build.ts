import { cp, mkdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const outputs = [
  ["dist/packages/canonical-json/src", "packages/canonical-json/dist"],
  ["dist/packages/contracts/src", "packages/contracts/dist"],
  ["dist/packages/geometry-evaluator/src", "packages/geometry-evaluator/dist"],
  ["dist/packages/obby-compiler/src", "packages/obby-compiler/dist"],
  [
    "dist/packages/obby-evaluator-contracts/src",
    "packages/obby-evaluator-contracts/dist",
  ],
  [
    "dist/packages/obby-generator-contracts/src",
    "packages/obby-generator-contracts/dist",
  ],
  ["dist/packages/obby-generator/src", "packages/obby-generator/dist"],
  [
    "dist/packages/obby-layout-contracts/src",
    "packages/obby-layout-contracts/dist",
  ],
  ["dist/packages/obby-layout-engine/src", "packages/obby-layout-engine/dist"],
  ["dist/packages/roblox-emitter/src", "packages/roblox-emitter/dist"],
  [
    "dist/packages/route-playability-evaluator/src",
    "packages/route-playability-evaluator/dist",
  ],
  ["dist/packages/scoring-engine/src", "packages/scoring-engine/dist"],
  ["dist/apps/evaluator-cli/src", "apps/evaluator-cli/dist"],
  ["dist/apps/generator-cli/src", "apps/generator-cli/dist"],
  ["dist/apps/orchestrator/src", "apps/orchestrator/dist"],
] as const;

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryPrefix = `${repositoryRoot}${sep}`;

for (const [relativeSource, relativeDestination] of outputs) {
  const source = resolve(repositoryRoot, relativeSource);
  const destination = resolve(repositoryRoot, relativeDestination);
  if (
    !source.startsWith(repositoryPrefix) ||
    !destination.startsWith(repositoryPrefix)
  ) {
    throw new Error("Package output path escaped the repository");
  }
  await rm(destination, { force: true, recursive: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
}
