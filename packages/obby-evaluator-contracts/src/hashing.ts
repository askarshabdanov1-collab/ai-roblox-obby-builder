import {
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  canonicalizeEvaluatorSnapshot,
  sha256Bytes,
  sortSemanticSet,
} from "@obby/canonical-json";

import type {
  AvailabilityRecord,
  CalculationBundlePreimage,
  ControllerProfile,
  EvidenceRecord,
  EvaluationPlan,
  EvaluationRequest,
  MetricCatalog,
  MetricDefinition,
  ScoringProfile,
} from "./generated/evaluator-contracts.js";
import {
  parseAvailabilityRecord,
  parseCalculationBundlePreimage,
  parseControllerProfile,
  parseEvaluationPlan,
  parseEvaluationRequest,
  parseEvidenceRecord,
  parseMetricCatalog,
  parseMetricDefinition,
  parseScoringProfile,
} from "./validation.js";

export type NamedHashResult = {
  hash: `sha256:${string}`;
  canonicalBytes: Uint8Array;
};

export class ContentHashMismatchError extends Error {
  public constructor(
    public readonly identityName: string,
    public readonly expected: string,
    public readonly actual: string | undefined,
  ) {
    super(
      `${identityName} content hash mismatch: expected ${expected}, received ${
        actual ?? "missing"
      }`,
    );
    this.name = "ContentHashMismatchError";
  }
}

function namedHash(payload: Record<string, unknown>): NamedHashResult {
  const preimage = {
    canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
    ...payload,
  };
  const canonical = canonicalizeEvaluatorSnapshot(preimage);
  return {
    hash: sha256Bytes(canonical.canonicalBytes),
    canonicalBytes: canonical.canonicalBytes,
  };
}

const strings = (values: readonly string[]): string[] =>
  sortSemanticSet(values, (value) => value);

const records = <T>(
  values: readonly T[],
  stableKey: (value: T) => string,
): T[] => sortSemanticSet(values, stableKey);

function omitFields<T extends object, K extends keyof T>(
  value: T,
  fields: readonly K[],
): Omit<T, K> {
  const result: Partial<T> = { ...value };
  for (const field of fields) {
    Reflect.deleteProperty(result, field);
  }
  return result as Omit<T, K>;
}

export function hashMetricDefinition(input: unknown): NamedHashResult {
  const definition = parseMetricDefinition(input);
  const payload = omitFields(definition, ["metricDefinitionHash"]);
  return namedHash({
    ...payload,
    limitationsTemplate: strings(payload.limitationsTemplate),
    parentMetricIds: strings(payload.parentMetricIds),
    requiredCapabilities: strings(payload.requiredCapabilities),
    requiredEvidenceKinds: strings(payload.requiredEvidenceKinds),
    thresholds: records(
      payload.thresholds,
      (threshold) => threshold.thresholdId,
    ),
  });
}

export function hashMetricCatalog(input: unknown): NamedHashResult {
  const catalog = parseMetricCatalog(input);
  const payload = omitFields(catalog, ["metricCatalogHash"]);
  return namedHash({
    ...payload,
    invariantGates: records(
      payload.invariantGates.map((gate) => ({
        ...gate,
        requiredEvidenceKinds: strings(gate.requiredEvidenceKinds),
      })),
      (gate) => gate.invariantId,
    ),
    metricDefinitions: records(
      payload.metricDefinitions,
      (definition) => `${definition.metricId}@${definition.metricVersion}`,
    ),
    supportedVersions: records(
      payload.supportedVersions,
      (version) => version.component,
    ),
  });
}

export function hashScoringProfile(input: unknown): NamedHashResult {
  const profile = parseScoringProfile(input);
  const payload = omitFields(profile, ["scoringProfileHash"]);
  return namedHash({
    ...payload,
    categories: records(
      payload.categories.map((category) => ({
        ...category,
        metricIds: strings(category.metricIds),
      })),
      (category) => category.categoryId,
    ),
    invariantGateIds: strings(payload.invariantGateIds),
    optionalMetricIds: strings(payload.optionalMetricIds),
    requiredMetricIds: strings(payload.requiredMetricIds),
    thresholds: records(
      payload.thresholds,
      (threshold) => threshold.thresholdId,
    ),
  });
}

function evaluationPlanConfiguration(
  plan: EvaluationPlan,
): Record<string, unknown> {
  const payload = omitFields(plan, ["configurationHash", "createdAt"]);
  return {
    ...payload,
    metricExclude: strings(payload.metricExclude),
    metricInclude: strings(payload.metricInclude),
    requiredCapabilities: strings(payload.requiredCapabilities),
  };
}

export function hashEvaluationPlanConfiguration(
  input: unknown,
): NamedHashResult {
  return namedHash(evaluationPlanConfiguration(parseEvaluationPlan(input)));
}

function evaluationRequestPreimage(
  request: EvaluationRequest,
): Record<string, unknown> {
  const payload = omitFields(request, [
    "callerId",
    "evaluationRequestHash",
    "requestId",
    "retryAttempt",
    "submittedAt",
    "transport",
  ]);
  return {
    ...payload,
    requestedEvidenceRequirements: {
      ...payload.requestedEvidenceRequirements,
      coverageProfileIds: strings(
        payload.requestedEvidenceRequirements.coverageProfileIds,
      ),
      evidenceKindIds: strings(
        payload.requestedEvidenceRequirements.evidenceKindIds,
      ),
      requiredCapabilityIds: strings(
        payload.requestedEvidenceRequirements.requiredCapabilityIds,
      ),
    },
  };
}

export function hashEvaluationRequest(input: unknown): NamedHashResult {
  return namedHash(evaluationRequestPreimage(parseEvaluationRequest(input)));
}

function evidencePayload(evidence: EvidenceRecord): Record<string, unknown> {
  const payload = { ...evidence.payload };
  const reproduction =
    "reproduction" in evidence.payload
      ? {
          ...evidence.payload.reproduction,
          inputHashes: strings(evidence.payload.reproduction.inputHashes),
        }
      : undefined;
  if (evidence.payload.kind === "geometry-fact") {
    return {
      ...payload,
      objectIds: strings(evidence.payload.objectIds),
      ...(reproduction === undefined ? {} : { reproduction }),
    };
  }
  if (evidence.payload.kind === "skip-candidate") {
    return {
      ...payload,
      candidateKinds: strings(evidence.payload.candidateKinds),
      skippedStageIndexes: evidence.payload.skippedStageIndexes.toSorted(
        (left, right) => left - right,
      ),
      reproduction,
    };
  }
  if (evidence.payload.kind === "coarse-transition-state") {
    return {
      ...payload,
      inputEvidenceHashes: strings(evidence.payload.inputEvidenceHashes),
      reasonCodes: strings(evidence.payload.reasonCodes),
      landingRegion: {
        ...evidence.payload.landingRegion,
        ...(evidence.payload.landingRegion.status === "unavailable"
          ? {
              missingEvidenceHashes: strings(
                evidence.payload.landingRegion.missingEvidenceHashes,
              ),
            }
          : {}),
        limitations: strings(evidence.payload.landingRegion.limitations),
      },
      reproduction,
    };
  }
  return {
    ...payload,
    ...(reproduction === undefined ? {} : { reproduction }),
  };
}

export function hashEvidenceContent(input: unknown): NamedHashResult {
  const evidence = parseEvidenceRecord(input);
  const payload = omitFields(evidence, [
    "capturedAt",
    "evidenceContentHash",
    "evidenceId",
    "executionId",
  ]);
  return namedHash({
    ...payload,
    artifactHashes: records(
      payload.artifactHashes,
      (artifact) => `${artifact.role}:${artifact.contentHash}`,
    ),
    limitations: strings(payload.limitations),
    parentEvidenceHashes: strings(payload.parentEvidenceHashes),
    payload: evidencePayload(evidence),
    quality: {
      ...payload.quality,
      validityCodes: strings(payload.quality.validityCodes),
    },
  });
}

export function hashCalculationBundle(input: unknown): NamedHashResult {
  const calculation = parseCalculationBundlePreimage(input);
  const payload: Omit<CalculationBundlePreimage, "calculationBundleHash"> =
    omitFields(calculation, ["calculationBundleHash"]);
  return namedHash({
    ...payload,
    evidence: records(
      payload.evidence,
      (item) => `${item.kind}:${item.subjectKey}:${item.evidenceContentHash}`,
    ),
    ruleVersions: records(
      payload.ruleVersions,
      (version) => `${version.component}@${version.version}`,
    ),
  });
}

export function hashAvailabilityRecord(input: unknown): NamedHashResult {
  const validated: AvailabilityRecord = parseAvailabilityRecord(input);
  const payload = omitFields(validated, ["availabilityRecordHash"]);
  return namedHash({
    ...payload,
    impactScope: {
      ...payload.impactScope,
      affectedIdentityHashes: strings(
        payload.impactScope.affectedIdentityHashes,
      ),
    },
    reasonDetails: records(
      payload.reasonDetails,
      (detail) => `${detail.code}:${detail.value}`,
    ),
    supersedesAvailabilityRecordHashes: strings(
      payload.supersedesAvailabilityRecordHashes,
    ),
  });
}

export function hashControllerProfile(input: unknown): NamedHashResult {
  const profile = parseControllerProfile(input);
  const payload = omitFields(profile, ["controllerProfileHash"]);
  return namedHash({
    ...payload,
    limitations: strings(payload.limitations),
    supportedSurfaceKinds: strings(payload.supportedSurfaceKinds),
  });
}

function assertHash(
  identityName: string,
  expected: string,
  actual: string | undefined,
): void {
  if (actual !== expected) {
    throw new ContentHashMismatchError(identityName, expected, actual);
  }
}

export function verifyMetricDefinitionIdentity(
  input: unknown,
): MetricDefinition {
  const value = parseMetricDefinition(input);
  assertHash(
    "metricDefinitionHash",
    hashMetricDefinition(value).hash,
    value.metricDefinitionHash,
  );
  return value;
}

export function verifyMetricCatalogIdentity(input: unknown): MetricCatalog {
  const value = parseMetricCatalog(input);
  assertHash(
    "metricCatalogHash",
    hashMetricCatalog(value).hash,
    value.metricCatalogHash,
  );
  return value;
}

export function verifyScoringProfileIdentity(input: unknown): ScoringProfile {
  const value = parseScoringProfile(input);
  assertHash(
    "scoringProfileHash",
    hashScoringProfile(value).hash,
    value.scoringProfileHash,
  );
  return value;
}

export function verifyEvaluationPlanConfigurationIdentity(
  input: unknown,
): EvaluationPlan {
  const value = parseEvaluationPlan(input);
  assertHash(
    "configurationHash",
    hashEvaluationPlanConfiguration(value).hash,
    value.configurationHash,
  );
  return value;
}

export function verifyEvaluationRequestIdentity(
  input: unknown,
): EvaluationRequest {
  const value = parseEvaluationRequest(input);
  assertHash(
    "evaluationRequestHash",
    hashEvaluationRequest(value).hash,
    value.evaluationRequestHash,
  );
  return value;
}

export function verifyEvidenceContentIdentity(input: unknown): EvidenceRecord {
  const value = parseEvidenceRecord(input);
  assertHash(
    "evidenceContentHash",
    hashEvidenceContent(value).hash,
    value.evidenceContentHash,
  );
  return value;
}

export function verifyCalculationBundleIdentity(
  input: unknown,
): CalculationBundlePreimage {
  const value = parseCalculationBundlePreimage(input);
  assertHash(
    "calculationBundleHash",
    hashCalculationBundle(value).hash,
    value.calculationBundleHash,
  );
  return value;
}

export function verifyAvailabilityRecordIdentity(
  input: unknown,
): AvailabilityRecord {
  const value = parseAvailabilityRecord(input);
  assertHash(
    "availabilityRecordHash",
    hashAvailabilityRecord(value).hash,
    value.availabilityRecordHash,
  );
  return value;
}

export function verifyControllerProfileIdentity(
  input: unknown,
): ControllerProfile {
  const value = parseControllerProfile(input);
  assertHash(
    "controllerProfileHash",
    hashControllerProfile(value).hash,
    value.controllerProfileHash,
  );
  return value;
}

export type { MetricCatalog, MetricDefinition, ScoringProfile };
