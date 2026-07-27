import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import { snapshotEvaluatorInput } from "@obby/canonical-json";

import schema from "../schemas/evaluator-contracts.schema.json" with { type: "json" };
import type {
  AvailabilityRecord,
  CalculationBundlePreimage,
  ControllerProfile,
  EvaluationMetric,
  EvaluationPlan,
  EvaluationRequest,
  EvaluationRun,
  EvidenceRecord,
  EvaluationSubject,
  Finding,
  GeometryObjectInput,
  MetricCatalog,
  MetricCalculationPreimage,
  MetricDefinition,
  ReportPayloadPreimage,
  ReportRenderPreimage,
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
  validateFormats: true,
});
ajv.addFormat("strict-rfc3339-utc", {
  type: "string",
  validate(value: string): boolean {
    if (
      !/^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{3})?Z$/.test(
        value,
      )
    ) {
      return false;
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return false;
    const normalized = value.includes(".")
      ? value
      : value.replace("Z", ".000Z");
    return parsed.toISOString() === normalized;
  },
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
  ControllerProfile: validator<ControllerProfile>("ControllerProfile"),
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
  MetricCalculationPreimage: validator<MetricCalculationPreimage>(
    "MetricCalculationPreimage",
  ),
  MetricDefinition: validator<MetricDefinition>("MetricDefinition"),
  RuntimeObservationContent: validator<RuntimeObservationContent>(
    "RuntimeObservationContentContract",
  ),
  RuntimeObservationEnvelope: validator<RuntimeObservationEnvelope>(
    "RuntimeObservationEnvelope",
  ),
  ReportPayloadPreimage: validator<ReportPayloadPreimage>(
    "ReportPayloadPreimage",
  ),
  ReportRenderPreimage: validator<ReportRenderPreimage>("ReportRenderPreimage"),
  ScoringProfile: validator<ScoringProfile>("ScoringProfile"),
  TransitionInput: validator<TransitionInput>("TransitionInput"),
} as const;

function structuralIssues(
  errors: ErrorObject[] | null | undefined,
): ContractIssue[] {
  return (errors ?? [])
    .map((error): ContractIssue => ({
      kind: "structural",
      code: error.keyword,
      path: error.instancePath || "/",
      message: error.message ?? "schema validation failed",
    }))
    .toSorted((left, right) =>
      `${left.path}\u0000${left.code}\u0000${left.message}`.localeCompare(
        `${right.path}\u0000${right.code}\u0000${right.message}`,
      ),
    );
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
  return [...duplicates].toSorted();
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
  for (const duplicate of duplicateValues(
    value.supportedVersions.map((version) => version.component),
  )) {
    issues.push(
      semanticIssue(
        "duplicate-supported-component",
        "/supportedVersions",
        `duplicate supported component ${duplicate}`,
      ),
    );
  }
  return issues;
}

function semanticScoringProfileIssues(value: ScoringProfile): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const required = new Set(value.requiredMetricIds);
  const overlap = value.optionalMetricIds
    .filter((id) => required.has(id))
    .toSorted();
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
  for (const category of value.categories.toSorted((left, right) =>
    left.categoryId.localeCompare(right.categoryId),
  )) {
    for (const metricId of category.metricIds.toSorted()) {
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
  if (value.fromObjectId === value.toObjectId) {
    return [
      semanticIssue(
        "transition-endpoint-identity",
        "/toObjectId",
        "transition source and destination must differ",
      ),
    ];
  }
  if (value.toGlobalIndex <= value.fromGlobalIndex) {
    return [
      semanticIssue(
        "transition-route-order",
        "/toGlobalIndex",
        "transition route indexes must be strictly forward",
      ),
    ];
  }
  const expected =
    `route:${value.routeId}/${value.fromObjectId}/${value.toObjectId}/` +
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

function semanticGeometryObjectIssues(
  value: GeometryObjectInput,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (
    value.authority === "native-gameplay" &&
    (value.gameplayOwnership !== "native-part" ||
      value.promotionStatus !== "not-applicable")
  ) {
    issues.push(
      semanticIssue(
        "native-gameplay-authority",
        "/gameplayOwnership",
        "native gameplay authority requires native-part ownership and not-applicable promotion",
      ),
    );
  }
  if (
    value.authority === "decorative" &&
    (value.gameplayOwnership !== "none" ||
      value.promotionStatus !== "not-promoted")
  ) {
    issues.push(
      semanticIssue(
        "decorative-authority",
        "/gameplayOwnership",
        "decorative geometry has no gameplay ownership and cannot be implicitly promoted",
      ),
    );
  }
  if (
    value.shape === "Ball" &&
    (value.size.x !== value.size.y || value.size.y !== value.size.z)
  ) {
    issues.push(
      semanticIssue(
        "ball-diameter",
        "/size",
        "Ball geometry requires equal native diameters on all axes",
      ),
    );
  }
  if (value.shape === "Cylinder" && value.size.y !== value.size.z) {
    issues.push(
      semanticIssue(
        "cylinder-diameter",
        "/size",
        "Cylinder geometry requires equal native Y/Z diameters",
      ),
    );
  }
  return issues;
}

function semanticAvailabilityRecordIssues(
  value: AvailabilityRecord,
): ContractIssue[] {
  if (
    (value.effectiveAt === undefined) ===
    (value.effectiveSequence === undefined)
  ) {
    return [
      semanticIssue(
        "effective-identity",
        "/",
        "exactly one of effectiveAt or effectiveSequence is required",
      ),
    ];
  }
  return [];
}

function validate<T>(
  name: keyof typeof validators,
  input: unknown,
  semantics: (value: T) => ContractIssue[] = () => [],
): ValidationResult<T> {
  let trusted: unknown;
  try {
    trusted = snapshotEvaluatorInput(input);
  } catch (caught) {
    return {
      ok: false,
      issues: [
        {
          kind: "structural",
          code: "untrusted-host-object",
          path: "/",
          message:
            caught instanceof Error
              ? caught.message
              : "input could not be snapshotted deterministically",
        },
      ],
    };
  }
  const validateStructure = validators[name] as ValidateFunction<T>;
  if (!validateStructure(trusted)) {
    return { ok: false, issues: structuralIssues(validateStructure.errors) };
  }
  const issues = semantics(trusted);
  return issues.length === 0
    ? { ok: true, value: trusted, issues: [] }
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
  parse("GeometryObjectInput", input, semanticGeometryObjectIssues);
export const parseTransitionInput = (input: unknown): TransitionInput =>
  parse("TransitionInput", input, semanticTransitionIssues);
export const parseCalculationBundlePreimage = (
  input: unknown,
): CalculationBundlePreimage => parse("CalculationBundlePreimage", input);
export const parseMetricCalculationPreimage = (
  input: unknown,
): MetricCalculationPreimage => parse("MetricCalculationPreimage", input);
export const parseReportPayloadPreimage = (
  input: unknown,
): ReportPayloadPreimage => parse("ReportPayloadPreimage", input);
export const parseReportRenderPreimage = (
  input: unknown,
): ReportRenderPreimage => parse("ReportRenderPreimage", input);
export const parseControllerProfile = (input: unknown): ControllerProfile =>
  parse("ControllerProfile", input);

export function parseAvailabilityRecord(input: unknown): AvailabilityRecord {
  return parse("AvailabilityRecord", input, semanticAvailabilityRecordIssues);
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
