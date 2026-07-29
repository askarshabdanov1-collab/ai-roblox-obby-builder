import { readFile } from "node:fs/promises";

import {
  evaluatorCanonicalize,
  evaluatorCanonicalStringify,
  sha256Bytes,
} from "@obby/canonical-json";
import { compilePlaceSpec } from "@obby/obby-compiler";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  generateObby,
} from "@obby/obby-generator";
import { createDefaultControllerProfile } from "@obby/route-playability-evaluator";
import { describe, expect, it } from "vitest";

import {
  LAYOUT_CONTRACT_SCHEMA_HASH,
  LayoutContractError,
  assertValidLayoutBundle,
  hashLayoutBundle,
  hashLayoutConfiguration,
  hashLayoutSpec,
  hashMechanicLayoutDefinition,
} from "../src/index.js";

const HASH_A = `sha256:${"a".repeat(64)}` as const;

function layoutConfiguration(): Record<string, unknown> {
  const profile = createDefaultControllerProfile();
  const preimage = {
    schemaVersion: "0.1",
    configurationId: "g1a-layout-reference",
    configurationVersion: "g1a-layout-contract-v1",
    layoutAlgorithm: {
      algorithmId: "g1-layout-v1",
      routePackingStrategy: "bounded-serpentine-grid-v1",
      routePackingVersion: "1",
      derivedIdStrategy: "source-ordinal-pascal-v1",
    },
    numericParameters: [
      ["character-root-offset", "studs", 1, 8, 3],
      ["fall-void-depth", "studs", 4, 128, 24],
      ["fall-void-margin", "studs", 1, 64, 8],
      ["packing-cell-depth", "studs", 16, 128, 48],
      ["packing-cell-width", "studs", 16, 128, 48],
      ["packing-columns", "count", 1, 16, 8],
    ].map(([parameterId, unit, minimum, maximum, value]) => ({
      parameterId,
      unit,
      minimum,
      maximum,
      value,
    })),
    numericPolicy: {
      units: "studs",
      coordinatePrecisionDecimalPlaces: 6,
      measurementToleranceStuds: 1e-9,
    },
    reachabilityPolicy: {
      requiredTransitionOutcome: "feasible-under-model",
      indeterminatePolicy: "block",
      controllerProfileRef: {
        profileId: profile.profileId,
        profileVersion: profile.profileVersion,
        controllerProfileHash: profile.controllerProfileHash,
      },
    },
    limits: {
      maxStages: 50,
      maxGameplayObjects: 501,
      maxDecorativeZones: 128,
      maxWorldExtent: 2048,
      maxPartSize: 256,
      maxOutputBytes: 4_194_304,
      maxWorkUnits: 100_000,
    },
  };
  return {
    ...preimage,
    configurationHash: hashLayoutConfiguration(preimage).hash,
  };
}

function mechanicDefinition(
  mechanic: (typeof DEFAULT_MECHANIC_CATALOG.mechanics)[number],
): Record<string, unknown> {
  const preimage = {
    schemaVersion: "0.1",
    mechanicLayoutDefinitionId: `layout-${mechanic.mechanicId}-v1`,
    definitionVersion: "1.0.0",
    sourceMechanic: {
      mechanicId: mechanic.mechanicId,
      mechanicVersion: mechanic.mechanicVersion,
      mechanicDefinitionHash: mechanic.mechanicDefinitionHash,
    },
    capability: "g1-static-supported",
    layoutAlgorithmId: "g1-layout-v1",
    routeObjectBudget: { minimum: 1, maximum: 20 },
    supportedShapes: ["Block"],
    difficultyProfiles: [
      {
        difficultyLevel: 1,
        parameters: [
          {
            parameterId: "contract-test-spacing",
            unit: "studs",
            minimum: 1,
            maximum: 10,
            value: 6,
          },
        ],
      },
    ],
  };
  return {
    ...preimage,
    mechanicLayoutDefinitionHash: hashMechanicLayoutDefinition(preimage).hash,
  };
}

function makeLayoutBundle(
  stageCount: number,
  checkpointFrequency: number,
): {
  source: ReturnType<typeof generateObby>;
  configuration: Record<string, unknown>;
  definitions: Record<string, unknown>[];
  bundle: Record<string, unknown>;
} {
  const source = generateObby({
    schemaVersion: "0.1",
    requestId: `g1a-${stageCount}-${checkpointFrequency}`,
    workingName: "G1a Contract Fixture",
    genre: "obby",
    stageCount,
    checkpointFrequency,
    difficulty: "easy",
    seed: 41,
  });
  const configuration = layoutConfiguration();
  const definitionByMechanic = new Map(
    DEFAULT_MECHANIC_CATALOG.mechanics
      .filter((mechanic) => mechanic.capability === "g1-static-supported")
      .map((mechanic) => [mechanic.mechanicId, mechanicDefinition(mechanic)]),
  );
  const intentById = new Map(
    source.obbySpec.mechanicIntents.map((intent) => [
      intent.mechanicIntentId,
      intent,
    ]),
  );
  const checkpointByStage = new Map(
    source.obbySpec.checkpoints.map((checkpoint) => [
      checkpoint.stageId,
      checkpoint,
    ]),
  );
  const checkpointOrdinalById = new Map(
    source.obbySpec.checkpoints.map((checkpoint, index) => [
      checkpoint.checkpointId,
      index + 1,
    ]),
  );
  const routeNodeByStage = new Map(
    source.obbySpec.route.nodes.flatMap((node) =>
      node.stageId === undefined ? [] : [[node.stageId, node] as const],
    ),
  );
  const objects: Record<string, unknown>[] = [
    {
      objectId: "Spawn",
      sourceReferences: {
        sourceAssetIntentIds: [],
      },
      role: "spawn",
      authority: "native-gameplay",
      shape: "Block",
      transform: {
        position: { x: 0, y: 1, z: 0 },
        rotationDegrees: { x: 0, y: 0, z: 0 },
      },
      size: { x: 12, y: 2, z: 12 },
      collision: {
        anchored: true,
        canCollide: true,
        canTouch: false,
        canQuery: true,
      },
    },
  ];
  const stages = source.obbySpec.stages.map((stage) => {
    const intent = intentById.get(stage.mechanicIntentIds[0]);
    if (intent === undefined) throw new Error("missing mechanic intent");
    const definition = definitionByMechanic.get(intent.mechanicId);
    if (definition === undefined) throw new Error("missing layout definition");
    const checkpoint = checkpointByStage.get(stage.stageId);
    const objectId =
      checkpoint === undefined
        ? `Stage${String(stage.ordinal).padStart(2, "0")}Route001`
        : `Checkpoint${String(checkpointOrdinalById.get(checkpoint.checkpointId)).padStart(3, "0")}`;
    objects.push({
      objectId,
      sourceReferences: {
        sourceStageId: stage.stageId,
        sourceMechanicIntentId: intent.mechanicIntentId,
        ...(checkpoint === undefined
          ? {}
          : { sourceCheckpointId: checkpoint.checkpointId }),
        sourceAssetIntentIds: stage.assetIntentIds,
      },
      role: checkpoint === undefined ? "platform" : "checkpoint",
      authority: "native-gameplay",
      shape: "Block",
      transform: {
        position: { x: 0, y: 1, z: stage.ordinal * 8 },
        rotationDegrees: { x: 0, y: 0, z: 0 },
      },
      size: { x: 8, y: 2, z: 8 },
      collision: {
        anchored: true,
        canCollide: true,
        canTouch: checkpoint !== undefined,
        canQuery: true,
      },
      routePlacement: {
        globalOrder: stage.ordinal,
        stageOrder: 1,
      },
    });
    const node = routeNodeByStage.get(stage.stageId);
    if (node === undefined) throw new Error("missing route node");
    return {
      stageLayoutId: `layout-stage-${String(stage.ordinal).padStart(2, "0")}`,
      sourceStageId: stage.stageId,
      sourceRouteNodeId: node.routeNodeId,
      ordinal: stage.ordinal,
      sourceMechanicIntentId: intent.mechanicIntentId,
      mechanicLayoutDefinitionHash: definition.mechanicLayoutDefinitionHash,
      routeObjectIds: [objectId],
      ...(checkpoint === undefined ? {} : { checkpointObjectId: objectId }),
      hazardObjectIds: [],
      decorativeZoneIds: [],
    };
  });
  const finishOrder = stageCount + 1;
  objects.push({
    objectId: "Finish",
    sourceReferences: {
      sourceStageId: source.obbySpec.finish.afterStageId,
      sourceFinishId: source.obbySpec.finish.finishId,
      sourceAssetIntentIds: [],
    },
    role: "finish",
    authority: "native-gameplay",
    shape: "Block",
    transform: {
      position: { x: 0, y: 1, z: finishOrder * 8 },
      rotationDegrees: { x: 0, y: 0, z: 0 },
    },
    size: { x: 12, y: 2, z: 12 },
    collision: {
      anchored: true,
      canCollide: true,
      canTouch: true,
      canQuery: true,
    },
    routePlacement: { globalOrder: finishOrder, stageOrder: 1 },
  });
  for (const hazard of source.obbySpec.hazards) {
    const ordinal =
      source.obbySpec.stages.find((stage) => stage.stageId === hazard.stageId)
        ?.ordinal ?? 0;
    const objectId = `Stage${String(ordinal).padStart(2, "0")}Hazard001`;
    objects.push({
      objectId,
      sourceReferences: {
        sourceStageId: hazard.stageId,
        sourceHazardId: hazard.hazardId,
        sourceAssetIntentIds: [],
      },
      role: "kill",
      authority: "native-gameplay",
      shape: "Block",
      transform: {
        position: { x: 0, y: -4, z: ordinal * 8 },
        rotationDegrees: { x: 0, y: 0, z: 0 },
      },
      size: { x: 12, y: 1, z: 12 },
      collision: {
        anchored: true,
        canCollide: true,
        canTouch: true,
        canQuery: true,
      },
    });
    const layoutStage = stages[ordinal - 1];
    if (layoutStage === undefined) throw new Error("missing layout stage");
    (layoutStage.hazardObjectIds as string[]).push(objectId);
  }
  const definitions = [...definitionByMechanic.values()].filter((definition) =>
    stages.some(
      (stage) =>
        stage.mechanicLayoutDefinitionHash ===
        definition.mechanicLayoutDefinitionHash,
    ),
  );
  const orderedObjectIds = [
    ...stages.flatMap((stage) => stage.routeObjectIds),
    "Finish",
  ];
  const profile = createDefaultControllerProfile();
  const specPreimage = {
    schemaVersion: "0.1",
    layoutSpecId: `layout-spec-${source.obbySpec.obbySpecHash.slice(7, 23)}`,
    layoutVersion: "g1-layout-v1",
    source: {
      generationBundleHash: source.generationBundleHash,
      obbySpecId: source.obbySpec.obbySpecId,
      obbySpecHash: source.obbySpec.obbySpecHash,
      generatorConfigurationHash: source.configurationHash,
      mechanicCatalogHash: source.catalogHash,
    },
    layoutConfigurationHash: configuration.configurationHash,
    mechanicLayoutDefinitionHashes: definitions.map(
      (definition) => definition.mechanicLayoutDefinitionHash,
    ),
    layoutSeedIdentity: source.obbySpec.seedIdentity,
    coordinateSystem: {
      units: "studs",
      handedness: "right-handed",
      upAxis: "+Y",
      forwardAxis: "-Z",
      rotationUnit: "degrees",
      rotationOrder: "XYZ",
    },
    characterPlacement: {
      strategy: "humanoid-root-part-cframe-v1",
      orientationPolicy: "face-next-safe-route-object",
      verticalOffset: 3,
    },
    worldBounds: {
      minimum: { x: -16, y: -8, z: -16 },
      maximum: { x: 16, y: 16, z: finishOrder * 8 + 16 },
    },
    stages,
    route: {
      routeLayoutId: `layout-route-${source.obbySpec.route.routeHash.slice(7, 23)}`,
      sourceRouteId: source.obbySpec.route.routeId,
      orderedObjectIds,
    },
    reachability: {
      modelId: "e1-coarse-surface-transition-v1",
      methodId: "coarse-transition-classifier",
      methodVersion: "2.0.0",
      controllerProfileRef: {
        profileId: profile.profileId,
        profileVersion: profile.profileVersion,
        controllerProfileHash: profile.controllerProfileHash,
      },
      overallOutcome: "feasible-under-model",
      requiredTransitions: orderedObjectIds.map((toObjectId, index) => {
        const fromObjectId =
          index === 0 ? "Spawn" : orderedObjectIds[index - 1];
        if (fromObjectId === undefined) throw new Error("missing route source");
        return {
          transitionLayoutId: `layout-transition-${String(index + 1).padStart(3, "0")}`,
          fromObjectId,
          toObjectId,
          fromGlobalOrder: index,
          toGlobalOrder: index + 1,
          outcome: "feasible-under-model",
          normalizedInputHash: sha256Bytes(
            evaluatorCanonicalize({ fromObjectId, toObjectId }).canonicalBytes,
          ),
        };
      }),
    },
    objects,
    decorativeZones: [],
    limitations: [],
    findings: [],
  };
  const layoutSpec = {
    ...specPreimage,
    layoutSpecHash: hashLayoutSpec(specPreimage).hash,
  };
  const bundlePreimage = {
    schemaVersion: "0.1",
    layoutBundleId: `layout-bundle-${source.generationBundleHash.slice(7, 23)}`,
    sourceGenerationBundleHash: source.generationBundleHash,
    layoutConfigurationRef: {
      configurationId: configuration.configurationId,
      configurationVersion: configuration.configurationVersion,
      configurationHash: configuration.configurationHash,
    },
    mechanicLayoutDefinitionRefs: definitions.map((definition) => ({
      mechanicLayoutDefinitionId: definition.mechanicLayoutDefinitionId,
      definitionVersion: definition.definitionVersion,
      mechanicLayoutDefinitionHash: definition.mechanicLayoutDefinitionHash,
    })),
    layoutSpec,
  };
  return {
    source,
    configuration,
    definitions,
    bundle: {
      ...bundlePreimage,
      layoutBundleHash: hashLayoutBundle(bundlePreimage).hash,
    },
  };
}

function validate(
  fixture: ReturnType<typeof makeLayoutBundle>,
): Record<string, unknown> {
  return assertValidLayoutBundle(
    fixture.bundle,
    fixture.source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    fixture.configuration,
    fixture.definitions,
  ) as unknown as Record<string, unknown>;
}

function refreshLayoutHashes(bundle: Record<string, unknown>): void {
  const layoutSpec = bundle.layoutSpec as Record<string, unknown>;
  layoutSpec.layoutSpecHash = hashLayoutSpec(layoutSpec).hash;
  bundle.layoutBundleHash = hashLayoutBundle(bundle).hash;
}

describe("G1a layout contract decisions", () => {
  it("reproduces the committed schema identity", async () => {
    const schema = JSON.parse(
      await readFile(
        new URL("../schemas/layout-contracts.schema.json", import.meta.url),
        "utf8",
      ),
    ) as unknown;
    expect(sha256Bytes(evaluatorCanonicalize(schema).canonicalBytes)).toBe(
      LAYOUT_CONTRACT_SCHEMA_HASH,
    );
  });

  it.each([20, 21, 50])(
    "accepts a closed G0/G1 graph with %i stages",
    (stageCount) => {
      const fixture = makeLayoutBundle(stageCount, 3);
      expect(() => validate(fixture)).not.toThrow();
      expect(
        (fixture.bundle.layoutSpec as { stages: unknown[] }).stages,
      ).toHaveLength(stageCount);
    },
  );

  it("accepts a five-stage source with zero checkpoints", () => {
    const fixture = makeLayoutBundle(5, 5);
    expect(fixture.source.obbySpec.checkpoints).toEqual([]);
    expect(() => validate(fixture)).not.toThrow();
    const spec = fixture.bundle.layoutSpec as {
      objects: { role: string }[];
      stages: { checkpointObjectId?: string }[];
    };
    expect(
      spec.objects.filter((object) => object.role === "checkpoint"),
    ).toEqual([]);
    expect(
      spec.stages.some((stage) => stage.checkpointObjectId !== undefined),
    ).toBe(false);
  });

  it.each([
    [
      "LayoutConfigurationPreimage",
      "configurationHash",
      hashLayoutConfiguration,
    ],
    [
      "MechanicLayoutDefinitionPreimage",
      "mechanicLayoutDefinitionHash",
      hashMechanicLayoutDefinition,
    ],
    ["LayoutSpecPreimage", "layoutSpecHash", hashLayoutSpec],
    ["LayoutBundlePreimage", "layoutBundleHash", hashLayoutBundle],
  ] as const)("%s excludes its own %s", (_name, field, hash) => {
    const fixture = makeLayoutBundle(5, 3);
    const values = {
      configurationHash: fixture.configuration,
      mechanicLayoutDefinitionHash: fixture.definitions[0],
      layoutSpecHash: fixture.bundle.layoutSpec,
      layoutBundleHash: fixture.bundle,
    };
    const value = values[field];
    if (value === undefined) throw new Error(`missing ${field} fixture`);
    const first = hash(value);
    const changed = { ...value, [field]: HASH_A };
    const second = hash(changed);
    expect(second).toEqual(first);
    expect(new TextDecoder().decode(first.canonicalBytes)).not.toContain(field);
  });

  it("keeps execution-only work admission outside configuration identity", () => {
    const configuration = layoutConfiguration();
    const changed = structuredClone(configuration);
    const limits = changed.limits as Record<string, unknown>;
    limits.maxWorkUnits = Number(limits.maxWorkUnits) + 1;
    expect(hashLayoutConfiguration(changed)).toEqual(
      hashLayoutConfiguration(configuration),
    );
  });

  it.each(["configuration", "definition"] as const)(
    "rejects a stale %s authority reference with otherwise fresh hashes",
    (kind) => {
      const fixture = makeLayoutBundle(5, 3);
      const changed = structuredClone(fixture.bundle);
      const configuration = structuredClone(fixture.configuration);
      const definitions = structuredClone(fixture.definitions);
      if (kind === "configuration") {
        const policy = configuration.numericPolicy as Record<string, unknown>;
        policy.measurementToleranceStuds = 2e-9;
        configuration.configurationHash =
          hashLayoutConfiguration(configuration).hash;
      } else {
        const definition = definitions[0];
        if (definition === undefined) throw new Error("missing definition");
        definition.definitionVersion = "1.0.1";
        definition.mechanicLayoutDefinitionHash =
          hashMechanicLayoutDefinition(definition).hash;
      }
      changed.layoutBundleHash = hashLayoutBundle(changed).hash;
      expect(() =>
        assertValidLayoutBundle(
          changed,
          fixture.source,
          DEFAULT_GENERATOR_CONFIGURATION,
          DEFAULT_MECHANIC_CATALOG,
          configuration,
          definitions,
        ),
      ).toThrow(expect.objectContaining({ code: "stale-authority" }));
    },
  );

  it("rejects an unknown source stage after all content hashes are refreshed", () => {
    const fixture = makeLayoutBundle(5, 3);
    const changed = structuredClone(fixture.bundle);
    const layoutSpec = changed.layoutSpec as {
      stages: Record<string, unknown>[];
    };
    const firstStage = layoutSpec.stages[0];
    if (firstStage === undefined) throw new Error("missing first stage");
    firstStage.sourceStageId = "stage-unknown";
    refreshLayoutHashes(changed);
    expect(() =>
      assertValidLayoutBundle(
        changed,
        fixture.source,
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        fixture.configuration,
        fixture.definitions,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid-reference" }));
  });

  it("rejects incomplete required-transition reference closure", () => {
    const fixture = makeLayoutBundle(20, 3);
    const changed = structuredClone(fixture.bundle);
    const layoutSpec = changed.layoutSpec as {
      reachability: { requiredTransitions: unknown[] };
    };
    layoutSpec.reachability.requiredTransitions.pop();
    refreshLayoutHashes(changed);
    expect(() =>
      assertValidLayoutBundle(
        changed,
        fixture.source,
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        fixture.configuration,
        fixture.definitions,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid-reference" }));
  });

  it("rejects an indeterminate required-transition outcome", () => {
    const fixture = makeLayoutBundle(5, 3);
    const changed = structuredClone(fixture.bundle);
    const layoutSpec = changed.layoutSpec as {
      reachability: { requiredTransitions: Record<string, unknown>[] };
    };
    const transition = layoutSpec.reachability.requiredTransitions[0];
    if (transition === undefined) throw new Error("missing transition");
    transition.outcome = "indeterminate";
    refreshLayoutHashes(changed);
    expect(() =>
      assertValidLayoutBundle(
        changed,
        fixture.source,
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        fixture.configuration,
        fixture.definitions,
      ),
    ).toThrow(expect.objectContaining({ code: "schema" }));
  });

  it("rejects an indeterminate required route from a publishable bundle", () => {
    const fixture = makeLayoutBundle(5, 3);
    const changed = structuredClone(fixture.bundle);
    const layoutSpec = changed.layoutSpec as Record<string, unknown>;
    layoutSpec.limitations = [
      {
        code: "reachability-indeterminate",
        message: "contract fixture has no required-transition verdict",
        relatedSourceIds: [fixture.source.obbySpec.route.routeId],
      },
    ];
    refreshLayoutHashes(changed);
    expect(() =>
      assertValidLayoutBundle(
        changed,
        fixture.source,
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        fixture.configuration,
        fixture.definitions,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "invariant",
        message:
          "indeterminate required-route reachability blocks LayoutBundle publication",
      }),
    );
  });

  it("preserves exact PlaceSpec and SceneManifest 0.2 compatibility", async () => {
    const placeSpec = JSON.parse(
      await readFile(
        new URL(
          "../../../examples/vertical-slice/place-spec.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as unknown;
    const expectedManifest = JSON.parse(
      await readFile(
        new URL(
          "../../../examples/vertical-slice/scene-manifest.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as unknown;
    const actualManifest = compilePlaceSpec(placeSpec);
    expect(actualManifest.schemaVersion).toBe("0.2");
    expect(evaluatorCanonicalStringify(actualManifest)).toBe(
      evaluatorCanonicalStringify(expectedManifest),
    );
  });

  it("returns typed layout errors without accepting missing G0 authority", () => {
    const fixture = makeLayoutBundle(5, 3);
    const wrongConfiguration = structuredClone(DEFAULT_GENERATOR_CONFIGURATION);
    wrongConfiguration.configurationId = "wrong-authority";
    expect(() =>
      assertValidLayoutBundle(
        fixture.bundle,
        fixture.source,
        wrongConfiguration,
        DEFAULT_MECHANIC_CATALOG,
        fixture.configuration,
        fixture.definitions,
      ),
    ).toThrow(LayoutContractError);
  });
});
