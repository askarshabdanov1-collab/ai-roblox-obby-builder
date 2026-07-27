import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  assertValidGenerationBundle,
  generateObby,
} from "@obby/obby-generator";
import type { GenerationBundle, GenerationRequest } from "@obby/obby-generator";

function independentHash(value: object, field: string): `sha256:${string}` {
  const payload = structuredClone(value) as Record<string, unknown>;
  Reflect.deleteProperty(payload, field);
  const preimage = {
    canonicalizationAlgorithm: "obby-canonical-json-v1",
    identityDomain: field,
    payload,
  };
  return `sha256:${createHash("sha256")
    .update(evaluatorCanonicalStringify(preimage), "utf8")
    .digest("hex")}`;
}

const fixture = JSON.parse(
  await readFile(
    "examples/generator/medium-reference/generation-bundle.json",
    "utf8",
  ),
) as GenerationBundle;
if (
  independentHash(fixture.normalizedRequest, "normalizedRequestHash") !==
  fixture.normalizedRequest.normalizedRequestHash
)
  throw new Error("independent normalized-request hash mismatch");
if (
  independentHash(fixture.obbySpec, "obbySpecHash") !==
  fixture.obbySpec.obbySpecHash
)
  throw new Error("independent ObbySpec hash mismatch");

const request = JSON.parse(
  await readFile("examples/generator/medium-reference/request.json", "utf8"),
) as GenerationRequest;
const first = generateObby(request);
const second = generateObby(request);
if (evaluatorCanonicalStringify(first) !== evaluatorCanonicalStringify(second))
  throw new Error("same-seed canonical bytes differ");
const semanticRetry = generateObby({
  ...request,
  requestId: "semantic-retry-with-new-record-id",
});
if (
  evaluatorCanonicalStringify(first) !==
  evaluatorCanonicalStringify(semanticRetry)
)
  throw new Error("request record identity changed semantic output bytes");

const shuffled = generateObby({
  ...request,
  visualStylePreferences: [...(request.visualStylePreferences ?? [])].reverse(),
  excludedMechanics: ["spinner", "moving-platform"],
});
const ordered = generateObby({
  ...request,
  excludedMechanics: ["moving-platform", "spinner"],
});
if (
  evaluatorCanonicalStringify(shuffled) !== evaluatorCanonicalStringify(ordered)
)
  throw new Error("semantic-set ordering changed output bytes");

const varied = generateObby({ ...request, seed: request.seed + 1 });
assertValidGenerationBundle(
  varied,
  DEFAULT_MECHANIC_CATALOG,
  DEFAULT_GENERATOR_CONFIGURATION,
);
if (
  varied.obbySpec.obbySpecHash === first.obbySpec.obbySpecHash ||
  varied.obbySpec.game.title !== first.obbySpec.game.title ||
  varied.obbySpec.stages.length !== first.obbySpec.stages.length
)
  throw new Error("different-seed controlled-variation probe failed");

console.log(
  "independent hashes, semantic retries, same-seed bytes, shuffled sets, and controlled seed variation passed",
);
