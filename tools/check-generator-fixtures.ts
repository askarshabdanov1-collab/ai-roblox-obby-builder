import { readFile } from "node:fs/promises";

import { generateObby } from "@obby/obby-generator";

import {
  expectedGeneratorFixtures,
  invalidGeneratorFixtureCodes,
} from "./generator-fixture-content.js";

for (const [path, expected] of Object.entries(expectedGeneratorFixtures())) {
  const actual = await readFile(path, "utf8");
  if (actual !== expected)
    throw new Error(
      `${path} is stale; run npm run generator:fixtures:generate`,
    );
  if (actual.includes(`sha256:${"0".repeat(64)}`))
    throw new Error(`${path} contains ZERO_HASH`);
}
for (const [name, expectedCode] of Object.entries(
  invalidGeneratorFixtureCodes,
)) {
  const request = JSON.parse(
    await readFile(`examples/generator/invalid/${name}.json`, "utf8"),
  ) as unknown;
  try {
    generateObby(request);
    throw new Error(`${name} unexpectedly generated`);
  } catch (error) {
    if (
      error === null ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== expectedCode
    )
      throw new Error(`${name} did not fail with ${expectedCode}`, {
        cause: error,
      });
  }
}

const read = (name: string): Promise<string> =>
  readFile(
    `examples/generator/determinism/${name}/generation-bundle.json`,
    "utf8",
  );
const [sameA, sameB, different, implicit, explicit] = await Promise.all([
  read("same-seed-a"),
  read("same-seed-b"),
  read("different-seed"),
  read("implicit-defaults"),
  read("explicit-defaults"),
]);
if (sameA !== sameB)
  throw new Error("same-seed semantic retries are not byte-identical");
if (implicit !== explicit)
  throw new Error("implicit and explicit defaults are not byte-identical");
if (sameA === different)
  throw new Error(
    "different-seed fixture has no controlled semantic variation",
  );
const sameBundle = JSON.parse(sameA) as {
  normalizedRequest: { excludedMechanics: string[]; assetPolicy: string };
  obbySpec: {
    stages: unknown[];
    route: { orderedNodeIds: string[] };
    obbySpecHash: string;
  };
};
const differentBundle = JSON.parse(different) as typeof sameBundle;
if (
  sameBundle.obbySpec.obbySpecHash === differentBundle.obbySpec.obbySpecHash ||
  sameBundle.obbySpec.stages.length !==
    differentBundle.obbySpec.stages.length ||
  JSON.stringify(sameBundle.obbySpec.route.orderedNodeIds) !==
    JSON.stringify(differentBundle.obbySpec.route.orderedNodeIds) ||
  JSON.stringify(sameBundle.normalizedRequest.excludedMechanics) !==
    JSON.stringify(differentBundle.normalizedRequest.excludedMechanics) ||
  sameBundle.normalizedRequest.assetPolicy !==
    differentBundle.normalizedRequest.assetPolicy
)
  throw new Error("different-seed controlled invariants are not preserved");
console.log(
  "generator fixtures are current, content-addressed, deterministic, typed-negative, and contain no ZERO_HASH",
);
