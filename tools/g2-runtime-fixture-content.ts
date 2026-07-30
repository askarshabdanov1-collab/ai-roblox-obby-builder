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
} from "@obby/obby-layout-engine";
import { G1_ARTIFACT_FILENAMES, buildG1ArtifactSet } from "@obby/generator-cli";

const decoder = new TextDecoder();
const canonicalLine = (value: unknown): string =>
  `${evaluatorCanonicalStringify(value)}\n`;

const request = (
  requestId: string,
  workingName: string,
  stageCount: number,
  checkpointFrequency: number,
  seed: number,
): GenerationRequest => ({
  schemaVersion: "0.1",
  requestId,
  workingName,
  genre: "obby",
  theme: "sky",
  stageCount,
  difficulty: "medium",
  checkpointFrequency,
  assetPolicy: "native-parts-only",
  seed,
});

const FIXTURES = Object.freeze([
  {
    fixtureId: "reference",
    request: request("g1d-representative", "G1d representative", 15, 5, 42),
    jsonPath: "examples/g1-workflow/reference/scene-manifest-v0.3.json",
    modulePath: "roblox/generated/G2ReferenceManifestV03.luau",
    commitJson: false,
  },
  {
    fixtureId: "minimum-zero-checkpoint",
    request: request("g1d-minimum", "G1d minimum", 5, 5, 11),
    jsonPath: "examples/g2-runtime/minimum-zero-checkpoint.json",
    modulePath: "roblox/generated/G2ZeroCheckpointManifestV03.luau",
    commitJson: true,
  },
  {
    fixtureId: "boundary-20",
    request: request("g1d-boundary-20", "G1d boundary-20", 20, 5, 20),
    jsonPath: "examples/g2-runtime/boundary-20.json",
    modulePath: "roblox/generated/G2Boundary20ManifestV03.luau",
    commitJson: true,
  },
  {
    fixtureId: "boundary-21",
    request: request("g1d-boundary-21", "G1d boundary-21", 21, 5, 21),
    jsonPath: "examples/g2-runtime/boundary-21.json",
    modulePath: "roblox/generated/G2Boundary21ManifestV03.luau",
    commitJson: true,
  },
  {
    fixtureId: "maximum-50",
    request: request("g1d-maximum-50", "G1d maximum-50", 50, 5, 50),
    jsonPath: "examples/g2-runtime/maximum-50.json",
    modulePath: "roblox/generated/G2Maximum50ManifestV03.luau",
    commitJson: true,
  },
  {
    fixtureId: "maximum-checkpoints",
    request: request(
      "g2b-maximum-checkpoints",
      "G2b maximum checkpoints",
      50,
      1,
      42,
    ),
    jsonPath: "examples/g2-runtime/maximum-checkpoints.json",
    modulePath: "roblox/generated/G2MaximumCheckpointsManifestV03.luau",
    commitJson: true,
  },
] as const);

export const g2RuntimeFixtureIndexPath =
  "examples/g2-runtime/fixture-index.json";

export function expectedG2RuntimeFixtures(): Readonly<Record<string, string>> {
  const outputs: Record<string, string> = {};
  const index = [];
  for (const fixture of FIXTURES) {
    const source = generateObby(
      fixture.request,
      DEFAULT_GENERATOR_CONFIGURATION,
      DEFAULT_MECHANIC_CATALOG,
    );
    const artifactSet = buildG1ArtifactSet({
      sourceGenerationBundle: source,
      generatorConfiguration: DEFAULT_GENERATOR_CONFIGURATION,
      mechanicCatalog: DEFAULT_MECHANIC_CATALOG,
      layoutConfiguration: DEFAULT_LAYOUT_CONFIGURATION,
      mechanicLayoutDefinitions: DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    });
    const manifest = artifactSet.sceneManifest;
    const json = decoder.decode(
      artifactSet.files[G1_ARTIFACT_FILENAMES.sceneManifest],
    );
    const module = decoder.decode(
      artifactSet.files[G1_ARTIFACT_FILENAMES.robloxModule],
    );
    if (fixture.commitJson) outputs[fixture.jsonPath] = json;
    outputs[fixture.modulePath] = module;
    index.push({
      fixtureId: fixture.fixtureId,
      jsonPath: fixture.jsonPath,
      modulePath: fixture.modulePath,
      generationBundleHash: source.generationBundleHash,
      manifestHash: manifest.manifestHash,
      stageCount: manifest.navigation.stages.length,
      checkpointCount: manifest.navigation.checkpointObjectIds.length,
      gameplayObjectCount: manifest.layers.gameplay.objects.length,
      decorativeObjectCount: manifest.layers.decorative.objects.length,
      zoneCount: manifest.decorativeZones.length,
      routeCount: manifest.navigation.safeRouteObjectIds.length,
      transitionCount:
        manifest.navigation.reachability.requiredTransitions.length,
    });
  }
  outputs[g2RuntimeFixtureIndexPath] = canonicalLine({
    schemaVersion: "0.1",
    owner: "g2-runtime-fixture-content-v1",
    fixtures: index,
  });
  return outputs;
}
