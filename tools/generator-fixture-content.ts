import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  generateObby,
} from "@obby/obby-generator";

const requests = {
  "minimal-easy": {
    schemaVersion: "0.1",
    requestId: "fixture-minimal-easy",
    workingName: "Minimal Easy Obby",
    genre: "obby",
    theme: "classic",
    stageCount: 5,
    difficulty: "easy",
    checkpointFrequency: 3,
    assetPolicy: "native-parts-only",
    seed: 1,
  },
  "medium-reference": {
    schemaVersion: "0.1",
    requestId: "fixture-medium",
    workingName: "Sky Route",
    genre: "obby",
    theme: "sky",
    stageCount: 15,
    difficulty: "medium",
    checkpointFrequency: 5,
    visualStylePreferences: ["bright", "high-readability"],
    assetPolicy: "native-parts-only",
    seed: 42,
  },
  "hard-long": {
    schemaVersion: "0.1",
    requestId: "fixture-hard",
    workingName: "Lava Ascent",
    genre: "obby",
    theme: "lava",
    stageCount: 30,
    difficulty: "hard",
    checkpointFrequency: 5,
    accessibilityConstraints: ["color-independent-cues"],
    assetPolicy: "native-parts-only",
    seed: 9001,
  },
  "restricted-mechanics": {
    schemaVersion: "0.1",
    requestId: "fixture-restricted",
    workingName: "Jump Focus",
    genre: "obby",
    theme: "jungle",
    stageCount: 10,
    difficulty: "medium",
    checkpointFrequency: 4,
    supportedMechanicPreferences: ["static-jumps"],
    excludedMechanics: ["moving-platform", "spinner"],
    assetPolicy: "native-parts-only",
    seed: 12,
  },
} as const;

const invalidRequests = {
  "contradictory-request": {
    ...requests["minimal-easy"],
    requestId: "fixture-contradictory",
    supportedMechanicPreferences: ["static-jumps"],
    excludedMechanics: ["static-jumps"],
  },
  "unsupported-genre": {
    ...requests["minimal-easy"],
    requestId: "fixture-unsupported",
    genre: "simulator",
  },
  "deferred-mechanic-request": {
    ...requests["minimal-easy"],
    requestId: "fixture-deferred",
    supportedMechanicPreferences: ["moving-platform"],
  },
} as const;

export const invalidGeneratorFixtureCodes = {
  "contradictory-request": "contradictory-mechanics",
  "unsupported-genre": "schema",
  "deferred-mechanic-request": "deferred-mechanic",
} as const;

const determinismRequests = {
  "same-seed-a": requests["medium-reference"],
  "same-seed-b": {
    ...requests["medium-reference"],
    requestId: "fixture-medium-semantic-retry",
  },
  "different-seed": {
    ...requests["medium-reference"],
    requestId: "fixture-medium-different-seed",
    seed: 43,
  },
  "implicit-defaults": {
    schemaVersion: "0.1",
    requestId: "fixture-implicit-defaults",
    workingName: "Default Obby",
    genre: "obby",
    seed: 5,
  },
  "explicit-defaults": {
    schemaVersion: "0.1",
    requestId: "fixture-explicit-defaults",
    workingName: "Default Obby",
    genre: "obby",
    theme: "classic",
    targetAudience: "general",
    targetSessionDurationMinutes: 12,
    stageCount: 15,
    difficulty: "medium",
    checkpointFrequency: 5,
    supportedMechanicPreferences: [],
    excludedMechanics: [],
    visualStylePreferences: [],
    assetPolicy: "native-parts-only",
    accessibilityConstraints: [],
    seed: 5,
  },
} as const;

const json = (value: unknown): string =>
  `${evaluatorCanonicalStringify(value)}\n`;

export function expectedGeneratorFixtures(): Record<string, string> {
  const artifacts: Record<string, string> = {
    "examples/generator/config/generator-config.json": json(
      DEFAULT_GENERATOR_CONFIGURATION,
    ),
    "examples/generator/config/mechanic-catalog.json": json(
      DEFAULT_MECHANIC_CATALOG,
    ),
  };
  for (const [name, request] of Object.entries(requests)) {
    artifacts[`examples/generator/${name}/request.json`] = json(request);
    artifacts[`examples/generator/${name}/generation-bundle.json`] = json(
      generateObby(request),
    );
  }
  for (const [name, request] of Object.entries(invalidRequests))
    artifacts[`examples/generator/invalid/${name}.json`] = json(request);
  for (const [name, request] of Object.entries(determinismRequests)) {
    const bundle = generateObby(request);
    artifacts[`examples/generator/determinism/${name}/request.json`] =
      json(request);
    artifacts[`examples/generator/determinism/${name}/generation-bundle.json`] =
      json(bundle);
    artifacts[`examples/generator/determinism/${name}/output-name.txt`] =
      `obby-${bundle.obbySpec.obbySpecHash.slice(7)}\n`;
  }
  artifacts["examples/generator/invalid/expected-errors.json"] = json(
    invalidGeneratorFixtureCodes,
  );
  return artifacts;
}
