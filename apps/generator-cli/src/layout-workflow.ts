import {
  compareUnicodeScalars,
  evaluatorCanonicalStringify,
  sha256Bytes,
} from "@obby/canonical-json";
import {
  assertValidPlaceSpecV03,
  assertValidSceneManifestV03,
  type PlaceSpecV03,
  type SceneManifestV03,
} from "@obby/contracts";
import { compilePlaceSpecV03 } from "@obby/obby-compiler";
import type {
  GeneratorConfiguration,
  MechanicCatalog,
} from "@obby/obby-generator";
import type { GenerationBundle } from "@obby/obby-generator-contracts";
import {
  assertValidLayoutBundle,
  type LayoutBundle,
  type LayoutConfiguration,
  type MechanicLayoutDefinition,
} from "@obby/obby-layout-contracts";
import { generateLayout } from "@obby/obby-layout-engine";
import { projectLayoutBundle } from "@obby/obby-layout-projector";
import { emitManifestModuleV03 } from "@obby/roblox-emitter";

export const G1_ARTIFACT_FILENAMES = Object.freeze({
  layoutBundle: "layout-bundle.json",
  placeSpec: "place-spec-v0.3.json",
  sceneManifest: "scene-manifest-v0.3.json",
  robloxModule: "scene-manifest-v0.3.luau",
} as const);

export type G1ArtifactFilename =
  (typeof G1_ARTIFACT_FILENAMES)[keyof typeof G1_ARTIFACT_FILENAMES];

export type G1WorkflowInput = Readonly<{
  sourceGenerationBundle: GenerationBundle;
  generatorConfiguration: GeneratorConfiguration;
  mechanicCatalog: MechanicCatalog;
  layoutConfiguration: LayoutConfiguration;
  mechanicLayoutDefinitions: readonly MechanicLayoutDefinition[];
}>;

export type G1ArtifactSet = Readonly<{
  artifactSetHash: `sha256:${string}`;
  directoryName: string;
  files: Readonly<Record<G1ArtifactFilename, Uint8Array>>;
  totalBytes: number;
  layoutBundle: LayoutBundle;
  placeSpec: PlaceSpecV03;
  sceneManifest: SceneManifestV03;
}>;
export type G1WorkflowOptions = Readonly<{
  maxArtifactSetBytes?: number;
  maxWorldExtent?: number;
}>;

export class G1WorkflowError extends Error {
  public constructor(
    public readonly code:
      "invalid-reference" | "output-limit" | "packing-limit",
    message: string,
  ) {
    super(message);
    this.name = "G1WorkflowError";
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(`${evaluatorCanonicalStringify(value)}\n`);
}

function referencedDefinitions(
  bundle: LayoutBundle,
  definitions: readonly MechanicLayoutDefinition[],
): readonly MechanicLayoutDefinition[] {
  const byHash = new Map(
    definitions.map((definition) => [
      definition.mechanicLayoutDefinitionHash,
      definition,
    ]),
  );
  return bundle.mechanicLayoutDefinitionRefs.map((reference) => {
    const definition = byHash.get(reference.mechanicLayoutDefinitionHash);
    if (definition === undefined)
      throw new G1WorkflowError(
        "invalid-reference",
        "layout authority reference closure is incomplete",
      );
    return definition;
  });
}

function parseCanonicalJson(bytes: Uint8Array): unknown {
  return JSON.parse(decoder.decode(bytes)) as unknown;
}

export function buildG1ArtifactSet(
  input: G1WorkflowInput,
  options: G1WorkflowOptions = {},
): G1ArtifactSet {
  const layoutBundle = generateLayout(
    input.sourceGenerationBundle,
    input.generatorConfiguration,
    input.mechanicCatalog,
    input.layoutConfiguration,
    input.mechanicLayoutDefinitions,
  );
  const definitions = referencedDefinitions(
    layoutBundle,
    input.mechanicLayoutDefinitions,
  );
  assertValidLayoutBundle(
    layoutBundle,
    input.sourceGenerationBundle,
    input.generatorConfiguration,
    input.mechanicCatalog,
    input.layoutConfiguration,
    definitions,
  );
  const admittedWorldExtent =
    options.maxWorldExtent ?? input.layoutConfiguration.limits.maxWorldExtent;
  const bounds = layoutBundle.layoutSpec.worldBounds;
  const coordinates = [
    bounds.minimum.x,
    bounds.minimum.y,
    bounds.minimum.z,
    bounds.maximum.x,
    bounds.maximum.y,
    bounds.maximum.z,
  ];
  if (
    !Number.isFinite(admittedWorldExtent) ||
    admittedWorldExtent < 0 ||
    admittedWorldExtent > input.layoutConfiguration.limits.maxWorldExtent ||
    coordinates.some((coordinate) => Math.abs(coordinate) > admittedWorldExtent)
  )
    throw new G1WorkflowError(
      "packing-limit",
      "layout exceeds the admitted workflow world extent",
    );

  const placeSpec = projectLayoutBundle(
    layoutBundle,
    input.sourceGenerationBundle,
    input.generatorConfiguration,
    input.mechanicCatalog,
    input.layoutConfiguration,
    input.mechanicLayoutDefinitions,
  );
  assertValidPlaceSpecV03(placeSpec);
  const sceneManifest = compilePlaceSpecV03(placeSpec);
  assertValidSceneManifestV03(sceneManifest);

  const files = {
    [G1_ARTIFACT_FILENAMES.layoutBundle]: jsonBytes(layoutBundle),
    [G1_ARTIFACT_FILENAMES.placeSpec]: jsonBytes(placeSpec),
    [G1_ARTIFACT_FILENAMES.sceneManifest]: jsonBytes(sceneManifest),
    [G1_ARTIFACT_FILENAMES.robloxModule]: encoder.encode(
      emitManifestModuleV03(sceneManifest),
    ),
  } satisfies Record<G1ArtifactFilename, Uint8Array>;

  // Re-parse and re-validate exactly the bytes that cross the publication
  // boundary. No filesystem mutation occurs before these checks finish.
  assertValidLayoutBundle(
    parseCanonicalJson(files[G1_ARTIFACT_FILENAMES.layoutBundle]),
    input.sourceGenerationBundle,
    input.generatorConfiguration,
    input.mechanicCatalog,
    input.layoutConfiguration,
    definitions,
  );
  assertValidPlaceSpecV03(
    parseCanonicalJson(files[G1_ARTIFACT_FILENAMES.placeSpec]),
  );
  assertValidSceneManifestV03(
    parseCanonicalJson(files[G1_ARTIFACT_FILENAMES.sceneManifest]),
  );

  const totalBytes = Object.values(files).reduce(
    (total, bytes) => total + bytes.byteLength,
    0,
  );
  const maximumArtifactSetBytes =
    input.layoutConfiguration.limits.maxOutputBytes *
    Object.keys(G1_ARTIFACT_FILENAMES).length;
  const admittedArtifactSetBytes =
    options.maxArtifactSetBytes ?? maximumArtifactSetBytes;
  if (
    !Number.isSafeInteger(totalBytes) ||
    !Number.isSafeInteger(maximumArtifactSetBytes) ||
    !Number.isSafeInteger(admittedArtifactSetBytes) ||
    admittedArtifactSetBytes < 0 ||
    admittedArtifactSetBytes > maximumArtifactSetBytes ||
    totalBytes > admittedArtifactSetBytes
  )
    throw new G1WorkflowError(
      "output-limit",
      "complete G1 artifact set exceeds its output byte budget",
    );

  const artifactSetHash = sha256Bytes(
    encoder.encode(
      evaluatorCanonicalStringify({
        identityDomain: "G1ArtifactSetPublicationPreimage",
        workflowVersion: "g1d-offline-v1",
        artifacts: Object.entries(files)
          .sort(([left], [right]) => compareUnicodeScalars(left, right))
          .map(([filename, bytes]) => ({
            filename,
            contentHash: sha256Bytes(bytes),
          })),
      }),
    ),
  );

  return Object.freeze({
    artifactSetHash,
    directoryName: `g1-${artifactSetHash.slice("sha256:".length)}`,
    files: Object.freeze(files),
    totalBytes,
    layoutBundle,
    placeSpec,
    sceneManifest,
  });
}
