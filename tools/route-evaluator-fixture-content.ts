import { readFileSync } from "node:fs";

import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import type { SceneManifest } from "@obby/contracts";
import {
  createDefaultControllerProfile,
  evaluateRoutePlayability,
} from "../packages/route-playability-evaluator/src/index.js";

export const routeEvaluatorFixturePath =
  "packages/route-playability-evaluator/fixtures/generated/vertical-slice-evidence.json";

export function expectedRouteEvaluatorFixture(): string {
  const manifest = JSON.parse(
    readFileSync("examples/vertical-slice/scene-manifest.json", "utf8"),
  ) as SceneManifest;
  const controllerProfile = createDefaultControllerProfile();
  const result = evaluateRoutePlayability({ manifest, controllerProfile });
  const canonical = evaluatorCanonicalStringify({
    schemaVersion: "0.1",
    manifestHash: manifest.manifestHash,
    controllerProfile,
    routeGraph: result.routeGraph,
    transitions: result.transitions,
    transitionStates: result.transitionStates,
    evidence: result.evidence,
    findings: result.findings,
  });
  return `${JSON.stringify(JSON.parse(canonical), null, 2)}\n`;
}
