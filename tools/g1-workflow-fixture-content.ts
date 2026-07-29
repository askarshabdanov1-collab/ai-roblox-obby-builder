import { evaluatorCanonicalStringify, sha256Bytes } from "@obby/canonical-json";
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

const request = (
  fixtureId: string,
  stageCount: number,
  seed: number,
  checkpointFrequency: number,
): GenerationRequest => ({
  schemaVersion: "0.1",
  requestId: `g1d-${fixtureId}`,
  workingName: `G1d ${fixtureId}`,
  genre: "obby",
  theme: "sky",
  stageCount,
  difficulty: "medium",
  checkpointFrequency,
  assetPolicy: "native-parts-only",
  seed,
});

const POSITIVE_REQUESTS = Object.freeze([
  ["minimum-zero-checkpoint", request("minimum", 5, 11, 5)],
  ["representative", request("representative", 15, 42, 5)],
  ["boundary-20", request("boundary-20", 20, 20, 5)],
  ["boundary-21", request("boundary-21", 21, 21, 5)],
  ["maximum-50", request("maximum-50", 50, 50, 5)],
  ["different-seed", request("different-seed", 15, 43, 5)],
] as const);

const NEGATIVE_CASES = Object.freeze([
  ["stale-g0-authority", "stale-authority", "layout engine"],
  ["stale-g1-authority", "stale-authority", "layout contracts/projector"],
  ["unsupported-mechanic", "unsupported-mechanic", "layout engine"],
  ["deferred-mechanic", "deferred-mechanic", "layout engine"],
  ["invalid-reference", "invalid-reference", "layout contracts/projector"],
  ["work-budget-overflow", "maximum-work-units", "layout engine"],
  ["output-byte-overflow", "output-limit", "layout engine/projector"],
  ["packing-exhaustion", "packing-limit", "layout engine"],
  ["infeasible-reachability", "reachability-infeasible", "projector"],
  ["indeterminate-reachability", "reachability-indeterminate", "projector"],
  ["existing-file", "output-conflict", "shared CLI publication"],
  ["existing-directory", "output-conflict", "shared CLI publication"],
  ["existing-symlink", "path-safety", "shared CLI publication"],
  ["existing-junction-or-reparse", "path-safety", "shared CLI publication"],
  ["concurrent-identical-publication", "output-conflict", "G1d CLI"],
  ["unsupported-publication-primitive", "output-publication", "G1d CLI"],
  ["cleanup-failure", "cleanup-failed", "G1d CLI"],
] as const);

export const g1WorkflowFixturePaths = Object.freeze({
  positiveIndex: "examples/g1-workflow/positive-fixtures.json",
  negativeIndex: "examples/g1-workflow/negative-fixtures.json",
  authoritySet: "examples/g1-workflow/reference/authority-set.json",
  request: "examples/g1-workflow/reference/request.json",
  source: "examples/g1-workflow/reference/generation-bundle.json",
  layoutBundle: "examples/g1-workflow/reference/layout-bundle.json",
  placeSpec: "examples/g1-workflow/reference/place-spec-v0.3.json",
  sceneManifest: "examples/g1-workflow/reference/scene-manifest-v0.3.json",
  robloxModule: "examples/g1-workflow/reference/scene-manifest-v0.3.luau",
});

const canonicalLine = (value: unknown): string =>
  `${evaluatorCanonicalStringify(value)}\n`;

export function expectedG1WorkflowFixtures(): Readonly<Record<string, string>> {
  const positives = POSITIVE_REQUESTS.map(([fixtureId, generationRequest]) => {
    const source = generateObby(
      generationRequest,
      DEFAULT_GENERATOR_CONFIGURATION,
      DEFAULT_MECHANIC_CATALOG,
    );
    const result = buildG1ArtifactSet({
      sourceGenerationBundle: source,
      generatorConfiguration: DEFAULT_GENERATOR_CONFIGURATION,
      mechanicCatalog: DEFAULT_MECHANIC_CATALOG,
      layoutConfiguration: DEFAULT_LAYOUT_CONFIGURATION,
      mechanicLayoutDefinitions: DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    });
    return {
      fixtureId,
      request: generationRequest,
      generationBundleHash: source.generationBundleHash,
      obbySpecHash: source.obbySpec.obbySpecHash,
      layoutBundleHash: result.layoutBundle.layoutBundleHash,
      placeSpecHash: result.placeSpec.placeSpecHash,
      manifestHash: result.sceneManifest.manifestHash,
      artifactSetHash: result.artifactSetHash,
      directoryName: result.directoryName,
      stageCount: result.layoutBundle.layoutSpec.stages.length,
      checkpointCount:
        result.placeSpec.checkpointPlan.checkpointObjectIds.length,
      totalBytes: result.totalBytes,
      artifacts: Object.entries(result.files)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([filename, bytes]) => ({
          filename,
          contentHash: sha256Bytes(bytes),
          bytes: bytes.byteLength,
        })),
      source,
      result,
    };
  });
  const representative = positives.find(
    (fixture) => fixture.fixtureId === "representative",
  );
  if (representative === undefined)
    throw new Error("representative G1d fixture is missing");

  const publicPositiveIndex = positives.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    request: fixture.request,
    generationBundleHash: fixture.generationBundleHash,
    obbySpecHash: fixture.obbySpecHash,
    layoutBundleHash: fixture.layoutBundleHash,
    placeSpecHash: fixture.placeSpecHash,
    manifestHash: fixture.manifestHash,
    artifactSetHash: fixture.artifactSetHash,
    directoryName: fixture.directoryName,
    stageCount: fixture.stageCount,
    checkpointCount: fixture.checkpointCount,
    totalBytes: fixture.totalBytes,
    artifacts: fixture.artifacts,
  }));
  const referenceFiles = representative.result.files;
  return {
    [g1WorkflowFixturePaths.positiveIndex]: canonicalLine({
      schemaVersion: "0.1",
      workflowVersion: "g1d-offline-v1",
      fixtures: publicPositiveIndex,
    }),
    [g1WorkflowFixturePaths.negativeIndex]: canonicalLine({
      schemaVersion: "0.1",
      cases: NEGATIVE_CASES.map(([fixtureId, expectedCode, testOwner]) => ({
        fixtureId,
        expectedCode,
        testOwner,
      })),
    }),
    [g1WorkflowFixturePaths.authoritySet]: canonicalLine({
      schemaVersion: "0.1",
      generatorConfiguration: {
        configurationId: DEFAULT_GENERATOR_CONFIGURATION.configurationId,
        configurationHash: DEFAULT_GENERATOR_CONFIGURATION.configurationHash,
      },
      mechanicCatalog: {
        catalogId: DEFAULT_MECHANIC_CATALOG.catalogId,
        catalogHash: DEFAULT_MECHANIC_CATALOG.catalogHash,
      },
      layoutConfiguration: {
        configurationId: DEFAULT_LAYOUT_CONFIGURATION.configurationId,
        configurationHash: DEFAULT_LAYOUT_CONFIGURATION.configurationHash,
      },
      mechanicLayoutDefinitions: DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.map(
        (definition) => ({
          mechanicLayoutDefinitionId: definition.mechanicLayoutDefinitionId,
          mechanicLayoutDefinitionHash: definition.mechanicLayoutDefinitionHash,
        }),
      ),
    }),
    [g1WorkflowFixturePaths.request]: canonicalLine(representative.request),
    [g1WorkflowFixturePaths.source]: canonicalLine(representative.source),
    [g1WorkflowFixturePaths.layoutBundle]: decoder.decode(
      referenceFiles[G1_ARTIFACT_FILENAMES.layoutBundle],
    ),
    [g1WorkflowFixturePaths.placeSpec]: decoder.decode(
      referenceFiles[G1_ARTIFACT_FILENAMES.placeSpec],
    ),
    [g1WorkflowFixturePaths.sceneManifest]: decoder.decode(
      referenceFiles[G1_ARTIFACT_FILENAMES.sceneManifest],
    ),
    [g1WorkflowFixturePaths.robloxModule]: decoder.decode(
      referenceFiles[G1_ARTIFACT_FILENAMES.robloxModule],
    ),
  };
}
