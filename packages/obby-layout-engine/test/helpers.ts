import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  generateObby,
} from "@obby/obby-generator";
import type { LayoutConfiguration } from "@obby/obby-layout-contracts";
import type { GenerationRequest } from "@obby/obby-generator-contracts";

import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  generateLayout,
} from "../src/index.js";

export const BASE_LAYOUT_REQUEST = {
  schemaVersion: "0.1",
  requestId: "g1b-test",
  workingName: "G1b deterministic layout",
  genre: "obby",
  theme: "sky",
  stageCount: 15,
  difficulty: "medium",
  checkpointFrequency: 5,
  assetPolicy: "native-parts-only",
  seed: 42,
} as const;

export function sourceBundle(overrides: Partial<GenerationRequest> = {}) {
  return generateObby({ ...BASE_LAYOUT_REQUEST, ...overrides });
}

export function layoutConfigurationWithBudget(
  maxWorkUnits: number,
): LayoutConfiguration {
  return {
    ...DEFAULT_LAYOUT_CONFIGURATION,
    limits: {
      ...DEFAULT_LAYOUT_CONFIGURATION.limits,
      maxWorkUnits,
    },
  };
}

export function layoutFor(
  source = sourceBundle(),
  configuration: LayoutConfiguration = DEFAULT_LAYOUT_CONFIGURATION,
) {
  return generateLayout(
    source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    configuration,
    DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  );
}

export const canonicalLayout = (value: unknown): string =>
  evaluatorCanonicalStringify(value);
