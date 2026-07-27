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
import { generateObby } from "@obby/obby-generator";
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
  seed: 1,
});
if (generated.obbySpec.stages.length !== 5)
  throw new Error("built generator returned an invalid stage plan");
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
