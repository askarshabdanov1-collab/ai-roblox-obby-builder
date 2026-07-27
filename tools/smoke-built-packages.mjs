import { readFile } from "node:fs/promises";

import { canonicalStringify } from "@obby/canonical-json";
import { validatePlaceSpec, validateSceneManifest } from "@obby/contracts";
import { normalizeGeometryObject } from "@obby/geometry-evaluator";
import { compilePlaceSpec } from "@obby/obby-compiler";
import { parseGeometryObjectInput } from "@obby/obby-evaluator-contracts";
import {
  createDefaultControllerProfile,
  evaluateRoutePlayability,
} from "@obby/route-playability-evaluator";
import { emitManifestModule } from "@obby/roblox-emitter";
import {
  assembleE1Evaluation,
  renderMarkdownReport,
} from "@obby/scoring-engine";
import { runEvaluatorCli } from "@obby/evaluator-cli";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  assertValidGenerationBundle,
  assertValidNormalizedGenerationRequest,
  generateObby,
  hashGeneratorPreimage,
} from "@obby/obby-generator";
import { runGeneratorCli } from "@obby/generator-cli";

const spec = JSON.parse(
  await readFile(
    new URL("../examples/vertical-slice/place-spec.json", import.meta.url),
    "utf8",
  ),
);
if (!validatePlaceSpec(spec).ok)
  throw new Error("built contracts rejected fixture");

const manifest = compilePlaceSpec(spec);
if (!validateSceneManifest(manifest).ok)
  throw new Error("built contracts rejected compiled manifest");
if (!canonicalStringify(manifest).includes('"navigation"'))
  throw new Error("built canonical-json omitted navigation");
if (!emitManifestModule(manifest).startsWith("-- This file is generated"))
  throw new Error("built Roblox emitter returned invalid output");
const geometryInput = {
  schemaVersion: "0.1",
  objectId: "smoke-platform",
  shape: "Block",
  authority: "native-gameplay",
  collision: { canCollide: true, canTouch: true, canQuery: true },
  gameplayOwnership: "native-part",
  promotionStatus: "not-applicable",
  transform: {
    position: { x: 0, y: 1, z: 0 },
    rotationDegrees: { x: 0, y: 0, z: 0 },
  },
  size: { x: 8, y: 2, z: 8 },
};
parseGeometryObjectInput(geometryInput);
if (normalizeGeometryObject(geometryInput).topSurface.maximumY !== 2)
  throw new Error("built geometry evaluator returned invalid bounds");
const routeResult = evaluateRoutePlayability({
  manifest,
  controllerProfile: createDefaultControllerProfile(),
});
if (routeResult.routeGraph.finishObjectId !== "FinishPlatform")
  throw new Error("built route evaluator returned invalid topology");
if (
  typeof assembleE1Evaluation !== "function" ||
  typeof renderMarkdownReport !== "function"
)
  throw new Error("built scoring engine exports are unavailable");
if (typeof runEvaluatorCli !== "function")
  throw new Error("built evaluator CLI library export is unavailable");
const generated = generateObby({
  schemaVersion: "0.1",
  requestId: "built-smoke",
  workingName: "Built Smoke",
  genre: "obby",
  stageCount: 5,
  checkpointFrequency: 3,
  seed: 1,
});
if (generated.obbySpec.stages.length !== 5)
  throw new Error("built generator returned an invalid stage plan");
const expectGeneratorFailure = (label, action) => {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(`built generator accepted ${label}`);
};
expectGeneratorFailure("missing full-validation context", () =>
  assertValidGenerationBundle(generated),
);
const unknownWithoutContext = structuredClone(generated);
unknownWithoutContext.obbySpec.mechanicIntents[0].mechanicId =
  "unknown-mechanic";
expectGeneratorFailure("unknown mechanic without authority context", () =>
  assertValidGenerationBundle(unknownWithoutContext),
);
const invalidNormalized = structuredClone(generated.normalizedRequest);
invalidNormalized.workingName = "";
invalidNormalized.normalizedRequestHash = hashGeneratorPreimage(
  invalidNormalized,
  "normalizedRequestHash",
);
expectGeneratorFailure("fresh-hash invalid normalized semantics", () =>
  assertValidNormalizedGenerationRequest(
    invalidNormalized,
    DEFAULT_MECHANIC_CATALOG,
  ),
);
const graphCases = [
  [
    "unknown mechanic",
    (bundle) => {
      bundle.obbySpec.mechanicIntents[0].mechanicId = "unknown-mechanic";
      bundle.obbySpec.mechanicIntents[0].mechanicIntentHash =
        hashGeneratorPreimage(
          bundle.obbySpec.mechanicIntents[0],
          "mechanicIntentHash",
        );
    },
  ],
  [
    "stage without mechanic",
    (bundle) => {
      bundle.obbySpec.stages[0].mechanicIntentIds = [];
      bundle.obbySpec.stages[0].stageHash = hashGeneratorPreimage(
        bundle.obbySpec.stages[0],
        "stageHash",
      );
    },
  ],
  [
    "checkpoint node without specification",
    (bundle) => {
      bundle.obbySpec.checkpoints = [];
    },
  ],
  [
    "external asset under native policy",
    (bundle) => {
      bundle.obbySpec.assetIntents[0].preferredSourcePolicy =
        "external-assets-allowed-later";
      bundle.obbySpec.assetIntents[0].assetIntentHash = hashGeneratorPreimage(
        bundle.obbySpec.assetIntents[0],
        "assetIntentHash",
      );
    },
  ],
  [
    "incompatible hazard",
    (bundle) => {
      const hazard = bundle.obbySpec.hazards[0];
      if (hazard === undefined) throw new Error("built smoke hazard missing");
      hazard.kind = "moving-obstacle-intent";
      hazard.hazardHash = hashGeneratorPreimage(hazard, "hazardHash");
    },
  ],
];
for (const [label, mutate] of graphCases) {
  const invalid = structuredClone(generated);
  mutate(invalid);
  invalid.obbySpec.obbySpecHash = hashGeneratorPreimage(
    invalid.obbySpec,
    "obbySpecHash",
  );
  invalid.generationBundleHash = hashGeneratorPreimage(
    invalid,
    "generationBundleHash",
  );
  expectGeneratorFailure(label, () =>
    assertValidGenerationBundle(
      invalid,
      DEFAULT_MECHANIC_CATALOG,
      DEFAULT_GENERATOR_CONFIGURATION,
    ),
  );
}
if (typeof runGeneratorCli !== "function")
  throw new Error("built generator CLI library export is unavailable");

const compiledReportModule = await import(
  new URL("../packages/scoring-engine/dist/report.js", import.meta.url)
);
if ("finalizeValidatedE1Report" in compiledReportModule)
  throw new Error("built scoring engine exposes unchecked report finalization");
const compiledReportDeclaration = await readFile(
  new URL("../packages/scoring-engine/dist/report.d.ts", import.meta.url),
  "utf8",
);
if (compiledReportDeclaration.includes("finalizeValidatedE1Report"))
  throw new Error(
    "built scoring declaration exposes unchecked report finalization",
  );

console.log("plain Node imported Phase 0, E1, and G0 packages");
