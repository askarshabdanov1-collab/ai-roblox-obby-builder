import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  generateObby,
} from "@obby/obby-generator";
import type { GenerationRequest } from "@obby/obby-generator-contracts";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  generateLayout,
} from "@obby/obby-layout-engine";

import { projectLayoutBundle } from "../src/index.js";

const REQUEST = {
  schemaVersion: "0.1",
  requestId: "g1c-test",
  workingName: "G1c deterministic projection",
  genre: "obby",
  theme: "sky",
  stageCount: 15,
  difficulty: "medium",
  checkpointFrequency: 5,
  assetPolicy: "native-parts-only",
  seed: 42,
} as const;

export function projectionFor(overrides: Partial<GenerationRequest> = {}) {
  const source = generateObby({ ...REQUEST, ...overrides });
  const layout = generateLayout(
    source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    DEFAULT_LAYOUT_CONFIGURATION,
    DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  );
  return {
    source,
    layout,
    placeSpec: projectLayoutBundle(
      layout,
      source,
      DEFAULT_GENERATOR_CONFIGURATION,
      DEFAULT_MECHANIC_CATALOG,
      DEFAULT_LAYOUT_CONFIGURATION,
      DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    ),
  };
}

export const canonical = (value: unknown): string =>
  evaluatorCanonicalStringify(value);
