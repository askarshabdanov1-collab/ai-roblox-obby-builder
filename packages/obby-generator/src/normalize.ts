import { compareUnicodeScalars } from "@obby/canonical-json";
import {
  GeneratorContractError,
  assertValidNormalizedGenerationRequest,
  hashGeneratorPreimage,
  parseGenerationRequest,
} from "@obby/obby-generator-contracts";
import type {
  GenerationRequest,
  MechanicCatalog,
  NormalizedGenerationRequest,
} from "@obby/obby-generator-contracts";

import { DEFAULT_MECHANIC_CATALOG } from "./catalog.js";

const semanticSet = (values: readonly string[] | undefined): string[] =>
  [
    ...new Set((values ?? []).map((value) => value.normalize("NFC").trim())),
  ].sort(compareUnicodeScalars);

export function normalizeGenerationRequest(
  input: unknown,
  catalog: MechanicCatalog = DEFAULT_MECHANIC_CATALOG,
): NormalizedGenerationRequest {
  const request = parseGenerationRequest(input);
  const stageCount = request.stageCount ?? 15;
  if (!Number.isInteger(stageCount) || stageCount < 5 || stageCount > 50)
    throw new GeneratorContractError(
      "stage-count",
      "stageCount must be an integer from 5 through 50",
    );
  const checkpointFrequency = request.checkpointFrequency ?? 5;
  if (
    !Number.isInteger(checkpointFrequency) ||
    checkpointFrequency < 1 ||
    checkpointFrequency > stageCount
  )
    throw new GeneratorContractError(
      "checkpoint-frequency",
      "checkpointFrequency must be an integer from 1 through stageCount",
    );
  const preferences = semanticSet(request.supportedMechanicPreferences);
  const excluded = semanticSet(request.excludedMechanics);
  const overlap = preferences.filter((id) => excluded.includes(id));
  if (overlap.length > 0)
    throw new GeneratorContractError(
      "contradictory-mechanics",
      `mechanics cannot be preferred and excluded: ${overlap.join(", ")}`,
    );
  const accessibility = semanticSet(
    request.accessibilityConstraints,
  ) as NormalizedGenerationRequest["accessibilityConstraints"];
  const visualStyles = semanticSet(
    request.visualStylePreferences,
  ) as NormalizedGenerationRequest["visualStylePreferences"];
  if (
    accessibility.includes("reduced-motion") &&
    (accessibility.includes("motion-required") ||
      visualStyles.includes("animated-decor"))
  )
    throw new GeneratorContractError(
      "contradictory-accessibility",
      "reduced-motion contradicts required motion intent",
    );
  const workingName = request.workingName
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");
  if (workingName.length === 0)
    throw new GeneratorContractError(
      "schema",
      "workingName cannot normalize to empty",
    );
  const theme = request.theme ?? "classic";
  const targetAudience = request.targetAudience ?? "general";
  const targetSessionDurationMinutes =
    request.targetSessionDurationMinutes ?? 12;
  const difficulty = request.difficulty ?? "medium";
  const assetPolicy = request.assetPolicy ?? "native-parts-only";
  const requestHashPreimage: Omit<
    GenerationRequest,
    "requestId" | "generationRequestHash"
  > = {
    schemaVersion: "0.1",
    workingName,
    genre: "obby",
    theme,
    targetAudience,
    targetSessionDurationMinutes,
    stageCount,
    difficulty,
    checkpointFrequency,
    supportedMechanicPreferences: preferences,
    excludedMechanics: excluded,
    visualStylePreferences: visualStyles,
    assetPolicy,
    accessibilityConstraints: accessibility,
    seed: request.seed,
    ...(request.brief === undefined
      ? {}
      : { brief: request.brief.normalize("NFC") }),
  };
  const generationRequestHash = hashGeneratorPreimage(
    requestHashPreimage,
    "generationRequestHash",
  );
  if (
    request.generationRequestHash !== undefined &&
    request.generationRequestHash !== generationRequestHash
  )
    throw new GeneratorContractError(
      "hash-mismatch",
      "generationRequestHash content mismatch",
    );
  const normalizedPreimage = {
    schemaVersion: "0.1" as const,
    normalizedRequestId: `normalized-${generationRequestHash.slice(7, 23)}`,
    generationRequestHash,
    workingName,
    genre: "obby" as const,
    theme,
    targetAudience,
    targetSessionDurationMinutes,
    stageCount,
    difficulty,
    checkpointFrequency,
    supportedMechanicPreferences: preferences,
    excludedMechanics: excluded,
    visualStylePreferences: visualStyles,
    assetPolicy,
    accessibilityConstraints: accessibility,
    seed: request.seed,
    ...(request.brief === undefined
      ? {}
      : { brief: request.brief.normalize("NFC") }),
  };
  const normalized = {
    ...normalizedPreimage,
    normalizedRequestHash: hashGeneratorPreimage(
      normalizedPreimage,
      "normalizedRequestHash",
    ),
  };
  assertValidNormalizedGenerationRequest(normalized, catalog);
  return normalized;
}
