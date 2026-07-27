import { compareUnicodeScalars } from "@obby/canonical-json";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

import generatorSchema from "../schemas/generator-contracts.schema.json" with { type: "json" };

import {
  assertContentHash,
  GeneratorContractError,
  hashGeneratorPreimage,
} from "./hashing.js";
import type {
  GenerationBundle,
  GenerationRequest,
  GeneratorConfiguration,
  MechanicCatalog,
  NormalizedGenerationRequest,
  ObbySpec,
} from "./types.js";

const hashPattern = /^sha256:[0-9a-f]{64}$/u;
const identifierPattern = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const schemaId = generatorSchema.$id;
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(generatorSchema);
const structural = new Map<string, ValidateFunction>();
for (const name of [
  "GeneratorConfiguration",
  "MechanicCatalog",
  "NormalizedGenerationRequest",
  "ObbySpec",
  "GenerationBundle",
] as const)
  structural.set(name, ajv.compile({ $ref: `${schemaId}#/$defs/${name}` }));

function assertStructural(name: string, input: unknown): void {
  const validator = structural.get(name);
  if (!validator?.(input)) {
    const details =
      validator?.errors
        ?.map((error) => `${error.instancePath || "/"}:${error.keyword}`)
        .join(", ") ?? "validator unavailable";
    throw new GeneratorContractError(
      "schema",
      `${name} structural validation failed: ${details}`,
    );
  }
}

function record(input: unknown, label: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new GeneratorContractError("schema", `${label} must be an object`);
  }
  return input as Record<string, unknown>;
}

function string(input: unknown, label: string, maximum = 256): string {
  if (
    typeof input !== "string" ||
    input.trim().length === 0 ||
    input.length > maximum
  ) {
    throw new GeneratorContractError(
      "schema",
      `${label} must be a non-empty string of at most ${maximum} characters`,
    );
  }
  return input;
}

function identifier(input: unknown, label: string): string {
  const value = string(input, label, 128);
  if (!identifierPattern.test(value))
    throw new GeneratorContractError(
      "schema",
      `${label} is not a stable identifier`,
    );
  return value;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0)
    throw new GeneratorContractError(
      "schema",
      `${label} has unknown fields: ${extras.sort(compareUnicodeScalars).join(", ")}`,
    );
}

const requestKeys = [
  "schemaVersion",
  "requestId",
  "generationRequestHash",
  "workingName",
  "genre",
  "theme",
  "targetAudience",
  "targetSessionDurationMinutes",
  "stageCount",
  "difficulty",
  "checkpointFrequency",
  "supportedMechanicPreferences",
  "excludedMechanics",
  "visualStylePreferences",
  "assetPolicy",
  "accessibilityConstraints",
  "seed",
  "brief",
] as const;

export function parseGenerationRequest(input: unknown): GenerationRequest {
  const value = record(input, "GenerationRequest");
  exactKeys(value, requestKeys, "GenerationRequest");
  if (value.schemaVersion !== "0.1" || value.genre !== "obby")
    throw new GeneratorContractError(
      "schema",
      "GenerationRequest supports only schemaVersion 0.1 and genre obby",
    );
  identifier(value.requestId, "requestId");
  string(value.workingName, "workingName", 120);
  if (
    !Number.isSafeInteger(value.seed) ||
    (value.seed as number) < 0 ||
    (value.seed as number) > 0xffff_ffff
  )
    throw new GeneratorContractError(
      "schema",
      "seed must be an unsigned 32-bit integer",
    );
  const enums: Record<string, readonly string[]> = {
    theme: ["classic", "sky", "space", "lava", "jungle"],
    targetAudience: ["all-ages", "general", "experienced"],
    difficulty: ["easy", "medium", "hard"],
    assetPolicy: [
      "native-parts-only",
      "approved-local-assets",
      "external-assets-allowed-later",
    ],
  };
  for (const [key, choices] of Object.entries(enums))
    if (value[key] !== undefined && !choices.includes(value[key] as string))
      throw new GeneratorContractError("schema", `${key} has an unknown value`);
  for (const key of [
    "supportedMechanicPreferences",
    "excludedMechanics",
    "visualStylePreferences",
    "accessibilityConstraints",
  ] as const) {
    const entry = value[key];
    if (
      entry !== undefined &&
      (!Array.isArray(entry) ||
        entry.length > 64 ||
        entry.some(
          (item) =>
            typeof item !== "string" || item.length === 0 || item.length > 128,
        ))
    )
      throw new GeneratorContractError(
        "schema",
        `${key} must be a bounded string array`,
      );
  }
  if (
    value.targetSessionDurationMinutes !== undefined &&
    (!Number.isInteger(value.targetSessionDurationMinutes) ||
      (value.targetSessionDurationMinutes as number) < 1 ||
      (value.targetSessionDurationMinutes as number) > 120)
  )
    throw new GeneratorContractError(
      "schema",
      "targetSessionDurationMinutes must be an integer from 1 through 120",
    );
  const accessibility = value.accessibilityConstraints;
  const accessibilityValues = [
    "color-independent-cues",
    "high-readability",
    "reduced-motion",
    "motion-required",
  ];
  if (
    Array.isArray(accessibility) &&
    accessibility.some(
      (entry) =>
        typeof entry !== "string" || !accessibilityValues.includes(entry),
    )
  )
    throw new GeneratorContractError(
      "schema",
      "accessibilityConstraints contains an unknown value",
    );
  const visualStyles = value.visualStylePreferences;
  const visualStyleValues = [
    "animated-decor",
    "bright",
    "high-readability",
    "minimal",
    "saturated",
  ];
  if (
    Array.isArray(visualStyles) &&
    visualStyles.some(
      (entry) =>
        typeof entry !== "string" || !visualStyleValues.includes(entry),
    )
  )
    throw new GeneratorContractError(
      "schema",
      "visualStylePreferences contains an unknown value",
    );
  if (
    value.brief !== undefined &&
    (typeof value.brief !== "string" || value.brief.length > 2_000)
  )
    throw new GeneratorContractError(
      "schema",
      "brief must be at most 2000 characters",
    );
  if (
    value.generationRequestHash !== undefined &&
    (typeof value.generationRequestHash !== "string" ||
      !hashPattern.test(value.generationRequestHash))
  )
    throw new GeneratorContractError(
      "schema",
      "generationRequestHash is malformed",
    );
  return structuredClone(value) as unknown as GenerationRequest;
}

export function assertValidGeneratorConfiguration(
  input: unknown,
): asserts input is GeneratorConfiguration {
  assertStructural("GeneratorConfiguration", input);
  const value = record(
    input,
    "GeneratorConfiguration",
  ) as unknown as GeneratorConfiguration;
  identifier(value.configurationId, "configurationId");
  assertContentHash(value, "configurationHash");
}

export function assertValidMechanicCatalog(
  input: unknown,
): asserts input is MechanicCatalog {
  assertStructural("MechanicCatalog", input);
  const catalog = record(
    input,
    "MechanicCatalog",
  ) as unknown as MechanicCatalog;
  if (catalog.mechanics.length === 0)
    throw new GeneratorContractError(
      "invariant",
      "mechanic catalog must not be empty",
    );
  const ids = new Set<string>();
  for (const [index, mechanic] of catalog.mechanics.entries()) {
    identifier(mechanic.mechanicId, "mechanicId");
    if (ids.has(mechanic.mechanicId))
      throw new GeneratorContractError(
        "duplicate-id",
        `duplicate mechanic ${mechanic.mechanicId}`,
      );
    ids.add(mechanic.mechanicId);
    if (mechanic.minimumDifficulty > mechanic.maximumDifficulty)
      throw new GeneratorContractError(
        "invariant",
        `${mechanic.mechanicId} has inverted difficulty bounds`,
      );
    const previous = catalog.mechanics[index - 1];
    if (
      previous !== undefined &&
      compareUnicodeScalars(previous.mechanicId, mechanic.mechanicId) >= 0
    )
      throw new GeneratorContractError(
        "invariant",
        "mechanic catalog must use Unicode-scalar ID order",
      );
    assertContentHash(mechanic, "mechanicDefinitionHash");
  }
  for (const mechanic of catalog.mechanics)
    for (const adjacentId of mechanic.forbiddenAdjacentMechanicIds)
      if (!ids.has(adjacentId))
        throw new GeneratorContractError(
          "invalid-reference",
          `${mechanic.mechanicId} forbids unknown mechanic ${adjacentId}`,
        );
  assertContentHash(catalog, "catalogHash");
}

function requireUnique(ids: readonly string[], label: string): Set<string> {
  const result = new Set(ids);
  if (result.size !== ids.length)
    throw new GeneratorContractError("duplicate-id", `duplicate ${label}`);
  return result;
}

export function assertValidObbySpec(
  input: unknown,
  catalog?: MechanicCatalog,
  excludedMechanics: readonly string[] = [],
  configuration?: GeneratorConfiguration,
): asserts input is ObbySpec {
  assertStructural("ObbySpec", input);
  const spec = record(input, "ObbySpec") as unknown as ObbySpec;
  const expectedSeedIdentity = hashGeneratorPreimage(
    {
      schemaVersion: spec.schemaVersion,
      normalizedRequestHash: spec.normalizedRequestHash,
      configurationHash: spec.configurationHash,
      catalogHash: spec.catalogHash,
      prngAlgorithm: spec.prngAlgorithm,
      seed: spec.seed,
    },
    "seedIdentity",
  );
  if (spec.seedIdentity !== expectedSeedIdentity)
    throw new GeneratorContractError(
      "hash-mismatch",
      `seedIdentity content mismatch: expected ${expectedSeedIdentity}, received ${spec.seedIdentity}`,
    );
  const stageIds = requireUnique(
    spec.stages.map((item) => item.stageId),
    "stage ID",
  );
  if (
    spec.stages.length < 5 ||
    spec.stages.length > 50 ||
    spec.stages.some((stage, index) => stage.ordinal !== index + 1)
  )
    throw new GeneratorContractError(
      "invariant",
      "stage ordinals must be continuous from 1 within 5..50",
    );
  const allIds = [
    spec.obbySpecId,
    ...spec.stages.map((item) => item.stageId),
    ...spec.mechanicIntents.map((item) => item.mechanicIntentId),
    ...spec.route.nodes.map((item) => item.routeNodeId),
    ...spec.route.transitions.map((item) => item.routeTransitionId),
    ...spec.checkpoints.map((item) => item.checkpointId),
    ...spec.hazards.map((item) => item.hazardId),
    spec.finish.finishId,
    spec.route.routeId,
    spec.difficultyPlan.difficultyPlanId,
    ...spec.difficultyPlan.bands.map((item) => item.difficultyBandId),
    ...spec.assetIntents.map((item) => item.assetIntentId),
    ...spec.visualStyleIntents.map((item) => item.visualStyleIntentId),
    spec.progressionIntent.progressionIntentId,
    spec.retentionIntent.retentionIntentId,
    ...spec.limitations.map((item) => item.limitationId),
    ...spec.findings.map((item) => item.findingId),
  ];
  requireUnique(allIds, "semantic ID");
  const routeNodeIds = requireUnique(
    spec.route.nodes.map((node) => node.routeNodeId),
    "route node ID",
  );
  requireUnique(spec.route.orderedNodeIds, "ordered route node ID");
  if (
    spec.route.nodes.length > 52 ||
    spec.route.transitions.length > 51 ||
    spec.checkpoints.length > 49 ||
    spec.hazards.length > 50 ||
    spec.assetIntents.length > 128 ||
    spec.findings.length > 64 ||
    spec.limitations.length > 64
  )
    throw new GeneratorContractError(
      "work-limit",
      "ObbySpec exceeds a deterministic collection limit",
    );
  if (
    spec.route.orderedNodeIds[0] !== spec.route.startNodeId ||
    spec.route.orderedNodeIds.at(-1) !== spec.route.finishNodeId ||
    spec.route.transitions.length !== spec.route.orderedNodeIds.length - 1
  )
    throw new GeneratorContractError(
      "invariant",
      "route must be one continuous start-to-finish chain",
    );
  const startNodes = spec.route.nodes.filter((node) => node.kind === "start");
  const finishNodes = spec.route.nodes.filter((node) => node.kind === "finish");
  if (
    startNodes.length !== 1 ||
    finishNodes.length !== 1 ||
    startNodes[0]?.routeNodeId !== spec.route.startNodeId ||
    finishNodes[0]?.routeNodeId !== spec.route.finishNodeId ||
    spec.route.nodes.length !== spec.route.orderedNodeIds.length ||
    spec.route.nodes.some(
      (node, index) => node.routeNodeId !== spec.route.orderedNodeIds[index],
    )
  )
    throw new GeneratorContractError(
      "invariant",
      "route must contain exactly one declared start and finish",
    );
  const playableRouteNodes = spec.route.nodes.filter(
    (node) => node.kind === "stage" || node.kind === "checkpoint",
  );
  if (
    playableRouteNodes.length !== spec.stages.length ||
    playableRouteNodes.some(
      (node, index) => node.stageId !== spec.stages[index]?.stageId,
    )
  )
    throw new GeneratorContractError(
      "invariant",
      "required route must cover every stage exactly once in ordinal order",
    );
  spec.route.orderedNodeIds.forEach((id) => {
    if (!routeNodeIds.has(id))
      throw new GeneratorContractError(
        "invalid-reference",
        `unknown route node ${id}`,
      );
  });
  spec.route.transitions.forEach((transition, index) => {
    if (
      transition.fromNodeId !== spec.route.orderedNodeIds[index] ||
      transition.toNodeId !== spec.route.orderedNodeIds[index + 1]
    )
      throw new GeneratorContractError(
        "invariant",
        `transition ${transition.routeTransitionId} breaks route order`,
      );
  });
  let previousCheckpointOrder = 0;
  for (const checkpoint of spec.checkpoints) {
    const routeNode = spec.route.nodes.find(
      (node) => node.routeNodeId === checkpoint.routeNodeId,
    );
    if (
      !stageIds.has(checkpoint.stageId) ||
      !routeNodeIds.has(checkpoint.routeNodeId) ||
      checkpoint.routeOrder <= previousCheckpointOrder ||
      checkpoint.routeOrder >= spec.route.orderedNodeIds.length - 1 ||
      spec.route.orderedNodeIds[checkpoint.routeOrder] !==
        checkpoint.routeNodeId ||
      routeNode?.kind !== "checkpoint" ||
      routeNode.stageId !== checkpoint.stageId
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `invalid checkpoint ${checkpoint.checkpointId}`,
      );
    previousCheckpointOrder = checkpoint.routeOrder;
  }
  for (const hazard of spec.hazards)
    if (!stageIds.has(hazard.stageId))
      throw new GeneratorContractError(
        "invalid-reference",
        `unknown hazard stage ${hazard.stageId}`,
      );
  if (
    !stageIds.has(spec.finish.afterStageId) ||
    spec.finish.afterStageId !== spec.stages.at(-1)?.stageId ||
    spec.finish.routeNodeId !== spec.route.finishNodeId ||
    spec.route.nodes.find(
      (node) => node.routeNodeId === spec.finish.routeNodeId,
    )?.kind !== "finish"
  )
    throw new GeneratorContractError(
      "invariant",
      "finish must follow final playable stage",
    );
  const visualIds = new Set(
    spec.visualStyleIntents.map((item) => item.visualStyleIntentId),
  );
  const assetIds = new Set(spec.assetIntents.map((item) => item.assetIntentId));
  const mechanicIntentIds = new Set(
    spec.mechanicIntents.map((item) => item.mechanicIntentId),
  );
  const difficultyBandIds = new Set(
    spec.difficultyPlan.bands.map((item) => item.difficultyBandId),
  );
  const hazardIds = new Set(spec.hazards.map((item) => item.hazardId));
  const checkpointIds = new Set(
    spec.checkpoints.map((item) => item.checkpointId),
  );
  for (const [index, band] of spec.difficultyPlan.bands.entries())
    if (
      band.stageId !== spec.stages[index]?.stageId ||
      band.ordinal !== index + 1
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `difficulty band ${band.difficultyBandId} does not bind its ordinal stage`,
      );
  for (const intent of spec.mechanicIntents) {
    const stage = spec.stages.find((item) => item.stageId === intent.stageId);
    if (stage?.mechanicIntentIds.includes(intent.mechanicIntentId) !== true)
      throw new GeneratorContractError(
        "invalid-reference",
        `mechanic intent ${intent.mechanicIntentId} is not bound to its stage`,
      );
  }
  for (const hazard of spec.hazards) {
    const stage = spec.stages.find((item) => item.stageId === hazard.stageId);
    if (
      stage === undefined ||
      !stage.hazardIds.includes(hazard.hazardId) ||
      !visualIds.has(hazard.visualStyleIntentId)
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `hazard ${hazard.hazardId} is not bound to its stage and visual intent`,
      );
  }
  for (const checkpoint of spec.checkpoints) {
    const stage = spec.stages.find(
      (item) => item.stageId === checkpoint.stageId,
    );
    if (stage?.checkpointId !== checkpoint.checkpointId)
      throw new GeneratorContractError(
        "invalid-reference",
        `checkpoint ${checkpoint.checkpointId} is not bound to its stage`,
      );
  }
  for (const stage of spec.stages) {
    if (
      !visualIds.has(stage.visualStyleIntentId) ||
      stage.assetIntentIds.some((id) => !assetIds.has(id)) ||
      stage.mechanicIntentIds.some((id) => !mechanicIntentIds.has(id)) ||
      !difficultyBandIds.has(stage.difficultyBandId) ||
      stage.hazardIds.some((id) => !hazardIds.has(id)) ||
      (stage.checkpointId !== undefined &&
        !checkpointIds.has(stage.checkpointId))
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `stage ${stage.stageId} has an unknown intent reference`,
      );
    if (
      stage.estimatedCompletionSeconds.minimum >
      stage.estimatedCompletionSeconds.maximum
    )
      throw new GeneratorContractError(
        "invariant",
        `stage ${stage.stageId} has an inverted completion-time band`,
      );
  }
  for (const asset of spec.assetIntents) {
    if (
      (asset.scope === "stage" &&
        (asset.stageId === undefined || !stageIds.has(asset.stageId))) ||
      (asset.scope === "global" && asset.stageId !== undefined)
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `asset ${asset.assetIntentId} has an invalid scope reference`,
      );
    if (
      asset.authority === "decorative" &&
      asset.collisionPolicy !== "non-colliding"
    )
      throw new GeneratorContractError(
        "invariant",
        "decorative assets must remain non-colliding",
      );
  }
  if (catalog !== undefined) {
    const mechanics = new Map(
      catalog.mechanics.map((item) => [item.mechanicId, item]),
    );
    for (const intent of spec.mechanicIntents) {
      if (!mechanics.has(intent.mechanicId))
        throw new GeneratorContractError("unknown-mechanic", intent.mechanicId);
      if (excludedMechanics.includes(intent.mechanicId))
        throw new GeneratorContractError(
          "invariant",
          `excluded mechanic ${intent.mechanicId} was planned`,
        );
      const mechanic = mechanics.get(intent.mechanicId);
      const stageIndex = spec.stages.findIndex(
        (stage) => stage.stageId === intent.stageId,
      );
      const intentLevel = spec.difficultyPlan.bands[stageIndex]?.intentLevel;
      if (
        mechanic !== undefined &&
        (intentLevel === undefined ||
          intentLevel < mechanic.minimumDifficulty ||
          intentLevel > mechanic.maximumDifficulty)
      )
        throw new GeneratorContractError(
          "invariant",
          `${intent.mechanicId} is outside its catalog difficulty bounds`,
        );
      if (
        mechanic?.capability !== "g1-static-supported" &&
        configuration?.allowDeferredMechanics !== true
      )
        throw new GeneratorContractError(
          "deferred-mechanic",
          `${intent.mechanicId} is not buildable under the validated configuration`,
        );
    }
    for (const hazard of spec.hazards) {
      const stage = spec.stages.find((item) => item.stageId === hazard.stageId);
      const stageMechanics = (stage?.mechanicIntentIds ?? []).map(
        (intentId) =>
          spec.mechanicIntents.find(
            (intent) => intent.mechanicIntentId === intentId,
          )?.mechanicId,
      );
      if (
        !mechanics.has(hazard.mechanicId) ||
        !stageMechanics.includes(hazard.mechanicId)
      )
        throw new GeneratorContractError(
          "invalid-reference",
          `hazard ${hazard.hazardId} does not bind its stage mechanic`,
        );
    }
    for (let index = 1; index < spec.stages.length; index += 1) {
      const previousStage = spec.stages[index - 1];
      const currentStage = spec.stages[index];
      if (previousStage === undefined || currentStage === undefined)
        throw new GeneratorContractError(
          "invariant",
          "stage mechanic sequence is incomplete",
        );
      const previousMechanics = previousStage.mechanicIntentIds
        .map((id) =>
          spec.mechanicIntents.find((intent) => intent.mechanicIntentId === id),
        )
        .filter((intent) => intent !== undefined);
      const currentMechanics = currentStage.mechanicIntentIds
        .map((id) =>
          spec.mechanicIntents.find((intent) => intent.mechanicIntentId === id),
        )
        .filter((intent) => intent !== undefined);
      for (const previousIntent of previousMechanics)
        for (const currentIntent of currentMechanics) {
          const previousDefinition = mechanics.get(previousIntent.mechanicId);
          const currentDefinition = mechanics.get(currentIntent.mechanicId);
          if (
            previousDefinition?.forbiddenAdjacentMechanicIds.includes(
              currentIntent.mechanicId,
            ) ||
            currentDefinition?.forbiddenAdjacentMechanicIds.includes(
              previousIntent.mechanicId,
            )
          )
            throw new GeneratorContractError(
              "invariant",
              `forbidden mechanic adjacency ${previousIntent.mechanicId} -> ${currentIntent.mechanicId}`,
            );
        }
    }
  }
  const introducedMechanics = new Set<string>();
  for (const stage of spec.stages)
    for (const intentId of stage.mechanicIntentIds) {
      const intent = spec.mechanicIntents.find(
        (item) => item.mechanicIntentId === intentId,
      );
      if (intent === undefined) continue;
      const isNew = !introducedMechanics.has(intent.mechanicId);
      if ((intent.use === "introduce") !== isNew)
        throw new GeneratorContractError(
          "invariant",
          `mechanic ${intent.mechanicId} must be introduced exactly on first use`,
        );
      introducedMechanics.add(intent.mechanicId);
    }
  if (
    spec.difficultyPlan.bands.length !== spec.stages.length ||
    spec.difficultyPlan.bands[0]?.band !== "tutorial" ||
    spec.stages[0]?.role !== "onboarding" ||
    spec.stages.at(-1)?.role !== "finish-approach" ||
    spec.difficultyPlan.bands.at(-1)?.band !== "climax"
  )
    throw new GeneratorContractError(
      "invariant",
      "difficulty and role boundary invariants failed",
    );
  for (let index = 1; index < spec.difficultyPlan.bands.length; index += 1) {
    const currentBand = spec.difficultyPlan.bands[index];
    const previousBand = spec.difficultyPlan.bands[index - 1];
    if (currentBand === undefined || previousBand === undefined)
      throw new GeneratorContractError(
        "invariant",
        "difficulty band sequence is incomplete",
      );
    const current = currentBand.intentLevel;
    const previous = previousBand.intentLevel;
    if (Math.abs(current - previous) > spec.difficultyPlan.maximumLocalDelta)
      throw new GeneratorContractError(
        "invariant",
        "difficulty local delta exceeds the plan maximum",
      );
    if (currentBand.band === "recovery" && current > previous)
      throw new GeneratorContractError(
        "invariant",
        "recovery cannot exceed its preceding peak",
      );
  }
  const hashFields: [object, string][] = [
    ...spec.stages.map((item): [object, string] => [item, "stageHash"]),
    ...spec.mechanicIntents.map((item): [object, string] => [
      item,
      "mechanicIntentHash",
    ]),
    ...spec.route.nodes.map((item): [object, string] => [
      item,
      "routeNodeHash",
    ]),
    ...spec.route.transitions.map((item): [object, string] => [
      item,
      "routeTransitionHash",
    ]),
    [spec.route, "routeHash"],
    ...spec.checkpoints.map((item): [object, string] => [
      item,
      "checkpointHash",
    ]),
    ...spec.hazards.map((item): [object, string] => [item, "hazardHash"]),
    [spec.finish, "finishHash"],
    ...spec.difficultyPlan.bands.map((item): [object, string] => [
      item,
      "difficultyBandHash",
    ]),
    [spec.difficultyPlan, "difficultyPlanHash"],
    ...spec.visualStyleIntents.map((item): [object, string] => [
      item,
      "visualStyleIntentHash",
    ]),
    ...spec.assetIntents.map((item): [object, string] => [
      item,
      "assetIntentHash",
    ]),
    [spec.progressionIntent, "progressionIntentHash"],
    [spec.retentionIntent, "retentionIntentHash"],
    ...spec.limitations.map((item): [object, string] => [
      item,
      "limitationHash",
    ]),
    ...spec.findings.map((item): [object, string] => [item, "findingHash"]),
    [spec, "obbySpecHash"],
  ];
  for (const [value, field] of hashFields) assertContentHash(value, field);
}

export function assertValidNormalizedGenerationRequest(
  input: unknown,
): asserts input is NormalizedGenerationRequest {
  assertStructural("NormalizedGenerationRequest", input);
  const value = record(
    input,
    "NormalizedGenerationRequest",
  ) as unknown as NormalizedGenerationRequest;
  if (value.stageCount < 5 || value.stageCount > 50)
    throw new GeneratorContractError("schema", "invalid normalized request");
  assertContentHash(value, "normalizedRequestHash");
}

export function assertValidGenerationBundle(
  input: unknown,
  catalog?: MechanicCatalog,
  configuration?: GeneratorConfiguration,
): asserts input is GenerationBundle {
  assertStructural("GenerationBundle", input);
  const bundle = record(
    input,
    "GenerationBundle",
  ) as unknown as GenerationBundle;
  assertValidNormalizedGenerationRequest(bundle.normalizedRequest);
  assertValidObbySpec(
    bundle.obbySpec,
    catalog,
    bundle.normalizedRequest.excludedMechanics,
    configuration,
  );
  if (catalog !== undefined && bundle.catalogHash !== catalog.catalogHash)
    throw new GeneratorContractError(
      "invalid-reference",
      "bundle catalogHash does not match the validated catalog",
    );
  if (
    catalog !== undefined &&
    bundle.normalizedRequest.accessibilityConstraints.includes("reduced-motion")
  ) {
    const mechanics = new Map(
      catalog.mechanics.map((item) => [item.mechanicId, item]),
    );
    for (const intent of bundle.obbySpec.mechanicIntents)
      if (
        mechanics
          .get(intent.mechanicId)
          ?.accessibilityImplications.includes("reduced-motion")
      )
        throw new GeneratorContractError(
          "invariant",
          `${intent.mechanicId} conflicts with reduced-motion`,
        );
  }
  if (
    configuration !== undefined &&
    bundle.configurationHash !== configuration.configurationHash
  )
    throw new GeneratorContractError(
      "invalid-reference",
      "bundle configurationHash does not match the validated configuration",
    );
  if (
    bundle.obbySpec.normalizedRequestHash !==
      bundle.normalizedRequest.normalizedRequestHash ||
    bundle.obbySpec.configurationHash !== bundle.configurationHash ||
    bundle.obbySpec.catalogHash !== bundle.catalogHash
  )
    throw new GeneratorContractError(
      "invalid-reference",
      "bundle identity references disagree",
    );
  if (
    JSON.stringify(bundle.findings) !==
      JSON.stringify(bundle.obbySpec.findings) ||
    JSON.stringify(bundle.limitations) !==
      JSON.stringify(bundle.obbySpec.limitations)
  )
    throw new GeneratorContractError(
      "invariant",
      "bundle findings and limitations must bind exactly to ObbySpec",
    );
  assertContentHash(bundle, "generationBundleHash");
}
