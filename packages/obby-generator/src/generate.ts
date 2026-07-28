import { compareUnicodeScalars } from "@obby/canonical-json";
import {
  GeneratorContractError,
  assertValidGenerationBundle,
  assertValidGeneratorConfiguration,
  assertValidMechanicCatalog,
  assertValidObbySpec,
  hashGeneratorPreimage,
} from "@obby/obby-generator-contracts";
import type {
  AssetIntent,
  CheckpointSpec,
  DifficultyBand,
  DifficultyBandName,
  DifficultyPlan,
  FinishSpec,
  GenerationBundle,
  GenerationFinding,
  GenerationLimitation,
  GeneratorConfiguration,
  HazardSpec,
  MechanicCatalog,
  MechanicDefinition,
  MechanicIntent,
  ObbySpec,
  ProgressionIntent,
  RetentionIntent,
  RouteNodeSpec,
  RouteSpec,
  RouteTransitionSpec,
  StageRole,
  StageSpec,
  VisualStyleIntent,
} from "@obby/obby-generator-contracts";

import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
} from "./catalog.js";
import { normalizeGenerationRequest } from "./normalize.js";
import {
  ownDataValue,
  plainArrayLength,
  plainDataRecord,
  snapshotPlainData,
} from "./plain-data.js";
import { DeterministicRandom, deriveDomainSeed } from "./prng.js";

export type GenerationCoveredOperation =
  | "input-snapshot"
  | "configuration-validation"
  | "catalog-validation"
  | "request-normalization"
  | "planning"
  | "hashing"
  | "prng-derivation"
  | "graph-validation"
  | "bundle-validation"
  | "serialization-preparation";

export type GenerationWorkAdmission = {
  requiredWorkUnits: number;
  admittedWorkUnits: number;
  availableWorkUnits: number;
  unusedWorkUnits: number;
};

export type GenerateObbyOptions = {
  onWorkAdmitted?: (admission: GenerationWorkAdmission) => void;
  onCoveredOperation?: (operation: GenerationCoveredOperation) => void;
};

const PALETTE_BY_THEME = {
  classic: "classic-high-contrast",
  sky: "sky-high-contrast",
  space: "space-high-contrast",
  lava: "lava-high-contrast",
  jungle: "jungle-high-contrast",
} as const satisfies Record<
  VisualStyleIntent["themeFamily"],
  VisualStyleIntent["paletteIntent"]
>;

function contentAddress<T extends object, K extends string>(
  value: T,
  hashField: K,
): T & Record<K, `sha256:${string}`> {
  return {
    ...value,
    [hashField]: hashGeneratorPreimage(value, hashField),
  } as T & Record<K, `sha256:${string}`>;
}

function difficultySequence(
  stageCount: number,
  target: "easy" | "medium" | "hard",
  maximumLocalDelta: number,
): { band: DifficultyBandName; level: 1 | 2 | 3 | 4 | 5 }[] {
  const peak = target === "easy" ? 3 : target === "medium" ? 4 : 5;
  const result: { band: DifficultyBandName; level: 1 | 2 | 3 | 4 | 5 }[] = [];
  let lastRecoveryOrdinal: number | undefined;
  for (let ordinal = 1; ordinal <= stageCount; ordinal += 1) {
    let level: 1 | 2 | 3 | 4 | 5;
    let band: DifficultyBandName;
    if (ordinal === 1) {
      level = 1;
      band = "tutorial";
    } else if (ordinal === stageCount) {
      level = peak;
      band = "climax";
    } else if (
      (result.at(-1)?.level ?? 1) >= peak &&
      (lastRecoveryOrdinal === undefined || ordinal - lastRecoveryOrdinal >= 4)
    ) {
      const previous = result.at(-1)?.level ?? 2;
      level = Math.max(1, previous - maximumLocalDelta) as 1 | 2 | 3 | 4;
      band = "recovery";
      lastRecoveryOrdinal = ordinal;
    } else {
      const progress = (ordinal - 1) / (stageCount - 1);
      level = Math.max(
        2,
        Math.min(peak, 1 + Math.ceil(progress * (peak - 1))),
      ) as 2 | 3 | 4 | 5;
      band = level === 2 ? "easy" : level === 3 ? "medium" : "hard";
    }
    const previous = result.at(-1)?.level;
    if (
      previous !== undefined &&
      Math.abs(level - previous) > maximumLocalDelta
    )
      level = (previous + Math.sign(level - previous) * maximumLocalDelta) as
        1 | 2 | 3 | 4 | 5;
    if (band !== "tutorial" && band !== "climax" && band !== "recovery")
      band =
        level === 1
          ? "tutorial"
          : level === 2
            ? "easy"
            : level === 3
              ? "medium"
              : "hard";
    result.push({ band, level });
  }
  return result;
}

function stageRole(
  ordinal: number,
  count: number,
  band: DifficultyBandName,
): StageRole {
  if (ordinal === 1) return "onboarding";
  if (ordinal === count) return "finish-approach";
  if (ordinal === count - 1) return "climax";
  if (band === "recovery") return "recovery";
  if (ordinal <= 3) return "practice";
  if (ordinal % 5 === 0) return "challenge";
  return ordinal % 2 === 0 ? "variation" : "escalation";
}

function selectMechanics(
  request: ReturnType<typeof normalizeGenerationRequest>,
  configuration: GeneratorConfiguration,
  catalog: MechanicCatalog,
): MechanicDefinition[] {
  const byId = new Map(
    catalog.mechanics.map((item) => [item.mechanicId, item]),
  );
  for (const requested of request.supportedMechanicPreferences) {
    const mechanic = byId.get(requested);
    if (mechanic === undefined)
      throw new GeneratorContractError(
        "unknown-mechanic",
        `unknown preferred mechanic ${requested}`,
      );
    if (
      mechanic.capability !== "g1-static-supported" &&
      !configuration.allowDeferredMechanics
    )
      throw new GeneratorContractError(
        "deferred-mechanic",
        `${requested} requires a deferred capability`,
      );
  }
  for (const excluded of request.excludedMechanics)
    if (!byId.has(excluded))
      throw new GeneratorContractError(
        "unknown-mechanic",
        `unknown excluded mechanic ${excluded}`,
      );
  const candidates = catalog.mechanics.filter(
    (item) =>
      !["checkpoint-recovery", "finish-approach"].includes(item.mechanicId) &&
      (item.capability === "g1-static-supported" ||
        configuration.allowDeferredMechanics) &&
      !request.excludedMechanics.includes(item.mechanicId) &&
      !(
        request.accessibilityConstraints.includes("reduced-motion") &&
        item.accessibilityImplications.includes("reduced-motion")
      ),
  );
  if (candidates.length === 0)
    throw new GeneratorContractError(
      "invariant",
      "at least one permitted mechanic is required",
    );
  return candidates.sort((left, right) =>
    compareUnicodeScalars(left.mechanicId, right.mechanicId),
  );
}

export function estimateGenerationWorkUnits(
  stageCount: number,
  mechanicDefinitionCount: number,
): number {
  if (
    !Number.isSafeInteger(stageCount) ||
    stageCount < 0 ||
    !Number.isSafeInteger(mechanicDefinitionCount) ||
    mechanicDefinitionCount < 0
  )
    throw new GeneratorContractError(
      "work-limit",
      "work estimate inputs must be non-negative safe integers",
    );
  const units =
    4_000 +
    120 * stageCount +
    100 * mechanicDefinitionCount +
    4 * stageCount * mechanicDefinitionCount;
  if (!Number.isSafeInteger(units))
    throw new GeneratorContractError("work-limit", "work estimate overflow");
  return units;
}

export function preflightGenerationWorkAdmission(
  requestInput: unknown,
  configurationInput: unknown,
  catalogInput: unknown,
): GenerationWorkAdmission {
  const request = plainDataRecord(requestInput, "request");
  const configuration = plainDataRecord(configurationInput, "configuration");
  const limits = plainDataRecord(
    ownDataValue(configuration, "limits", "configuration"),
    "configuration limits",
  );
  const catalog = plainDataRecord(catalogInput, "mechanic catalog");
  const explicitStageCount = ownDataValue(
    request,
    "stageCount",
    "request",
    false,
  );
  const stageCount = explicitStageCount === undefined ? 15 : explicitStageCount;
  const mechanicCount = plainArrayLength(
    ownDataValue(catalog, "mechanics", "mechanic catalog"),
    "mechanic catalog mechanics",
  );
  const availableWorkUnits = ownDataValue(
    limits,
    "maxWorkUnits",
    "configuration limits",
  );
  if (
    !Number.isSafeInteger(stageCount) ||
    (stageCount as number) < 0 ||
    !Number.isSafeInteger(availableWorkUnits) ||
    (availableWorkUnits as number) < 0
  )
    throw new GeneratorContractError(
      "validation",
      "work admission requires bounded stage, catalog, and budget facts",
    );
  const requiredWorkUnits = estimateGenerationWorkUnits(
    stageCount as number,
    mechanicCount,
  );
  if (requiredWorkUnits > (availableWorkUnits as number))
    throw new GeneratorContractError(
      "maximum-work-units",
      "generation requires more work units than the configured maximum",
    );
  return {
    requiredWorkUnits,
    admittedWorkUnits: requiredWorkUnits,
    availableWorkUnits: availableWorkUnits as number,
    unusedWorkUnits: (availableWorkUnits as number) - requiredWorkUnits,
  };
}

function weightedMechanicChoice(
  random: DeterministicRandom,
  candidates: readonly MechanicDefinition[],
): MechanicDefinition {
  const totalWeight = candidates.reduce(
    (total, mechanic) => total + mechanic.selectionWeight,
    0,
  );
  if (!Number.isSafeInteger(totalWeight) || totalWeight < 1)
    throw new GeneratorContractError(
      "invariant",
      "mechanic selection weights must form a positive safe integer total",
    );
  let draw = random.integer(1, totalWeight);
  for (const mechanic of candidates) {
    draw -= mechanic.selectionWeight;
    if (draw <= 0) return mechanic;
  }
  throw new GeneratorContractError(
    "invariant",
    "weighted mechanic selection exhausted its candidates",
  );
}

export function generateObby(
  requestInput: unknown,
  configurationInput: unknown = DEFAULT_GENERATOR_CONFIGURATION,
  catalogInput: unknown = DEFAULT_MECHANIC_CATALOG,
  options: GenerateObbyOptions = {},
): GenerationBundle {
  const admission = preflightGenerationWorkAdmission(
    requestInput,
    configurationInput,
    catalogInput,
  );
  options.onWorkAdmitted?.(admission);
  options.onCoveredOperation?.("input-snapshot");
  const requestSnapshot = snapshotPlainData(requestInput, "request") as Record<
    string,
    unknown
  >;
  const configuration = snapshotPlainData(
    configurationInput,
    "configuration",
  ) as GeneratorConfiguration;
  const catalog = snapshotPlainData(
    catalogInput,
    "mechanic catalog",
  ) as MechanicCatalog;
  options.onCoveredOperation?.("configuration-validation");
  assertValidGeneratorConfiguration(configuration);
  options.onCoveredOperation?.("catalog-validation");
  assertValidMechanicCatalog(catalog);
  options.onCoveredOperation?.("request-normalization");
  const request = normalizeGenerationRequest(requestSnapshot, catalog);
  options.onCoveredOperation?.("planning");
  const candidates = selectMechanics(request, configuration, catalog);
  const fallbackMechanic = candidates[0];
  if (fallbackMechanic === undefined)
    throw new GeneratorContractError(
      "invariant",
      "at least one permitted mechanic is required",
    );
  const foundationMechanic =
    catalog.mechanics.find(
      (item) =>
        item.mechanicId === "static-jumps" &&
        !request.excludedMechanics.includes(item.mechanicId),
    ) ?? fallbackMechanic;
  const difficulty = difficultySequence(
    request.stageCount,
    request.difficulty,
    configuration.difficultyDeltaLimit,
  );
  options.onCoveredOperation?.("hashing");
  const seedIdentity = hashGeneratorPreimage(
    {
      schemaVersion: "0.1",
      normalizedRequestHash: request.normalizedRequestHash,
      configurationHash: configuration.configurationHash,
      catalogHash: catalog.catalogHash,
      prngAlgorithm: configuration.prngAlgorithm,
      seed: request.seed,
    },
    "seedIdentity",
  );
  options.onCoveredOperation?.("prng-derivation");
  const mechanicRandom = new DeterministicRandom(
    deriveDomainSeed(seedIdentity, "mechanics"),
  );
  const checkpointOrdinals = new Set<number>();
  let checkpointCadenceAdjusted = false;
  for (
    let ordinal = request.checkpointFrequency;
    ordinal < request.stageCount;
    ordinal += request.checkpointFrequency
  ) {
    const currentDifficulty = difficulty[ordinal - 1];
    const nextDifficulty = difficulty[ordinal];
    const adjustedOrdinal =
      currentDifficulty !== undefined &&
      currentDifficulty.level >= 4 &&
      nextDifficulty?.band === "recovery" &&
      ordinal + 1 < request.stageCount
        ? ordinal + 1
        : ordinal;
    let availableOrdinal = adjustedOrdinal;
    if (availableOrdinal !== ordinal) checkpointCadenceAdjusted = true;
    if (checkpointOrdinals.has(availableOrdinal)) {
      checkpointCadenceAdjusted = true;
      const candidates: number[] = [];
      for (let distance = 1; distance < request.stageCount; distance += 1) {
        if (availableOrdinal + distance < request.stageCount)
          candidates.push(availableOrdinal + distance);
        if (availableOrdinal - distance >= 1)
          candidates.push(availableOrdinal - distance);
      }
      const replacement = candidates.find(
        (candidate) => !checkpointOrdinals.has(candidate),
      );
      if (replacement === undefined)
        throw new GeneratorContractError(
          "invariant",
          "checkpoint cadence has no collision-free stage",
        );
      availableOrdinal = replacement;
    }
    checkpointOrdinals.add(availableOrdinal);
  }

  const visualPreimage = {
    schemaVersion: "0.1" as const,
    visualStyleIntentId: "visual-global",
    themeFamily: request.theme,
    paletteIntent: PALETTE_BY_THEME[request.theme],
    materialFamily: "native-roblox-materials" as const,
    lightingMoodIntent:
      request.theme === "lava" ? ("dramatic" as const) : ("bright" as const),
    shapeLanguage: "blocky-readable" as const,
    density:
      request.difficulty === "hard"
        ? ("high" as const)
        : request.difficulty === "easy"
          ? ("low" as const)
          : ("medium" as const),
    readabilityPriority: "high" as const,
    landmarkCadenceStages: Math.max(3, request.checkpointFrequency),
    decorativeMotionIntent: request.accessibilityConstraints.includes(
      "reduced-motion",
    )
      ? ("none" as const)
      : ("deferred" as const),
    uiTone: "clear-encouraging" as const,
    styleTags: request.visualStylePreferences,
  };
  const visualStyle: VisualStyleIntent = contentAddress(
    visualPreimage,
    "visualStyleIntentHash",
  );
  const assetSeeds: Omit<AssetIntent, "assetIntentHash">[] = [
    {
      schemaVersion: "0.1",
      assetIntentId: "asset-gameplay-route",
      semanticRole: "gameplay-route",
      scope: "global",
      authority: "gameplay-authoritative",
      preferredSourcePolicy: request.assetPolicy,
      nativePartFallback: true,
      collisionPolicy: "native-parts-colliding",
      scaleIntent: "readable-player-scale",
      styleTags: [request.theme],
      prohibitedContentTags: ["executable-code", "unreviewed-external"],
      requiredAuditStatus:
        request.assetPolicy === "native-parts-only"
          ? "not-required-native"
          : "required-before-use",
    },
    {
      schemaVersion: "0.1",
      assetIntentId: "asset-decoration",
      semanticRole: "decoration",
      scope: "global",
      authority: "decorative",
      preferredSourcePolicy: request.assetPolicy,
      nativePartFallback: true,
      collisionPolicy: "non-colliding",
      scaleIntent: "readable-player-scale",
      styleTags: [request.theme],
      prohibitedContentTags: ["gameplay-collision", "unreviewed-external"],
      requiredAuditStatus:
        request.assetPolicy === "native-parts-only"
          ? "not-required-native"
          : "required-before-use",
    },
  ];
  const assetIntents = assetSeeds
    .map((item) => contentAddress(item, "assetIntentHash"))
    .sort((left, right) =>
      compareUnicodeScalars(left.assetIntentId, right.assetIntentId),
    );

  const mechanicIntents: MechanicIntent[] = [];
  const used = new Map<string, number>();
  const selectedMechanics: MechanicDefinition[] = [];
  const preferredMechanics = new Set(request.supportedMechanicPreferences);
  let consecutiveMechanicId: string | undefined;
  let consecutiveMechanicCount = 0;
  for (let ordinal = 1; ordinal <= request.stageCount; ordinal += 1) {
    let mechanic: MechanicDefinition;
    const stageDifficulty = difficulty[ordinal - 1];
    if (stageDifficulty === undefined)
      throw new GeneratorContractError(
        "invariant",
        "difficulty sequence is incomplete",
      );
    const canUse = (
      candidate: MechanicDefinition | undefined,
    ): candidate is MechanicDefinition =>
      candidate !== undefined &&
      !request.excludedMechanics.includes(candidate.mechanicId) &&
      candidate.minimumDifficulty <= stageDifficulty.level &&
      candidate.maximumDifficulty >= stageDifficulty.level &&
      candidate.requiredCapabilities.every(
        (capability) =>
          capability === "native-parts" || configuration.allowDeferredMechanics,
      ) &&
      (candidate.mechanicId !== consecutiveMechanicId ||
        consecutiveMechanicCount < candidate.repetitionLimit);
    const finishMechanic = catalog.mechanics.find(
      (item) => item.mechanicId === "finish-approach",
    );
    const recoveryMechanic = catalog.mechanics.find(
      (item) => item.mechanicId === "checkpoint-recovery",
    );
    if (ordinal === request.stageCount && canUse(finishMechanic))
      mechanic = finishMechanic;
    else if (
      difficulty[ordinal - 1]?.band === "recovery" &&
      canUse(recoveryMechanic)
    )
      mechanic = recoveryMechanic;
    else {
      const previous = selectedMechanics.at(-1)?.mechanicId;
      const previousDefinition =
        previous === undefined
          ? undefined
          : catalog.mechanics.find((item) => item.mechanicId === previous);
      let eligible = candidates.filter(
        (candidate) =>
          candidate.minimumDifficulty <= stageDifficulty.level &&
          candidate.maximumDifficulty >= stageDifficulty.level &&
          candidate.requiredCapabilities.every(
            (capability) =>
              capability === "native-parts" ||
              configuration.allowDeferredMechanics,
          ),
      );
      if (eligible.length === 0) eligible = [foundationMechanic];
      const compatible = eligible.filter(
        (candidate) =>
          previous === undefined ||
          (!candidate.forbiddenAdjacentMechanicIds.includes(previous) &&
            !previousDefinition?.forbiddenAdjacentMechanicIds.includes(
              candidate.mechanicId,
            )),
      );
      const withinRepetitionLimit = compatible.filter(
        (candidate) =>
          candidate.mechanicId !== consecutiveMechanicId ||
          consecutiveMechanicCount < candidate.repetitionLimit,
      );
      const preferred = withinRepetitionLimit.filter((candidate) =>
        preferredMechanics.has(candidate.mechanicId),
      );
      const available =
        preferred.length > 0 ? preferred : withinRepetitionLimit;
      if (available.length === 0)
        throw new GeneratorContractError(
          "invariant",
          `no compatible mechanic can follow ${String(previous)}`,
        );
      mechanic = weightedMechanicChoice(mechanicRandom, available);
    }
    if (
      mechanic.mechanicId === consecutiveMechanicId &&
      consecutiveMechanicCount >= mechanic.repetitionLimit
    )
      throw new GeneratorContractError(
        "invariant",
        `no catalog-compliant repetition is available for stage ${ordinal}`,
      );
    consecutiveMechanicCount =
      mechanic.mechanicId === consecutiveMechanicId
        ? consecutiveMechanicCount + 1
        : 1;
    consecutiveMechanicId = mechanic.mechanicId;
    selectedMechanics.push(mechanic);
    const count = used.get(mechanic.mechanicId) ?? 0;
    used.set(mechanic.mechanicId, count + 1);
    const intentSeed = {
      schemaVersion: "0.1" as const,
      mechanicIntentId: `mechanic-intent-${String(ordinal).padStart(2, "0")}`,
      stageId: `stage-${String(ordinal).padStart(2, "0")}`,
      mechanicId: mechanic.mechanicId,
      mechanicVersion: mechanic.mechanicVersion,
      use:
        count === 0
          ? ("introduce" as const)
          : ordinal > request.stageCount * 0.7
            ? ("intensify" as const)
            : ("practice" as const),
    };
    mechanicIntents.push(contentAddress(intentSeed, "mechanicIntentHash"));
  }

  const difficultyBands: DifficultyBand[] = difficulty.map((entry, index) => {
    const ordinal = index + 1;
    const seed = {
      schemaVersion: "0.1" as const,
      difficultyBandId: `difficulty-${String(ordinal).padStart(2, "0")}`,
      stageId: `stage-${String(ordinal).padStart(2, "0")}`,
      ordinal,
      band: entry.band,
      intentLevel: entry.level,
    };
    return contentAddress(seed, "difficultyBandHash");
  });
  const difficultyPlanSeed = {
    schemaVersion: "0.1" as const,
    difficultyPlanId: "difficulty-plan-main",
    targetDifficulty: request.difficulty,
    maximumLocalDelta: configuration.difficultyDeltaLimit,
    empiricalStatus: "design-intent-not-validated" as const,
    bands: difficultyBands,
  };
  const difficultyPlan: DifficultyPlan = contentAddress(
    difficultyPlanSeed,
    "difficultyPlanHash",
  );

  const hazards: HazardSpec[] = [];
  for (let ordinal = 2; ordinal <= request.stageCount; ordinal += 1) {
    const selected = selectedMechanics[ordinal - 1];
    if (selected === undefined)
      throw new GeneratorContractError(
        "invariant",
        "mechanic sequence is incomplete",
      );
    if (ordinal % 3 !== 0 && selected.mechanicId !== "hazard-avoidance")
      continue;
    const kind =
      selected.capability === "g1-static-supported"
        ? ordinal % 2 === 0
          ? ("kill-part" as const)
          : ("fall-void" as const)
        : selected.mechanicId === "moving-platform"
          ? ("moving-obstacle-intent" as const)
          : ("timed-contact-intent" as const);
    const seed = {
      schemaVersion: "0.1" as const,
      hazardId: `hazard-${String(ordinal).padStart(2, "0")}`,
      kind,
      stageId: `stage-${String(ordinal).padStart(2, "0")}`,
      mechanicId: selected.mechanicId,
      gameplayAuthority: "native-gameplay" as const,
      failureReset: "last-checkpoint" as const,
      severity:
        ordinal < 5
          ? ("low" as const)
          : difficulty[ordinal - 1]?.level === 5
            ? ("high" as const)
            : ("medium" as const),
      visualStyleIntentId: visualStyle.visualStyleIntentId,
    };
    hazards.push(contentAddress(seed, "hazardHash"));
  }

  const routeNodes: RouteNodeSpec[] = [];
  routeNodes.push(
    contentAddress(
      {
        schemaVersion: "0.1" as const,
        routeNodeId: "route-start",
        kind: "start" as const,
        required: true as const,
      },
      "routeNodeHash",
    ),
  );
  for (let ordinal = 1; ordinal <= request.stageCount; ordinal += 1) {
    routeNodes.push(
      contentAddress(
        {
          schemaVersion: "0.1" as const,
          routeNodeId: `route-stage-${String(ordinal).padStart(2, "0")}`,
          kind: checkpointOrdinals.has(ordinal)
            ? ("checkpoint" as const)
            : ("stage" as const),
          stageId: `stage-${String(ordinal).padStart(2, "0")}`,
          required: true as const,
        },
        "routeNodeHash",
      ),
    );
  }
  routeNodes.push(
    contentAddress(
      {
        schemaVersion: "0.1" as const,
        routeNodeId: "route-finish",
        kind: "finish" as const,
        required: true as const,
      },
      "routeNodeHash",
    ),
  );
  const orderedNodeIds = routeNodes.map((node) => node.routeNodeId);
  const transitions: RouteTransitionSpec[] = orderedNodeIds
    .slice(0, -1)
    .map((fromNodeId, index) => {
      const toNodeId = orderedNodeIds[index + 1];
      if (toNodeId === undefined)
        throw new GeneratorContractError(
          "invariant",
          "route transition target is missing",
        );
      return contentAddress(
        {
          schemaVersion: "0.1" as const,
          routeTransitionId: `transition-${String(index + 1).padStart(2, "0")}`,
          fromNodeId,
          toNodeId,
          intent: "required-safe-progression" as const,
          required: true as const,
        },
        "routeTransitionHash",
      );
    });
  const routeSeed = {
    schemaVersion: "0.1" as const,
    routeId: "required-safe-route",
    startNodeId: "route-start",
    finishNodeId: "route-finish",
    orderedNodeIds,
    nodes: routeNodes,
    transitions,
  };
  const route: RouteSpec = contentAddress(routeSeed, "routeHash");

  const checkpoints: CheckpointSpec[] = [...checkpointOrdinals]
    .sort((a, b) => a - b)
    .map((ordinal) =>
      contentAddress(
        {
          schemaVersion: "0.1" as const,
          checkpointId: `checkpoint-${String(ordinal).padStart(2, "0")}`,
          stageId: `stage-${String(ordinal).padStart(2, "0")}`,
          routeNodeId: `route-stage-${String(ordinal).padStart(2, "0")}`,
          routeOrder: ordinal,
          respawnIntent: "center-safe-platform" as const,
        },
        "checkpointHash",
      ),
    );
  const checkpointByStage = new Map(
    checkpoints.map((item) => [item.stageId, item.checkpointId]),
  );
  const hazardByStage = new Map(
    hazards.map((item) => [item.stageId, item.hazardId]),
  );
  const stages: StageSpec[] = difficulty.map((entry, index) => {
    const ordinal = index + 1;
    const stageId = `stage-${String(ordinal).padStart(2, "0")}`;
    const checkpointId = checkpointByStage.get(stageId);
    const hazardId = hazardByStage.get(stageId);
    const mechanicIntent = mechanicIntents[index];
    const difficultyBand = difficultyBands[index];
    if (mechanicIntent === undefined || difficultyBand === undefined)
      throw new GeneratorContractError(
        "invariant",
        "stage intent sequence is incomplete",
      );
    const seed = {
      schemaVersion: "0.1" as const,
      stageId,
      ordinal,
      role: stageRole(ordinal, request.stageCount, entry.band),
      mechanicIntentIds: [mechanicIntent.mechanicIntentId] as [string],
      difficultyBandId: difficultyBand.difficultyBandId,
      estimatedCompletionSeconds: {
        minimum: 20 + entry.level * 5,
        maximum: 45 + entry.level * 15,
      },
      failureReset:
        checkpointId === undefined
          ? ("last-checkpoint" as const)
          : ("stage-start" as const),
      hazardIds: hazardId === undefined ? [] : [hazardId],
      ...(checkpointId === undefined ? {} : { checkpointId }),
      assetIntentIds: assetIntents.map((item) => item.assetIntentId),
      visualStyleIntentId: visualStyle.visualStyleIntentId,
    };
    return contentAddress(seed, "stageHash");
  });
  const finalStage = stages.at(-1);
  if (finalStage === undefined)
    throw new GeneratorContractError("invariant", "final stage is missing");
  const finish: FinishSpec = contentAddress(
    {
      schemaVersion: "0.1" as const,
      finishId: "finish-main",
      routeNodeId: "route-finish",
      afterStageId: finalStage.stageId,
      readability: "high" as const,
    },
    "finishHash",
  );
  const progressionIntent: ProgressionIntent = contentAddress(
    {
      schemaVersion: "0.1" as const,
      progressionIntentId: "progression-main",
      onboardingClarity: "high" as const,
      earlySuccess: "prioritized" as const,
      visibleProgress: "stage-and-checkpoint" as const,
      finishReadability: "high" as const,
    },
    "progressionIntentHash",
  );
  const retentionIntent: RetentionIntent = contentAddress(
    {
      schemaVersion: "0.1" as const,
      retentionIntentId: "retention-main",
      status: "design-intent-not-prediction" as const,
      checkpointCadence: request.checkpointFrequency,
      mechanicNoveltyCadence: Math.max(
        2,
        Math.floor(request.stageCount / Math.max(1, candidates.length)),
      ),
      recoveryPacing: "after-peaks" as const,
      landmarkCadence: visualStyle.landmarkCadenceStages,
      climaxTiming: "late" as const,
      replayVariationAllowance: "seeded-only" as const,
    },
    "retentionIntentHash",
  );
  const limitationSeeds: Omit<GenerationLimitation, "limitationHash">[] = [
    {
      schemaVersion: "0.1",
      limitationId: "limitation-abstract",
      code: "abstract-plan-only",
      message:
        "Exact geometry, coordinates, physics, and Roblox instances are deferred to G1.",
      relatedIds: [],
    },
    {
      schemaVersion: "0.1",
      limitationId: "limitation-runtime",
      code: "no-runtime-evidence",
      message:
        "Difficulty is design intent; no runtime or player evidence was collected.",
      relatedIds: [],
    },
    {
      schemaVersion: "0.1",
      limitationId: "limitation-retention",
      code: "retention-not-predicted",
      message:
        "Retention fields are pacing intents, not analytics-derived predictions.",
      relatedIds: [],
    },
  ];
  const deferredIds = [
    ...new Set(
      selectedMechanics
        .filter((item) => item.capability !== "g1-static-supported")
        .map((item) => item.mechanicId),
    ),
  ].sort(compareUnicodeScalars);
  if (deferredIds.length > 0)
    limitationSeeds.push({
      schemaVersion: "0.1",
      limitationId: "limitation-deferred",
      code: "deferred-mechanic",
      message: "One or more mechanics require a later runtime capability.",
      relatedIds: deferredIds,
    });
  const limitations = limitationSeeds.map((item) =>
    contentAddress(item, "limitationHash"),
  );
  const findingSeeds: Omit<GenerationFinding, "findingHash">[] = [];
  if (checkpointCadenceAdjusted)
    findingSeeds.push({
      schemaVersion: "0.1",
      findingId: "finding-checkpoint-cadence-adjusted",
      code: "checkpoint-cadence-adjusted",
      severity: "information",
      message:
        "Checkpoint cadence was deterministically adjusted to avoid a collision or follow a recovery peak.",
      relatedIds: [...checkpointOrdinals]
        .sort((left, right) => left - right)
        .map((ordinal) => `stage-${String(ordinal).padStart(2, "0")}`),
    });
  const varietyCandidates =
    request.supportedMechanicPreferences.length > 0
      ? candidates.filter((item) => preferredMechanics.has(item.mechanicId))
      : candidates;
  if (varietyCandidates.length < 3)
    findingSeeds.push({
      schemaVersion: "0.1",
      findingId: "finding-low-variety",
      code: "limited-mechanic-variety",
      severity: "warning",
      message:
        "Request constraints leave fewer than three mechanics for variation.",
      relatedIds: varietyCandidates.map((item) => item.mechanicId),
    });
  if (deferredIds.length > 0)
    findingSeeds.push({
      schemaVersion: "0.1",
      findingId: "finding-deferred",
      code: "deferred-capability-planned",
      severity: "information",
      message:
        "Deferred mechanics are intent only and are not currently buildable.",
      relatedIds: deferredIds,
    });
  const findings = findingSeeds.map((item) =>
    contentAddress(item, "findingHash"),
  );

  const obbySpecSeed = {
    schemaVersion: "0.1" as const,
    obbySpecId: `obby-${request.normalizedRequestHash.slice(7, 23)}`,
    normalizedRequestHash: request.normalizedRequestHash,
    configurationHash: configuration.configurationHash,
    catalogHash: catalog.catalogHash,
    generatorVersion: configuration.generatorVersion,
    prngAlgorithm: configuration.prngAlgorithm,
    seed: request.seed,
    seedIdentity,
    game: {
      title: request.workingName,
      genre: "obby" as const,
      targetAudience: request.targetAudience,
      targetSessionDurationMinutes: request.targetSessionDurationMinutes,
    },
    stages,
    mechanicIntents,
    route,
    checkpoints,
    hazards,
    finish,
    difficultyPlan,
    visualStyleIntents: [visualStyle],
    assetIntents,
    progressionIntent,
    retentionIntent,
    limitations,
    findings,
  };
  const obbySpec: ObbySpec = contentAddress(obbySpecSeed, "obbySpecHash");
  options.onCoveredOperation?.("graph-validation");
  assertValidObbySpec(obbySpec, catalog, configuration, request);
  const bundleSeed = {
    schemaVersion: "0.1" as const,
    generationBundleId: `bundle-${obbySpec.obbySpecHash.slice(7, 23)}`,
    generationRequestHash: request.generationRequestHash,
    normalizedRequest: request,
    configurationHash: configuration.configurationHash,
    catalogHash: catalog.catalogHash,
    obbySpec,
    limitations,
    findings,
  };
  const bundle: GenerationBundle = contentAddress(
    bundleSeed,
    "generationBundleHash",
  );
  options.onCoveredOperation?.("bundle-validation");
  assertValidGenerationBundle(bundle, catalog, configuration);
  options.onCoveredOperation?.("serialization-preparation");
  return bundle;
}
