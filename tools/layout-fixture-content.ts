import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import { generateObby } from "@obby/obby-generator";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  generateLayout,
} from "@obby/obby-layout-engine";

const referenceRequest = {
  schemaVersion: "0.1",
  requestId: "layout-fixture-reference",
  workingName: "Deterministic Native Part Layout",
  genre: "obby",
  theme: "sky",
  stageCount: 15,
  difficulty: "medium",
  checkpointFrequency: 5,
  assetPolicy: "native-parts-only",
  seed: 42,
} as const;

const sameSeedRetry = {
  ...referenceRequest,
  requestId: "layout-fixture-semantic-retry",
};

const differentSeed = {
  ...referenceRequest,
  requestId: "layout-fixture-different-seed",
  seed: 43,
};

const json = (value: unknown): string =>
  `${evaluatorCanonicalStringify(value)}\n`;

export function expectedLayoutFixtures(): Record<string, string> {
  const source = generateObby(referenceRequest);
  const sameRetrySource = generateObby(sameSeedRetry);
  const differentSource = generateObby(differentSeed);
  return {
    "examples/layout/config/layout-configuration.json": json(
      DEFAULT_LAYOUT_CONFIGURATION,
    ),
    "examples/layout/config/mechanic-layout-definitions.json": json(
      DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    ),
    "examples/layout/reference/source-generation-bundle.json": json(source),
    "examples/layout/reference/layout-bundle.json": json(
      generateLayout(source),
    ),
    "examples/layout/determinism/same-seed-a/layout-bundle.json": json(
      generateLayout(source),
    ),
    "examples/layout/determinism/same-seed-b/layout-bundle.json": json(
      generateLayout(sameRetrySource),
    ),
    "examples/layout/determinism/different-seed/layout-bundle.json": json(
      generateLayout(differentSource),
    ),
  };
}
