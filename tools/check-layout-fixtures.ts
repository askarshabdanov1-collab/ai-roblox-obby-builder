import { readFile } from "node:fs/promises";

import type { LayoutBundle } from "@obby/obby-layout-contracts";

import { expectedLayoutFixtures } from "./layout-fixture-content.js";

for (const [path, expected] of Object.entries(expectedLayoutFixtures())) {
  const actual = await readFile(path, "utf8");
  if (actual !== expected)
    throw new Error(`${path} is stale; run npm run layout:fixtures:generate`);
  if (actual.includes(`sha256:${"0".repeat(64)}`))
    throw new Error(`${path} contains ZERO_HASH`);
}

const readBundle = async (name: string): Promise<LayoutBundle> =>
  JSON.parse(
    await readFile(
      `examples/layout/determinism/${name}/layout-bundle.json`,
      "utf8",
    ),
  ) as LayoutBundle;

const [sameA, sameB, different] = await Promise.all([
  readBundle("same-seed-a"),
  readBundle("same-seed-b"),
  readBundle("different-seed"),
]);
if (JSON.stringify(sameA) !== JSON.stringify(sameB))
  throw new Error("same-seed semantic retries are not byte-identical");
if (sameA.layoutBundleHash === different.layoutBundleHash)
  throw new Error("different seed did not change layout identity");
if (
  JSON.stringify(sameA.layoutSpec.route.orderedObjectIds) !==
    JSON.stringify(different.layoutSpec.route.orderedObjectIds) ||
  JSON.stringify(sameA.layoutSpec.stages.map((stage) => stage.ordinal)) !==
    JSON.stringify(different.layoutSpec.stages.map((stage) => stage.ordinal))
)
  throw new Error("different-seed controlled invariants were not preserved");

console.log(
  "layout fixtures are current, content-addressed, deterministic, and contain no ZERO_HASH",
);
