import {
  ownDataValue,
  plainArrayLength,
  plainDataRecord,
  snapshotPlainData,
} from "@obby/obby-generator";

import {
  LayoutEngineError,
  type LayoutWorkAdmission,
  type LayoutWorkEstimateInput,
} from "./types.js";

function boundedCount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new LayoutEngineError(
      "work-limit",
      `${label} must be a non-negative safe integer`,
    );
  return value;
}

export function estimateLayoutWorkUnits(
  input: LayoutWorkEstimateInput,
): number {
  const stageCount = boundedCount(input.stageCount, "stageCount");
  const definitionCount = boundedCount(
    input.definitionCount,
    "definitionCount",
  );
  const hazardCount = boundedCount(input.hazardCount, "hazardCount");
  const assetIntentCount = boundedCount(
    input.assetIntentCount,
    "assetIntentCount",
  );
  const units =
    6_000 +
    240 * stageCount +
    120 * definitionCount +
    80 * hazardCount +
    12 * assetIntentCount +
    8 * stageCount * definitionCount;
  if (!Number.isSafeInteger(units))
    throw new LayoutEngineError("work-limit", "layout work estimate overflow");
  return units;
}

export function admitLayoutSnapshot(
  sourceInput: unknown,
  configurationInput: unknown,
  definitionInputs: unknown,
): LayoutWorkAdmission {
  const source = plainDataRecord(sourceInput, "GenerationBundle");
  const obbySpec = plainDataRecord(
    ownDataValue(source, "obbySpec", "GenerationBundle"),
    "GenerationBundle.obbySpec",
  );
  const stageCount = plainArrayLength(
    ownDataValue(obbySpec, "stages", "GenerationBundle.obbySpec"),
    "GenerationBundle.obbySpec.stages",
  );
  const hazardCount = plainArrayLength(
    ownDataValue(obbySpec, "hazards", "GenerationBundle.obbySpec"),
    "GenerationBundle.obbySpec.hazards",
  );
  const assetIntentCount = plainArrayLength(
    ownDataValue(obbySpec, "assetIntents", "GenerationBundle.obbySpec"),
    "GenerationBundle.obbySpec.assetIntents",
  );
  const definitionCount = plainArrayLength(
    definitionInputs,
    "MechanicLayoutDefinition authorities",
  );
  const configuration = plainDataRecord(
    configurationInput,
    "LayoutConfiguration",
  );
  const limits = plainDataRecord(
    ownDataValue(configuration, "limits", "LayoutConfiguration"),
    "LayoutConfiguration.limits",
  );
  const availableWorkUnits = ownDataValue(
    limits,
    "maxWorkUnits",
    "LayoutConfiguration.limits",
  );
  if (
    !Number.isSafeInteger(availableWorkUnits) ||
    (availableWorkUnits as number) < 0
  )
    throw new LayoutEngineError(
      "validation",
      "layout work admission requires a non-negative safe-integer maximum",
    );
  const requiredWorkUnits = estimateLayoutWorkUnits({
    stageCount,
    definitionCount,
    hazardCount,
    assetIntentCount,
  });
  if (requiredWorkUnits > (availableWorkUnits as number))
    throw new LayoutEngineError(
      "maximum-work-units",
      "layout generation requires more work units than the configured maximum",
    );
  return Object.freeze({
    requiredWorkUnits,
    admittedWorkUnits: requiredWorkUnits,
    availableWorkUnits: availableWorkUnits as number,
    unusedWorkUnits: (availableWorkUnits as number) - requiredWorkUnits,
  });
}

export function preflightLayoutWorkAdmission(
  sourceInput: unknown,
  configurationInput: unknown,
  definitionInputs: unknown,
): LayoutWorkAdmission {
  const source = snapshotPlainData(sourceInput, "GenerationBundle");
  const configuration = snapshotPlainData(
    configurationInput,
    "LayoutConfiguration",
  );
  const definitions = snapshotPlainData(
    definitionInputs,
    "MechanicLayoutDefinition authorities",
  );
  return admitLayoutSnapshot(source, configuration, definitions);
}
