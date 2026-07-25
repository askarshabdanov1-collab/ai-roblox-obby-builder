import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

import schema from "../schemas/evaluator-contracts.schema.json" with { type: "json" };
import type {
  AvailabilityRecord,
  CalculationBundlePreimage,
  EvaluationMetric,
  EvaluationPlan,
  EvaluationRequest,
  EvaluationRun,
  EvidenceRecord,
  EvaluationSubject,
  Finding,
  GeometryObjectInput,
  MetricCatalog,
  MetricDefinition,
  RuntimeObservationContent,
  RuntimeObservationEnvelope,
  ScoringProfile,
  TransitionInput,
} from "./generated/evaluator-contracts.js";

export type ContractIssue = {
  kind: "semantic" | "structural";
  code: string;
  path: string;
  message: string;
};

export type ValidationResult<T> =
  { ok: true; value: T; issues: [] } | { ok: false; issues: ContractIssue[] };

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: false,
  strict: true,
  strictNumbers: true,
  validateFormats: false,
});
ajv.addSchema(schema);

function validator<T>(definition: string): ValidateFunction<T> {
  return ajv.compile<T>({
    $ref: `${schema.$id}#/$defs/${definition}`,
  });
}

const validators = {
  AvailabilityRecord: validator<AvailabilityRecord>(
    "AvailabilityRecordContract",
  ),
  CalculationBundlePreimage: validator<CalculationBundlePreimage>(
    "CalculationBundlePreimage",
  ),
  EvaluationMetric: validator<EvaluationMetric>("EvaluationMetric"),
  EvaluationPlan: validator<EvaluationPlan>("EvaluationPlan"),
  EvaluationRequest: validator<EvaluationRequest>("EvaluationRequest"),
  EvaluationRun: validator<EvaluationRun>("EvaluationRun"),
  EvidenceRecord: validator<EvidenceRecord>("EvidenceRecordContract"),
  EvaluationSubject: validator<EvaluationSubject>("EvaluationSubject"),
  Finding: validator<Finding>("Finding"),
  GeometryObjectInput: validator<GeometryObjectInput>("GeometryObjectInput"),
  MetricCatalog: validator<MetricCatalog>("MetricCatalog"),
  MetricDefinition: validator<MetricDefinition>("MetricDefinition"),
  RuntimeObservationContent: validator<RuntimeObservationContent>(
    "RuntimeObservationContentContract",
  ),
  RuntimeObservationEnvelope: validator<RuntimeObservationEnvelope>(
    "RuntimeObservationEnvelope",
  ),
  ScoringProfile: validator<ScoringProfile>("ScoringProfile"),
  TransitionInput: validator<TransitionInput>("TransitionInput"),
} as const;

function structuralIssues(
  errors: ErrorObject[] | null | undefined,
): ContractIssue[] {
  return (errors ?? []).map((error) => ({
    kind: "structural",
    code: error.keyword,
    path: error.instancePath || "/",
    message: error.message ?? "schema validation failed",
  }));
}

function semanticIssue(
  code: string,
  path: string,
  message: string,
): ContractIssue {
  return { kind: "semantic", code, path, message };
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function semanticMetricDefinitionIssues(
  value: MetricDefinition,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const derived = value.resultKind === "derived-composite";
  if (derived !== value.parentMetricIds.length > 0) {
    issues.push(
      semanticIssue(
        "derived-parent-metrics",
        "/parentMetricIds",
        "derived composites require parent metrics, and other result kinds prohibit them",
      ),
    );
  }
  if (
    value.blockingEligibility === "invariant" &&
    value.invariantGateId === undefined
  ) {
    issues.push(
      semanticIssue(
        "missing-invariant-gate",
        "/invariantGateId",
        "invariant blocking eligibility requires an invariant gate",
      ),
    );
  }
  if (
    value.thresholds.some(
      (threshold) =>
        threshold.thresholdKind === "invariant" &&
        threshold.classification !== "invariant",
    )
  ) {
    issues.push(
      semanticIssue(
        "invariant-threshold-classification",
        "/thresholds",
        "invariant thresholds must be classified invariant",
      ),
    );
  }
  return issues;
}

function semanticMetricCatalogIssues(value: MetricCatalog): ContractIssue[] {
  const issues: ContractIssue[] = [];
  for (const duplicate of duplicateValues(
    value.metricDefinitions.map(
      (definition) => `${definition.metricId}@${definition.metricVersion}`,
    ),
  )) {
    issues.push(
      semanticIssue(
        "duplicate-metric-definition",
        "/metricDefinitions",
        `duplicate metric definition ${duplicate}`,
      ),
    );
  }
  for (const duplicate of duplicateValues(
    value.invariantGates.map((gate) => gate.invariantId),
  )) {
    issues.push(
      semanticIssue(
        "duplicate-invariant-gate",
        "/invariantGates",
        `duplicate invariant gate ${duplicate}`,
      ),
    );
  }
  return issues;
}

function semanticScoringProfileIssues(value: ScoringProfile): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const required = new Set(value.requiredMetricIds);
  const overlap = value.optionalMetricIds.filter((id) => required.has(id));
  if (overlap.length > 0) {
    issues.push(
      semanticIssue(
        "metric-requirement-overlap",
        "/optionalMetricIds",
        `metrics cannot be both required and optional: ${overlap.join(", ")}`,
      ),
    );
  }
  const selected = new Set([
    ...value.requiredMetricIds,
    ...value.optionalMetricIds,
  ]);
  for (const category of value.categories) {
    for (const metricId of category.metricIds) {
      if (!selected.has(metricId)) {
        issues.push(
          semanticIssue(
            "unselected-category-metric",
            "/categories",
            `category references unselected metric ${metricId}`,
          ),
        );
      }
    }
  }
  return issues;
}

function semanticEvaluationMetricIssues(
  value: EvaluationMetric,
): ContractIssue[] {
  const expectedSource = {
    "analytics-derived-estimate": "analytics-derived",
    "derived-composite": "derived",
    "deterministic-fact": "deterministic",
    "heuristic-estimate": "heuristic",
    "human-judgment": "subjective",
    "learned-estimate": "learned",
  } as const;
  if (value.sourceKind !== expectedSource[value.resultKind]) {
    return [
      semanticIssue(
        "source-result-mismatch",
        "/sourceKind",
        `${value.resultKind} requires sourceKind ${expectedSource[value.resultKind]}`,
      ),
    ];
  }
  return [];
}

function semanticTransitionIssues(value: TransitionInput): ContractIssue[] {
  const expected =
    `route:${value.fromObjectId}/${value.toObjectId}/` +
    `${value.fromGlobalIndex}/${value.toGlobalIndex}`;
  return value.transitionId === expected
    ? []
    : [
        semanticIssue(
          "transition-identity",
          "/transitionId",
          `transitionId must equal ${expected}`,
        ),
      ];
}

function validate<T>(
  name: keyof typeof validators,
  input: unknown,
  semantics: (value: T) => ContractIssue[] = () => [],
): ValidationResult<T> {
  const validateStructure = validators[name] as ValidateFunction<T>;
  if (!validateStructure(input)) {
    return { ok: false, issues: structuralIssues(validateStructure.errors) };
  }
  const issues = semantics(input);
  return issues.length === 0
    ? { ok: true, value: input, issues: [] }
    : { ok: false, issues };
}

function parse<T>(
  name: keyof typeof validators,
  input: unknown,
  semantics?: (value: T) => ContractIssue[],
): T {
  const result = validate<T>(name, input, semantics);
  if (!result.ok) throw new ContractValidationError(name, result.issues);
  return result.value;
}

export const parseMetricDefinition = (input: unknown): MetricDefinition =>
  parse("MetricDefinition", input, semanticMetricDefinitionIssues);
export const parseMetricCatalog = (input: unknown): MetricCatalog =>
  parse("MetricCatalog", input, semanticMetricCatalogIssues);
export const parseScoringProfile = (input: unknown): ScoringProfile =>
  parse("ScoringProfile", input, semanticScoringProfileIssues);
export const parseEvaluationPlan = (input: unknown): EvaluationPlan =>
  parse("EvaluationPlan", input);
export const parseEvaluationRequest = (input: unknown): EvaluationRequest =>
  parse("EvaluationRequest", input);
export const parseEvaluationRun = (input: unknown): EvaluationRun =>
  parse("EvaluationRun", input);
export const parseEvaluationMetric = (input: unknown): EvaluationMetric =>
  parse("EvaluationMetric", input, semanticEvaluationMetricIssues);
export const parseEvidenceRecord = (input: unknown): EvidenceRecord =>
  parse("EvidenceRecord", input);
export const parseEvaluationSubject = (input: unknown): EvaluationSubject =>
  parse("EvaluationSubject", input);
export const parseFinding = (input: unknown): Finding =>
  parse("Finding", input);
export const parseRuntimeObservationContent = (
  input: unknown,
): RuntimeObservationContent => parse("RuntimeObservationContent", input);
export const parseRuntimeObservationEnvelope = (
  input: unknown,
): RuntimeObservationEnvelope => parse("RuntimeObservationEnvelope", input);
export const parseGeometryObjectInput = (input: unknown): GeometryObjectInput =>
  parse("GeometryObjectInput", input);
export const parseTransitionInput = (input: unknown): TransitionInput =>
  parse("TransitionInput", input, semanticTransitionIssues);
export const parseCalculationBundlePreimage = (
  input: unknown,
): CalculationBundlePreimage => parse("CalculationBundlePreimage", input);

export function parseAvailabilityRecord(input: unknown): AvailabilityRecord {
  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>;
    if (
      (record.effectiveAt === undefined) ===
      (record.effectiveSequence === undefined)
    ) {
      throw new ContractValidationError("AvailabilityRecord", [
        semanticIssue(
          "effective-identity",
          "/",
          "exactly one of effectiveAt or effectiveSequence is required",
        ),
      ]);
    }
  }
  return parse("AvailabilityRecord", input);
}

export function assertEvaluationRequestMatchesPlan(
  requestInput: unknown,
  planInput: unknown,
): EvaluationRequest {
  const request = parseEvaluationRequest(requestInput);
  const plan = parseEvaluationPlan(planInput);
  const mismatches: string[] = [];
  if (request.configurationHash !== plan.configurationHash) {
    mismatches.push("configurationHash");
  }
  if (
    request.scene.manifestHash !== plan.scene.manifestHash ||
    request.scene.manifestSchemaVersion !== plan.scene.manifestSchemaVersion
  ) {
    mismatches.push("scene");
  }
  if (
    request.profile.profileId !== plan.profile.profileId ||
    request.profile.profileVersion !== plan.profile.profileVersion ||
    request.profile.scoringProfileHash !== plan.profile.scoringProfileHash ||
    request.profile.compatibilityClass !== plan.profile.compatibilityClass
  ) {
    mismatches.push("profile");
  }
  if (
    request.catalog.catalogId !== plan.catalog.catalogId ||
    request.catalog.catalogVersion !== plan.catalog.catalogVersion ||
    request.catalog.metricCatalogHash !== plan.catalog.metricCatalogHash
  ) {
    mismatches.push("catalog");
  }
  if (
    request.deterministicRequestOptions.seed !== plan.seed ||
    request.deterministicRequestOptions.partialEvidencePolicy !==
      plan.partialEvidencePolicy ||
    request.deterministicRequestOptions.comparisonGroupId !==
      plan.comparisonGroupId
  ) {
    mismatches.push("deterministicRequestOptions");
  }
  if (mismatches.length > 0) {
    throw new ContractValidationError("EvaluationRequestPlanBinding", [
      semanticIssue(
        "request-plan-mismatch",
        "/",
        `request differs from its plan: ${mismatches.join(", ")}`,
      ),
    ]);
  }
  return request;
}

export function assertValidEvidenceGraph(
  inputs: readonly unknown[],
): EvidenceRecord[] {
  const records = inputs.map(parseEvidenceRecord);
  const byHash = new Map<string, EvidenceRecord>();
  for (const record of records) {
    if (byHash.has(record.evidenceContentHash)) {
      throw new ContractValidationError("EvidenceGraph", [
        semanticIssue(
          "duplicate-evidence-content-hash",
          "/",
          `duplicate evidence hash ${record.evidenceContentHash}`,
        ),
      ]);
    }
    byHash.set(record.evidenceContentHash, record);
  }

  for (const record of records) {
    for (const parentHash of record.parentEvidenceHashes) {
      if (!byHash.has(parentHash)) {
        throw new ContractValidationError("EvidenceGraph", [
          semanticIssue(
            "unknown-parent-evidence",
            "/parentEvidenceHashes",
            `unknown parent evidence reference ${parentHash}`,
          ),
        ]);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (hash: string): void => {
    if (visiting.has(hash)) {
      throw new ContractValidationError("EvidenceGraph", [
        semanticIssue(
          "evidence-cycle",
          "/parentEvidenceHashes",
          `evidence graph contains a cycle at ${hash}`,
        ),
      ]);
    }
    if (visited.has(hash)) return;
    visiting.add(hash);
    const record = byHash.get(hash);
    for (const parent of record?.parentEvidenceHashes ?? []) visit(parent);
    visiting.delete(hash);
    visited.add(hash);
  };
  for (const hash of byHash.keys()) visit(hash);
  return records;
}

export class ContractValidationError extends Error {
  public constructor(
    contractName: string,
    public readonly issues: ContractIssue[],
  ) {
    super(
      `${contractName} validation failed:\n${issues
        .map((item) => `${item.path}: ${item.message}`)
        .join("\n")}`,
    );
    this.name = "ContractValidationError";
  }
}

export { schema as evaluatorContractsSchema };
