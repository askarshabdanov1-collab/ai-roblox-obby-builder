import type {
  ContentHash,
  EvaluationMetric,
  EvaluationCompleteness,
  EvaluationPlan,
  EvaluationRequest,
  EvidenceRecordContract,
  Finding,
  InvariantGateResult,
  MetricCatalog,
  MetricCalculationPreimage,
  MetricDefinition,
  ProfileGateResult,
  ReportCategoryResult,
  ReportPayloadPreimage,
  ScoringProfile,
  SemanticVersion,
  VersionRef,
} from "@obby/obby-evaluator-contracts";

export type InvariantGateEvaluation = InvariantGateResult;

export type ProfileGateEvaluation = ProfileGateResult;

export type E1ReportInput = {
  identities: {
    calculationBundleHash: ContentHash;
    manifestHash: ContentHash;
    manifestSchemaVersion: SemanticVersion;
    configurationHash: ContentHash;
    evaluationRequestHash: ContentHash;
    evaluator: VersionRef;
  };
  catalog: MetricCatalog;
  scoringProfile: ScoringProfile;
  invariantGates: readonly InvariantGateEvaluation[];
  profileGates: readonly ProfileGateEvaluation[];
  categories: readonly ReportCategoryResult[];
  calculations: readonly MetricCalculationPreimage[];
  completeness: EvaluationCompleteness;
  availabilityRecordHashes: readonly ContentHash[];
  metrics: readonly EvaluationMetric[];
  findings: readonly Finding[];
  evidence: readonly EvidenceRecordContract[];
  missingEvidence: ReportPayloadPreimage["missingEvidence"];
  limitations: ReportPayloadPreimage["limitations"];
  compatibleDimensions: readonly string[];
};

export type E1EvaluationLimits = {
  maxMetricDefinitions: number;
  maxCalculations: number;
  maxFindings: number;
  maxEvidenceRecords: number;
  maxAvailabilityRecords: number;
  maxReportItems: number;
  maxWorkUnits: number;
};

export type E1EvaluationInput = {
  metricDefinitions: readonly unknown[];
  catalog: unknown;
  profile: unknown;
  plan: unknown;
  request: unknown;
  evaluatorVersion: string;
  componentVersions: Readonly<Record<string, string>>;
  evidence: readonly unknown[];
  findings: readonly unknown[];
  availabilityRecords?: readonly unknown[];
  limits?: Partial<E1EvaluationLimits>;
};

export type E1EvaluationResult = {
  metricDefinitions: MetricDefinition[];
  plan: EvaluationPlan;
  request: EvaluationRequest;
  calculations: MetricCalculationPreimage[];
  metrics: EvaluationMetric[];
  invariantGates: InvariantGateEvaluation[];
  profileGates: ProfileGateResult[];
  completeness: EvaluationCompleteness;
  categories: ReportCategoryResult[];
  calculationBundle: import("@obby/obby-evaluator-contracts").CalculationBundlePreimage & {
    calculationBundleHash: ContentHash;
  };
  report: FinalizedE1Report;
  workUnitsUsed: number;
};

export type FinalizedE1Report = ReportPayloadPreimage & {
  reportPayloadHash: ContentHash;
};

declare const validatedE1ReportBrand: unique symbol;

export type ValidatedE1Report = FinalizedE1Report & {
  readonly [validatedE1ReportBrand]: true;
};

export type ValidatedE1EvaluationResult = Omit<E1EvaluationResult, "report"> & {
  report: ValidatedE1Report;
};

export class ScoringContractError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScoringContractError";
  }
}
