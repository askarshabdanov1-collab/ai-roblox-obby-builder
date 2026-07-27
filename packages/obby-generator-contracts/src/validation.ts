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
    (typeof value.brief !== "string" ||
      value.brief.trim().length === 0 ||
      value.brief.length > 2_000)
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
    assertCanonicalSet(
      mechanic.requiredCapabilities,
      `${mechanic.mechanicId} required capabilities`,
    );
    assertCanonicalSet(
      mechanic.compatibleHazardKinds,
      `${mechanic.mechanicId} hazard kinds`,
    );
    assertCanonicalSet(
      mechanic.forbiddenAdjacentMechanicIds,
      `${mechanic.mechanicId} forbidden adjacency`,
    );
    assertCanonicalSet(
      mechanic.accessibilityImplications,
      `${mechanic.mechanicId} accessibility implications`,
    );
    const expectedCapability =
      mechanic.capability === "g1-static-supported"
        ? "native-parts"
        : "runtime-mechanic";
    if (
      mechanic.requiredCapabilities.length !== 1 ||
      mechanic.requiredCapabilities[0] !== expectedCapability
    )
      throw new GeneratorContractError(
        "invariant",
        `${mechanic.mechanicId} has unavailable or contradictory required capabilities`,
      );
    const staticHazards = new Set(["kill-floor", "kill-part", "fall-void"]);
    if (
      (mechanic.capability === "g1-static-supported" &&
        mechanic.compatibleHazardKinds.some(
          (kind) => !staticHazards.has(kind),
        )) ||
      (mechanic.capability !== "g1-static-supported" &&
        mechanic.compatibleHazardKinds.some((kind) => staticHazards.has(kind)))
    )
      throw new GeneratorContractError(
        "invariant",
        `${mechanic.mechanicId} declares a hazard outside its capability class`,
      );
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
  if (
    !catalog.mechanics.some(
      (mechanic) => mechanic.capability === "g1-static-supported",
    )
  )
    throw new GeneratorContractError(
      "invariant",
      "mechanic catalog requires at least one static-supported mechanic",
    );
  assertContentHash(catalog, "catalogHash");
}

function requireUnique(ids: readonly string[], label: string): Set<string> {
  const result = new Set(ids);
  if (result.size !== ids.length)
    throw new GeneratorContractError("duplicate-id", `duplicate ${label}`);
  return result;
}

function assertCanonicalSet(items: readonly string[], label: string): void {
  const canonical = [
    ...new Set(items.map((item) => item.normalize("NFC").trim())),
  ].sort(compareUnicodeScalars);
  if (JSON.stringify(items) !== JSON.stringify(canonical))
    throw new GeneratorContractError(
      "invariant",
      `${label} must be a unique NFC Unicode-scalar ordered set`,
    );
}

export function assertValidObbySpec(
  input: unknown,
  catalog: MechanicCatalog,
  configuration: GeneratorConfiguration,
  normalizedRequest: NormalizedGenerationRequest,
): asserts input is ObbySpec {
  if (arguments.length < 4)
    throw new GeneratorContractError(
      "invariant",
      "full ObbySpec validation requires catalog, configuration, and normalized request context",
    );
  assertValidGeneratorConfiguration(configuration);
  assertValidMechanicCatalog(catalog);
  assertValidNormalizedGenerationRequest(normalizedRequest, catalog);
  assertStructural("ObbySpec", input);
  const spec = record(input, "ObbySpec") as unknown as ObbySpec;
  if (
    spec.normalizedRequestHash !== normalizedRequest.normalizedRequestHash ||
    spec.configurationHash !== configuration.configurationHash ||
    spec.catalogHash !== catalog.catalogHash ||
    spec.seed !== normalizedRequest.seed ||
    spec.obbySpecId !==
      `obby-${normalizedRequest.normalizedRequestHash.slice(7, 23)}` ||
    spec.game.title !== normalizedRequest.workingName ||
    spec.game.targetAudience !== normalizedRequest.targetAudience ||
    spec.game.targetSessionDurationMinutes !==
      normalizedRequest.targetSessionDurationMinutes ||
    spec.stages.length !== normalizedRequest.stageCount ||
    spec.difficultyPlan.targetDifficulty !== normalizedRequest.difficulty ||
    spec.difficultyPlan.maximumLocalDelta !==
      configuration.difficultyDeltaLimit ||
    spec.retentionIntent.checkpointCadence !==
      normalizedRequest.checkpointFrequency
  )
    throw new GeneratorContractError(
      "invalid-reference",
      "ObbySpec semantics do not match normalized request or authority context",
    );
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
  const stageById = new Map(spec.stages.map((stage) => [stage.stageId, stage]));
  const stageIndexById = new Map(
    spec.stages.map((stage, index) => [stage.stageId, index]),
  );
  const mechanicIntentById = new Map(
    spec.mechanicIntents.map((intent) => [intent.mechanicIntentId, intent]),
  );
  if (spec.mechanicIntents.length !== spec.stages.length)
    throw new GeneratorContractError(
      "invariant",
      "every stage must have exactly one mechanic intent",
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
  const routeNodeById = new Map(
    spec.route.nodes.map((node) => [node.routeNodeId, node]),
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
  for (const node of spec.route.nodes)
    if (
      ((node.kind === "start" || node.kind === "finish") &&
        node.stageId !== undefined) ||
      ((node.kind === "stage" || node.kind === "checkpoint") &&
        (node.stageId === undefined || !stageIds.has(node.stageId)))
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `route node ${node.routeNodeId} has an invalid stage association`,
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
  const checkpointNodeCoverage = new Map<string, number>();
  const checkpointStageCoverage = new Map<string, number>();
  for (const checkpoint of spec.checkpoints) {
    const routeNode = routeNodeById.get(checkpoint.routeNodeId);
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
    checkpointNodeCoverage.set(
      checkpoint.routeNodeId,
      (checkpointNodeCoverage.get(checkpoint.routeNodeId) ?? 0) + 1,
    );
    checkpointStageCoverage.set(
      checkpoint.stageId,
      (checkpointStageCoverage.get(checkpoint.stageId) ?? 0) + 1,
    );
  }
  for (const node of spec.route.nodes)
    if (
      (node.kind === "checkpoint" &&
        checkpointNodeCoverage.get(node.routeNodeId) !== 1) ||
      (node.kind !== "checkpoint" &&
        checkpointNodeCoverage.has(node.routeNodeId))
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `route checkpoint node ${node.routeNodeId} has invalid checkpoint coverage`,
      );
  for (const [stageId, count] of checkpointStageCoverage)
    if (count !== 1 || !stageIds.has(stageId))
      throw new GeneratorContractError(
        "invalid-reference",
        `stage ${stageId} has conflicting checkpoint coverage`,
      );
  const expectedCheckpointOrdinals = new Set<number>();
  let expectedCheckpointAdjustment = false;
  for (
    let ordinal = normalizedRequest.checkpointFrequency;
    ordinal < normalizedRequest.stageCount;
    ordinal += normalizedRequest.checkpointFrequency
  ) {
    const currentDifficulty = spec.difficultyPlan.bands[ordinal - 1];
    const nextDifficulty = spec.difficultyPlan.bands[ordinal];
    let availableOrdinal =
      currentDifficulty !== undefined &&
      currentDifficulty.intentLevel >= 4 &&
      nextDifficulty?.band === "recovery" &&
      ordinal + 1 < normalizedRequest.stageCount
        ? ordinal + 1
        : ordinal;
    if (availableOrdinal !== ordinal) expectedCheckpointAdjustment = true;
    if (expectedCheckpointOrdinals.has(availableOrdinal)) {
      expectedCheckpointAdjustment = true;
      const alternatives: number[] = [];
      for (
        let distance = 1;
        distance < normalizedRequest.stageCount;
        distance += 1
      ) {
        if (availableOrdinal + distance < normalizedRequest.stageCount)
          alternatives.push(availableOrdinal + distance);
        if (availableOrdinal - distance >= 1)
          alternatives.push(availableOrdinal - distance);
      }
      const replacement = alternatives.find(
        (candidate) => !expectedCheckpointOrdinals.has(candidate),
      );
      if (replacement === undefined)
        throw new GeneratorContractError(
          "invariant",
          "checkpoint cadence cannot be represented without collision",
        );
      availableOrdinal = replacement;
    }
    expectedCheckpointOrdinals.add(availableOrdinal);
  }
  const actualCheckpointOrdinals = spec.checkpoints.map(
    (checkpoint) => checkpoint.routeOrder,
  );
  const expectedOrderedCheckpointOrdinals = [
    ...expectedCheckpointOrdinals,
  ].sort((left, right) => left - right);
  if (
    JSON.stringify(actualCheckpointOrdinals) !==
    JSON.stringify(expectedOrderedCheckpointOrdinals)
  )
    throw new GeneratorContractError(
      "invariant",
      "checkpoint stages do not match the deterministic cadence policy",
    );
  const checkpointAdjustmentFinding = spec.findings.find(
    (finding) => finding.code === "checkpoint-cadence-adjusted",
  );
  const expectedCheckpointRelatedIds = expectedOrderedCheckpointOrdinals.map(
    (ordinal) => `stage-${String(ordinal).padStart(2, "0")}`,
  );
  if (
    expectedCheckpointAdjustment !==
      (checkpointAdjustmentFinding !== undefined) ||
    (checkpointAdjustmentFinding !== undefined &&
      JSON.stringify(checkpointAdjustmentFinding.relatedIds) !==
        JSON.stringify(expectedCheckpointRelatedIds))
  )
    throw new GeneratorContractError(
      "invariant",
      "checkpoint adjustment finding does not match cadence semantics",
    );
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
    routeNodeById.get(spec.finish.routeNodeId)?.kind !== "finish"
  )
    throw new GeneratorContractError(
      "invariant",
      "finish must follow final playable stage",
    );
  const visualIds = new Set(
    spec.visualStyleIntents.map((item) => item.visualStyleIntentId),
  );
  const assetIds = new Set(spec.assetIntents.map((item) => item.assetIntentId));
  const assetById = new Map(
    spec.assetIntents.map((item) => [item.assetIntentId, item]),
  );
  const mechanicIntentIds = new Set(
    spec.mechanicIntents.map((item) => item.mechanicIntentId),
  );
  const difficultyBandIds = new Set(
    spec.difficultyPlan.bands.map((item) => item.difficultyBandId),
  );
  const hazardIds = new Set(spec.hazards.map((item) => item.hazardId));
  const hazardById = new Map(spec.hazards.map((item) => [item.hazardId, item]));
  const checkpointIds = new Set(
    spec.checkpoints.map((item) => item.checkpointId),
  );
  const checkpointByStageId = new Map(
    spec.checkpoints.map((item) => [item.stageId, item]),
  );
  for (const [index, band] of spec.difficultyPlan.bands.entries())
    if (
      band.stageId !== spec.stages[index]?.stageId ||
      band.ordinal !== index + 1 ||
      spec.stages.at(index)?.difficultyBandId !== band.difficultyBandId
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `difficulty band ${band.difficultyBandId} does not bind its ordinal stage`,
      );
  for (const intent of spec.mechanicIntents) {
    const stage = stageById.get(intent.stageId);
    if (
      stage?.mechanicIntentIds.length !== 1 ||
      stage.mechanicIntentIds[0] !== intent.mechanicIntentId
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `mechanic intent ${intent.mechanicIntentId} is not bound to its stage`,
      );
  }
  for (const hazard of spec.hazards) {
    const stage = stageById.get(hazard.stageId);
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
    const stage = stageById.get(checkpoint.stageId);
    if (stage?.checkpointId !== checkpoint.checkpointId)
      throw new GeneratorContractError(
        "invalid-reference",
        `checkpoint ${checkpoint.checkpointId} is not bound to its stage`,
      );
  }
  for (const stage of spec.stages) {
    assertCanonicalSet(stage.mechanicIntentIds, `${stage.stageId} mechanics`);
    assertCanonicalSet(stage.hazardIds, `${stage.stageId} hazards`);
    assertCanonicalSet(stage.assetIntentIds, `${stage.stageId} assets`);
    if (
      !visualIds.has(stage.visualStyleIntentId) ||
      stage.assetIntentIds.some((id) => !assetIds.has(id)) ||
      stage.mechanicIntentIds.some((id) => !mechanicIntentIds.has(id)) ||
      !difficultyBandIds.has(stage.difficultyBandId) ||
      stage.hazardIds.some(
        (id) =>
          !hazardIds.has(id) || hazardById.get(id)?.stageId !== stage.stageId,
      ) ||
      (stage.checkpointId !== undefined &&
        !checkpointIds.has(stage.checkpointId))
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `stage ${stage.stageId} has an unknown intent reference`,
      );
    const routeNode = playableRouteNodes[stage.ordinal - 1];
    const checkpointForStage = checkpointByStageId.get(stage.stageId);
    if (
      (routeNode?.kind === "checkpoint") !==
        (checkpointForStage !== undefined) ||
      stage.checkpointId !== checkpointForStage?.checkpointId
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `stage ${stage.stageId} has inconsistent checkpoint bindings`,
      );
    const authoritativeAssets = stage.assetIntentIds.filter(
      (id) => assetById.get(id)?.authority === "gameplay-authoritative",
    );
    if (authoritativeAssets.length === 0)
      throw new GeneratorContractError(
        "invariant",
        `stage ${stage.stageId} lacks gameplay-authoritative native-Part intent`,
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
  const usedAssetIds = new Set(
    spec.stages.flatMap((stage) => stage.assetIntentIds),
  );
  const usedVisualIds = new Set([
    ...spec.stages.map((stage) => stage.visualStyleIntentId),
    ...spec.hazards.map((hazard) => hazard.visualStyleIntentId),
  ]);
  if (
    spec.assetIntents.some((asset) => !usedAssetIds.has(asset.assetIntentId)) ||
    spec.visualStyleIntents.some(
      (visual) => !usedVisualIds.has(visual.visualStyleIntentId),
    )
  )
    throw new GeneratorContractError(
      "invalid-reference",
      "asset and visual intents must be used by the validated plan",
    );
  for (const asset of spec.assetIntents) {
    assertCanonicalSet(asset.styleTags, `${asset.assetIntentId} style tags`);
    assertCanonicalSet(
      asset.prohibitedContentTags,
      `${asset.assetIntentId} prohibited tags`,
    );
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
      asset.scope === "stage" &&
      !stageById
        .get(asset.stageId ?? "")
        ?.assetIntentIds.includes(asset.assetIntentId)
    )
      throw new GeneratorContractError(
        "invalid-reference",
        `stage-scoped asset ${asset.assetIntentId} is not used by its stage`,
      );
    if (
      asset.authority === "decorative" &&
      asset.collisionPolicy !== "non-colliding"
    )
      throw new GeneratorContractError(
        "invariant",
        "decorative assets must remain non-colliding",
      );
    if (
      (asset.authority === "decorative" &&
        asset.semanticRole !== "decoration") ||
      (asset.authority === "gameplay-authoritative" &&
        (asset.semanticRole === "decoration" ||
          asset.collisionPolicy !== "native-parts-colliding")) ||
      asset.preferredSourcePolicy !== normalizedRequest.assetPolicy ||
      (normalizedRequest.assetPolicy === "native-parts-only" &&
        asset.requiredAuditStatus !== "not-required-native") ||
      (normalizedRequest.assetPolicy !== "native-parts-only" &&
        asset.requiredAuditStatus !== "required-before-use")
    )
      throw new GeneratorContractError(
        "invariant",
        `asset ${asset.assetIntentId} conflicts with authority or request policy`,
      );
  }
  for (const visual of spec.visualStyleIntents) {
    assertCanonicalSet(visual.styleTags, `${visual.visualStyleIntentId} tags`);
    if (
      visual.themeFamily !== normalizedRequest.theme ||
      visual.paletteIntent !== `${normalizedRequest.theme}-high-contrast` ||
      JSON.stringify(visual.styleTags) !==
        JSON.stringify(normalizedRequest.visualStylePreferences) ||
      visual.decorativeMotionIntent !==
        (normalizedRequest.accessibilityConstraints.includes("reduced-motion")
          ? "none"
          : "deferred")
    )
      throw new GeneratorContractError(
        "invariant",
        `visual ${visual.visualStyleIntentId} conflicts with request theme`,
      );
  }
  {
    const mechanics = new Map(
      catalog.mechanics.map((item) => [item.mechanicId, item]),
    );
    const availableCapabilities = new Set(["native-parts"]);
    if (configuration.allowDeferredMechanics)
      availableCapabilities.add("runtime-mechanic");
    for (const intent of spec.mechanicIntents) {
      const mechanic = mechanics.get(intent.mechanicId);
      if (mechanic === undefined)
        throw new GeneratorContractError("unknown-mechanic", intent.mechanicId);
      if (normalizedRequest.excludedMechanics.includes(intent.mechanicId))
        throw new GeneratorContractError(
          "invariant",
          `excluded mechanic ${intent.mechanicId} was planned`,
        );
      const stageIndex = stageIndexById.get(intent.stageId) ?? -1;
      const intentLevel = spec.difficultyPlan.bands[stageIndex]?.intentLevel;
      if (
        intentLevel === undefined ||
        intentLevel < mechanic.minimumDifficulty ||
        intentLevel > mechanic.maximumDifficulty
      )
        throw new GeneratorContractError(
          "invariant",
          `${intent.mechanicId} is outside its catalog difficulty bounds`,
        );
      if (
        mechanic.requiredCapabilities.some(
          (capability) => !availableCapabilities.has(capability),
        )
      )
        throw new GeneratorContractError(
          "invariant",
          `${intent.mechanicId} requires an unavailable capability`,
        );
      if (
        mechanic.capability !== "g1-static-supported" &&
        !configuration.allowDeferredMechanics
      )
        throw new GeneratorContractError(
          "deferred-mechanic",
          `${intent.mechanicId} is not buildable under the validated configuration`,
        );
    }
    for (const hazard of spec.hazards) {
      const stage = stageById.get(hazard.stageId);
      const stageMechanics = (stage?.mechanicIntentIds ?? []).map(
        (intentId) => mechanicIntentById.get(intentId)?.mechanicId,
      );
      const definition = mechanics.get(hazard.mechanicId);
      if (
        definition === undefined ||
        !stageMechanics.includes(hazard.mechanicId) ||
        !definition.compatibleHazardKinds.includes(hazard.kind) ||
        (definition.capability !== "g1-static-supported" &&
          !configuration.allowDeferredMechanics)
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
        .map((id) => mechanicIntentById.get(id))
        .filter((intent) => intent !== undefined);
      const currentMechanics = currentStage.mechanicIntentIds
        .map((id) => mechanicIntentById.get(id))
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
    let previousMechanicId: string | undefined;
    let repeated = 0;
    for (const stage of spec.stages) {
      const intent = mechanicIntentById.get(stage.mechanicIntentIds[0]);
      if (intent === undefined) continue;
      repeated = intent.mechanicId === previousMechanicId ? repeated + 1 : 1;
      const limit = mechanics.get(intent.mechanicId)?.repetitionLimit;
      if (limit === undefined || repeated > limit)
        throw new GeneratorContractError(
          "invariant",
          `mechanic ${intent.mechanicId} exceeds its repetition limit`,
        );
      previousMechanicId = intent.mechanicId;
    }
  }
  const introducedMechanics = new Set<string>();
  for (const stage of spec.stages)
    for (const intentId of stage.mechanicIntentIds) {
      const intent = mechanicIntentById.get(intentId);
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
  let lastRecoveryIndex: number | undefined;
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
    const targetPeak =
      spec.difficultyPlan.targetDifficulty === "easy"
        ? 3
        : spec.difficultyPlan.targetDifficulty === "medium"
          ? 4
          : 5;
    if (
      index === spec.difficultyPlan.bands.length - 1 &&
      (currentBand.band !== "climax" || current !== targetPeak)
    )
      throw new GeneratorContractError(
        "invariant",
        "final difficulty band must equal the requested target peak",
      );
    if (
      currentBand.band === "recovery" &&
      (current > previous ||
        previous < targetPeak ||
        (lastRecoveryIndex !== undefined && index - lastRecoveryIndex < 4))
    )
      throw new GeneratorContractError(
        "invariant",
        "recovery must immediately follow a target-difficulty peak",
      );
    if (currentBand.band === "recovery") lastRecoveryIndex = index;
    else if (index < spec.difficultyPlan.bands.length - 1) {
      const expectedBand =
        current === 2 ? "easy" : current === 3 ? "medium" : "hard";
      if (currentBand.band !== expectedBand)
        throw new GeneratorContractError(
          "invariant",
          "non-recovery difficulty band does not match its intent level",
        );
    }
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
  catalog: MechanicCatalog,
): asserts input is NormalizedGenerationRequest {
  if (arguments.length < 2)
    throw new GeneratorContractError(
      "invariant",
      "normalized request validation requires a mechanic catalog",
    );
  assertValidMechanicCatalog(catalog);
  assertStructural("NormalizedGenerationRequest", input);
  const value = record(
    input,
    "NormalizedGenerationRequest",
  ) as unknown as NormalizedGenerationRequest;
  const canonicalSet = (items: readonly string[]): string[] =>
    [...new Set(items.map((item) => item.normalize("NFC").trim()))].sort(
      compareUnicodeScalars,
    );
  const setFields = [
    value.supportedMechanicPreferences,
    value.excludedMechanics,
    value.visualStylePreferences,
    value.accessibilityConstraints,
  ] as const;
  if (
    value.workingName !==
      value.workingName.normalize("NFC").trim().replace(/\s+/gu, " ") ||
    value.workingName.length === 0 ||
    (value.brief !== undefined &&
      (value.brief !== value.brief.normalize("NFC") ||
        value.brief.trim().length === 0)) ||
    !Number.isSafeInteger(value.seed) ||
    value.seed < 0 ||
    value.seed > 0xffff_ffff ||
    !Number.isInteger(value.targetSessionDurationMinutes) ||
    value.targetSessionDurationMinutes < 1 ||
    value.targetSessionDurationMinutes > 120 ||
    !Number.isInteger(value.stageCount) ||
    value.stageCount < 5 ||
    value.stageCount > 50 ||
    !Number.isInteger(value.checkpointFrequency) ||
    value.checkpointFrequency < 1 ||
    value.checkpointFrequency > value.stageCount ||
    setFields.some(
      (items) => JSON.stringify(items) !== JSON.stringify(canonicalSet(items)),
    )
  )
    throw new GeneratorContractError(
      "invariant",
      "normalized request contains non-canonical or out-of-range semantics",
    );
  const knownMechanics = new Set(
    catalog.mechanics.map((mechanic) => mechanic.mechanicId),
  );
  for (const mechanicId of [
    ...value.supportedMechanicPreferences,
    ...value.excludedMechanics,
  ])
    if (!knownMechanics.has(mechanicId))
      throw new GeneratorContractError(
        "unknown-mechanic",
        `normalized request references unknown mechanic ${mechanicId}`,
      );
  const overlap = value.supportedMechanicPreferences.filter((mechanicId) =>
    value.excludedMechanics.includes(mechanicId),
  );
  if (overlap.length > 0)
    throw new GeneratorContractError(
      "contradictory-mechanics",
      `normalized request prefers and excludes ${overlap.join(", ")}`,
    );
  if (
    value.accessibilityConstraints.includes("reduced-motion") &&
    (value.accessibilityConstraints.includes("motion-required") ||
      value.visualStylePreferences.includes("animated-decor"))
  )
    throw new GeneratorContractError(
      "contradictory-accessibility",
      "normalized request contains contradictory motion requirements",
    );
  const requestPreimage = {
    schemaVersion: value.schemaVersion,
    workingName: value.workingName,
    genre: value.genre,
    theme: value.theme,
    targetAudience: value.targetAudience,
    targetSessionDurationMinutes: value.targetSessionDurationMinutes,
    stageCount: value.stageCount,
    difficulty: value.difficulty,
    checkpointFrequency: value.checkpointFrequency,
    supportedMechanicPreferences: value.supportedMechanicPreferences,
    excludedMechanics: value.excludedMechanics,
    visualStylePreferences: value.visualStylePreferences,
    assetPolicy: value.assetPolicy,
    accessibilityConstraints: value.accessibilityConstraints,
    seed: value.seed,
    ...(value.brief === undefined ? {} : { brief: value.brief }),
  };
  const expectedRequestHash = hashGeneratorPreimage(
    requestPreimage,
    "generationRequestHash",
  );
  if (
    value.generationRequestHash !== expectedRequestHash ||
    value.normalizedRequestId !==
      `normalized-${expectedRequestHash.slice(7, 23)}`
  )
    throw new GeneratorContractError(
      "hash-mismatch",
      "normalized request derived identity does not match its semantics",
    );
  assertContentHash(value, "normalizedRequestHash");
}

export function assertValidGenerationBundle(
  input: unknown,
  catalog: MechanicCatalog,
  configuration: GeneratorConfiguration,
): asserts input is GenerationBundle {
  if (arguments.length < 3)
    throw new GeneratorContractError(
      "invariant",
      "full GenerationBundle validation requires catalog and configuration context",
    );
  assertValidGeneratorConfiguration(configuration);
  assertValidMechanicCatalog(catalog);
  assertStructural("GenerationBundle", input);
  const bundle = record(
    input,
    "GenerationBundle",
  ) as unknown as GenerationBundle;
  assertValidNormalizedGenerationRequest(bundle.normalizedRequest, catalog);
  assertValidObbySpec(
    bundle.obbySpec,
    catalog,
    configuration,
    bundle.normalizedRequest,
  );
  if (
    bundle.generationRequestHash !==
      bundle.normalizedRequest.generationRequestHash ||
    bundle.generationBundleId !==
      `bundle-${bundle.obbySpec.obbySpecHash.slice(7, 23)}`
  )
    throw new GeneratorContractError(
      "invalid-reference",
      "bundle request or stable identity does not match validated content",
    );
  if (bundle.catalogHash !== catalog.catalogHash)
    throw new GeneratorContractError(
      "invalid-reference",
      "bundle catalogHash does not match the validated catalog",
    );
  if (
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
  if (bundle.configurationHash !== configuration.configurationHash)
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
