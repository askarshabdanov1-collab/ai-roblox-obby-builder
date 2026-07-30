import { evaluatorCanonicalStringify, sha256 } from "@obby/canonical-json";
import {
  assertValidSceneManifestV03,
  computeSceneManifestV03Hash,
  type SceneManifestV03,
} from "@obby/contracts";
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
import { emitManifestModuleV03 } from "@obby/roblox-emitter";

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

function finalizedDerivedManifest(
  base: SceneManifestV03,
  mutate: (draft: SceneManifestV03) => void,
): SceneManifestV03 {
  const draft = structuredClone(base);
  mutate(draft);
  draft.manifestHash = computeSceneManifestV03Hash(draft);
  return assertValidSceneManifestV03(draft);
}

export function expectedG2RuntimeFixtures(): Readonly<Record<string, string>> {
  const outputs: Record<string, string> = {};
  const index = [];
  let referenceManifest: SceneManifestV03 | undefined;
  let maximum50Manifest: SceneManifestV03 | undefined;
  let referenceGenerationBundleHash: string | undefined;
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
    if (fixture.fixtureId === "reference") {
      referenceManifest = manifest;
      referenceGenerationBundleHash = source.generationBundleHash;
    }
    if (fixture.fixtureId === "maximum-50") maximum50Manifest = manifest;
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

  if (
    referenceManifest === undefined ||
    referenceGenerationBundleHash === undefined ||
    maximum50Manifest === undefined
  )
    throw new Error("G2 reference fixture was not produced");

  const derived = [
    {
      fixtureId: "wedge",
      jsonPath: "examples/g2-runtime/wedge.json",
      modulePath: "roblox/generated/G2WedgeManifestV03.luau",
      manifest: finalizedDerivedManifest(referenceManifest, (draft) => {
        const object = draft.layers.gameplay.objects[1];
        object.shape = "Wedge";
        object.geometry.surfaceKind = "wedge-slope";
        object.geometry.normalizedGeometryHash = sha256({
          domain: "g2c-wedge-geometry-v1",
          objectId: object.id,
          transform: object.transform,
          size: object.size,
        });
        for (const transition of draft.navigation.reachability
          .requiredTransitions) {
          if (transition.fromObjectId === object.id)
            transition.sourceSurfaceKind = "wedge-slope";
          if (transition.toObjectId === object.id)
            transition.destinationSurfaceKind = "wedge-slope";
        }
      }),
    },
    {
      fixtureId: "decorative",
      jsonPath: "examples/g2-runtime/decorative.json",
      modulePath: "roblox/generated/G2DecorativeManifestV03.luau",
      manifest: finalizedDerivedManifest(referenceManifest, (draft) => {
        const zone = draft.decorativeZones[0];
        draft.layers.decorative.objects.push({
          id: "G2DecorativeBlock",
          zoneId: zone.zoneId,
          className: "Part",
          shape: "Block",
          transform: {
            position: { x: 0, y: 7, z: -8 },
            rotation: { x: 0, y: 0, z: 0 },
          },
          size: { x: 2, y: 2, z: 2 },
          collision: {
            anchored: true,
            canCollide: false,
            canTouch: false,
            canQuery: false,
          },
          appearance: {
            color: "#4895EF",
            colorRole: "secondary",
            material: "SmoothPlastic",
          },
        });
      }),
    },
    {
      fixtureId: "replacement-b",
      jsonPath: "examples/g2-runtime/replacement-b.json",
      modulePath: "roblox/generated/G2ReplacementManifestV03.luau",
      manifest: finalizedDerivedManifest(referenceManifest, (draft) => {
        draft.layers.gameplay.objects[1].appearance.color = "#F72585";
      }),
    },
    {
      fixtureId: "maximum-parts",
      jsonPath: "examples/g2-runtime/maximum-parts.json",
      modulePath: "roblox/generated/G2MaximumPartsManifestV03.luau",
      manifest: finalizedDerivedManifest(maximum50Manifest, (draft) => {
        const gameplay = draft.layers.gameplay.objects;
        const finish = gameplay.pop();
        const killTemplate = gameplay.find((object) => object.role === "kill");
        if (finish === undefined || killTemplate === undefined)
          throw new Error("maximum Part fixture templates are unavailable");

        const additionalGameplayCount = 501 - gameplay.length - 1;
        for (let index = 1; index <= additionalGameplayCount; index += 1) {
          const object = structuredClone(killTemplate);
          object.id = `G2MaxHazard${index.toString().padStart(3, "0")}`;
          gameplay.push(object);
        }
        gameplay.push(finish);
        gameplay.forEach((object, index) => {
          object.order = index;
        });

        const zone = draft.decorativeZones[0];
        for (let index = 1; index <= 256; index += 1) {
          draft.layers.decorative.objects.push({
            id: `G2MaxDecorative${index.toString().padStart(3, "0")}`,
            zoneId: zone.zoneId,
            className: "Part",
            shape: "Block",
            transform: {
              position: {
                x: (zone.bounds.minimum.x + zone.bounds.maximum.x) / 2,
                y: (zone.bounds.minimum.y + zone.bounds.maximum.y) / 2,
                z: (zone.bounds.minimum.z + zone.bounds.maximum.z) / 2,
              },
              rotation: { x: 0, y: 0, z: 0 },
            },
            size: { x: 1, y: 1, z: 1 },
            collision: {
              anchored: true,
              canCollide: false,
              canTouch: false,
              canQuery: false,
            },
            appearance: {
              color: "#BDE0FE",
              colorRole: "secondary",
              material: "SmoothPlastic",
            },
          });
        }
      }),
    },
  ] as const;

  for (const fixture of derived) {
    outputs[fixture.jsonPath] = canonicalLine(fixture.manifest);
    outputs[fixture.modulePath] = emitManifestModuleV03(fixture.manifest);
    index.push({
      fixtureId: fixture.fixtureId,
      jsonPath: fixture.jsonPath,
      modulePath: fixture.modulePath,
      generationBundleHash: referenceGenerationBundleHash,
      manifestHash: fixture.manifest.manifestHash,
      stageCount: fixture.manifest.navigation.stages.length,
      checkpointCount: fixture.manifest.navigation.checkpointObjectIds.length,
      gameplayObjectCount: fixture.manifest.layers.gameplay.objects.length,
      decorativeObjectCount: fixture.manifest.layers.decorative.objects.length,
      zoneCount: fixture.manifest.decorativeZones.length,
      routeCount: fixture.manifest.navigation.safeRouteObjectIds.length,
      transitionCount:
        fixture.manifest.navigation.reachability.requiredTransitions.length,
    });
  }
  outputs[g2RuntimeFixtureIndexPath] = canonicalLine({
    schemaVersion: "0.1",
    owner: "g2-runtime-fixture-content-v1",
    fixtures: index,
  });
  return outputs;
}
